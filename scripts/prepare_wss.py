#!/usr/bin/env python3
"""Prepare the WSS viewer from the supplied vascular surface predictions.

Requires VTK, but not NumPy. No inference or spatial/temporal subsampling occurs.
Geometry is translated/scaled for rendering; all triangles and vertices remain.
WSS vectors retain their original float32 bits, including direction and sign.

Both binary formats use little-endian uint32 headers of four words:
  geometry: [0x57534731, point count, index count, frame count], followed by
            float32 xyz positions and uint32 triangle indices.
  vectors:  [0x57535632, point count, frame count, 2], followed by byte-shuffled
            float32 xyz vectors, frame-major, then CFD / prediction, then point.
The vector payload consists of four byte lanes: raw[0::4], ..., raw[3::4].
Both files are gzip compressed. Units are applied by the browser via unitScale;
the stored vectors, ranges, and displayRanges always use the source units.
Each challenge pools its two cases and all timesteps for fixed color limits.
The boundary-condition challenge reuses the base mesh and changes only fields.
Longitudinal examples use their supplied mean-vector fields; no averaging is
performed here. A common rendering transform preserves relative geometry sizes.
"""

import argparse
import array
from datetime import datetime
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import sys

import vtk


ROOT = Path(__file__).resolve().parents[1]
GEOMETRY_MAGIC = 0x57534731
VECTOR_MAGIC = 0x57535632
HEADER = struct.Struct("<4I")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def little_endian_bytes(values):
    if sys.byteorder == "little":
        return values.tobytes()
    result = array.array(values.typecode, values)
    result.byteswap()
    return result.tobytes()


def source_vectors(field, count):
    require(field is not None, "Missing WSS field")
    require(field.GetNumberOfComponents() == 3 and field.GetNumberOfTuples() == count,
            f"Invalid vector shape in {field.GetName()}")
    require(field.GetDataType() == vtk.VTK_FLOAT,
            f"Expected float32 source vectors in {field.GetName()}; refusing lossy conversion")
    values = array.array("f")
    values.frombytes(memoryview(field).cast("B"))
    require(all(math.isfinite(value) for value in values), f"Nonfinite vector in {field.GetName()}")
    return values


def shuffle_float32(raw):
    require(len(raw) % 4 == 0, "Incomplete float32 payload")
    return b"".join(raw[lane::4] for lane in range(4))


def unshuffle_float32(shuffled):
    require(len(shuffled) % 4 == 0, "Incomplete shuffled float32 payload")
    count = len(shuffled) // 4
    raw = bytearray(len(shuffled))
    for lane in range(4):
        raw[lane::4] = shuffled[lane * count:(lane + 1) * count]
    return bytes(raw)


def encode_vectors(raw, point_count, frame_count):
    require(point_count > 0 and frame_count > 0, "Empty vector dimensions")
    require(len(raw) == point_count * frame_count * 2 * 3 * 4, "Vector payload size mismatch")
    return HEADER.pack(VECTOR_MAGIC, point_count, frame_count, 2) + shuffle_float32(raw)


def decode_vectors(packet):
    require(len(packet) >= HEADER.size, "Truncated vector header")
    magic, point_count, frame_count, field_count = HEADER.unpack_from(packet)
    require(magic == VECTOR_MAGIC and field_count == 2, "Unsupported WSS vector format")
    require(point_count > 0 and frame_count > 0, "Empty vector dimensions")
    require(len(packet) == HEADER.size + point_count * frame_count * field_count * 3 * 4,
            "Vector payload size mismatch")
    return point_count, frame_count, unshuffle_float32(packet[HEADER.size:])


def percent_from_norms(error_norm, reference_norm):
    return 100 * error_norm / reference_norm if reference_norm else None


def frame_statistics(reference, prediction):
    """Full-vector norms, including prediction errors at zero-GT points."""
    require(len(reference) == len(prediction) and len(reference) % 3 == 0,
            "Reference/prediction shape mismatch")
    errors = array.array("d", (float(p) - float(r) for r, p in zip(reference, prediction)))
    reference_norm = math.hypot(*reference)
    error_norm = math.hypot(*errors)
    wss_magnitudes = array.array("d")
    error_magnitudes = array.array("d")
    for point in range(len(reference) // 3):
        offset = point * 3
        wss_magnitudes.append(math.hypot(*reference[offset:offset + 3]))
        wss_magnitudes.append(math.hypot(*prediction[offset:offset + 3]))
        error_magnitudes.append(math.hypot(*errors[offset:offset + 3]))
    return {
        "relativeL2": percent_from_norms(error_norm, reference_norm),
        "referenceNorm": reference_norm,
        "errorNorm": error_norm,
        "wssMagnitudes": wss_magnitudes,
        "errorMagnitudes": error_magnitudes,
    }


def pooled_relative_l2(frame_statistics_list):
    """One norm ratio over all points, frames, and vector components."""
    return percent_from_norms(
        math.hypot(*(frame["errorNorm"] for frame in frame_statistics_list)),
        math.hypot(*(frame["referenceNorm"] for frame in frame_statistics_list)))


def percentile(values, quantile):
    require(len(values) > 0 and 0 <= quantile <= 1, "Invalid percentile")
    ordered = sorted(values)
    position = (len(ordered) - 1) * quantile
    low = int(position)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def read_mesh(path):
    require(path.is_file(), f"Missing input: {path}")
    reader = vtk.vtkXMLPolyDataReader()
    reader.SetFileName(str(path))
    reader.Update()
    require(reader.GetErrorCode() == 0, f"Could not read {path}")
    mesh = reader.GetOutput()
    require(mesh.GetNumberOfPoints() > 0 and mesh.GetNumberOfCells() > 0, f"Empty surface: {path}")
    require(mesh.GetNumberOfPolys() == mesh.GetNumberOfCells(), f"Non-polygon cells in {path}")
    return mesh


def source_field_family(mesh):
    """Prefer the supplied instance; use supplied means only when absent."""
    attributes = mesh.GetPointData()
    names = [attributes.GetArrayName(index) for index in range(attributes.GetNumberOfArrays())]
    for family in ("0", "mean"):
        pattern = re.compile(rf"^wss_(true|pred)_{family}_\d{{3}}$")
        if any(pattern.match(name) for name in names):
            return family
    raise ValueError("No supported transient WSS vector series found")


def source_frame_count(mesh, family=None):
    family = family or source_field_family(mesh)
    attributes = mesh.GetPointData()
    frame_sets = []
    for kind in ("true", "pred"):
        pattern = re.compile(rf"^wss_{kind}_{re.escape(family)}_(\d{{3}})$")
        frames = sorted(int(match.group(1)) for index in range(attributes.GetNumberOfArrays())
                        if (match := pattern.match(attributes.GetArrayName(index))))
        require(frames and frames == list(range(len(frames))), f"Incomplete {kind} heart cycle")
        frame_sets.append(frames)
    require(frame_sets[0] == frame_sets[1], "CFD and prediction timestep mismatch")
    return len(frame_sets[0])


def require_same_geometry(first, second):
    """Boundary-condition comparisons must not confound a change in anatomy."""
    require(first.GetNumberOfPoints() == second.GetNumberOfPoints()
            and first.GetNumberOfCells() == second.GetNumberOfCells(),
            "Boundary-condition sample must have the same geometry as the base sample")
    pairs = [(first.GetPoints().GetData(), second.GetPoints().GetData()),
             (first.GetPolys().GetConnectivityArray(), second.GetPolys().GetConnectivityArray()),
             (first.GetPolys().GetOffsetsArray(), second.GetPolys().GetOffsetsArray())]
    for original, changed in pairs:
        require(original.GetDataType() == changed.GetDataType()
                and memoryview(original).cast("B") == memoryview(changed).cast("B"),
                "Boundary-condition sample points and connectivity must match the base mesh exactly")


def challenge_ranges(sample_ids, magnitudes):
    ranges = {}
    populations = {}
    for kind in ("wss", "error"):
        values = array.array("d")
        for sample_id in sample_ids:
            values.extend(magnitudes[sample_id][kind])
        ranges[kind] = [0, percentile(values, .99)]
        populations[kind] = len(values)
    return ranges, populations


def geometry_packet(mesh, center, scale, frame_count):
    positions = array.array("f")
    maximum_coordinate_error = 0.0
    for point in range(mesh.GetNumberOfPoints()):
        source = mesh.GetPoint(point)
        for axis in range(3):
            positions.append((source[axis] - center[axis]) * scale)
            reconstructed = positions[-1] / scale + center[axis]
            maximum_coordinate_error = max(maximum_coordinate_error, abs(source[axis] - reconstructed))
    indices = array.array("I")
    require(indices.itemsize == 4 and positions.itemsize == 4, "Unsupported platform array size")
    used_points = set()
    for cell_id in range(mesh.GetNumberOfCells()):
        cell = mesh.GetCell(cell_id)
        require(cell.GetNumberOfPoints() == 3, "Expected a triangulated source surface")
        for corner in range(3):
            index = cell.GetPointId(corner)
            require(0 <= index < mesh.GetNumberOfPoints(), "Invalid surface connectivity")
            indices.append(index)
            used_points.add(index)
    require(len(used_points) == mesh.GetNumberOfPoints(), "Source has orphan vertices; resolve before preparing")
    packet = HEADER.pack(GEOMETRY_MAGIC, mesh.GetNumberOfPoints(), len(indices), frame_count)
    packet += little_endian_bytes(positions) + little_endian_bytes(indices)
    return packet, maximum_coordinate_error


def write_gzip(path, raw):
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    require(gzip.decompress(compressed) == raw, f"Gzip round-trip failed: {path}")
    path.write_bytes(compressed)
    return {"bytes": len(compressed), "uncompressedBytes": len(raw),
            "sha256": hashlib.sha256(compressed).hexdigest()}


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def prepare(args):
    require(math.isfinite(args.unit_scale) and args.unit_scale > 0, "Invalid unit scale")
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    def visit_label(path):
        patient, date, *_ = path.stem.split("_")
        return f"Patient {patient} · {datetime.strptime(date, '%Y%m%d'):%Y.%m.%d}"
    earlier_label = visit_label(args.remodelling_earlier)
    later_label = visit_label(args.remodelling_later)
    inputs = [("base", "Base geometry", args.base.resolve()),
              ("extended", "Extended geometry", args.extended.resolve()),
              ("boundary-1", "High inflow", args.boundary_conditions.resolve()),
              ("p6-earlier", earlier_label, args.remodelling_earlier.resolve()),
              ("p6-later", later_label, args.remodelling_later.resolve())]
    meshes = [read_mesh(path) for _, _, path in inputs]
    require_same_geometry(meshes[0], meshes[2])
    # Anchor every case to the original AAA pair. Independently normalizing
    # the longitudinal meshes would hide their relative size differences.
    bounds = [(min(mesh.GetBounds()[axis * 2] for mesh in meshes[:2]),
               max(mesh.GetBounds()[axis * 2 + 1] for mesh in meshes[:2])) for axis in range(3)]
    center = [(low + high) / 2 for low, high in bounds]
    scale = 2 / max(high - low for low, high in bounds)
    manifest = {"version": 2, "model": "LaB-GATr",
                "units": args.units, "sourceUnits": args.source_units, "unitScale": args.unit_scale,
                "defaultChallenge": "topology", "samples": [],
                "challenges": [
                    {"id": "topology", "label": "Vascular Topology",
                     "cases": [{"sample": "base", "label": "Base geometry"},
                               {"sample": "extended", "label": "Extended geometry"}]},
                    {"id": "boundary-conditions", "label": "Boundary Conditions",
                     "cases": [{"sample": "base", "label": "Low inflow"},
                               {"sample": "boundary-1", "label": "High inflow"}]},
                    {"id": "remodelling", "label": "Remodelling Consistency",
                     "cases": [{"sample": "p6-earlier", "label": earlier_label},
                               {"sample": "p6-later", "label": later_label}]}],
                "displayRangePercentile": 99,
                "metricDefinition": "100 * norm(CFD - prediction) / norm(CFD)",
                "metricZeroReferencePolicy": "include zero-GT prediction errors",
                "renderTransform": {"center": center, "scale": scale}}
    audit = {"version": 2, "vectorEncoding": "float32-byte-shuffle-gzip-lossless",
             "ordering": "frame, CFD/prediction, point, xyz component",
             "surfaceSampling": "all original vertices and triangles",
             "timeSampling": "all original frames in numeric suffix order",
             "metricWeighting": "unweighted vertices; all xyz components; whole-cycle norm pools all frames",
             "samples": [], "challenges": []}
    magnitudes = {}
    written_assets = {}
    base_geometry = None
    for (sample_id, label, path), mesh in zip(inputs, meshes):
        print(f"Preparing {sample_id}: {path.name}", flush=True)
        point_count = mesh.GetNumberOfPoints()
        field_family = source_field_family(mesh)
        frame_count = source_frame_count(mesh, field_family)
        geometry, geometry_error = geometry_packet(mesh, center, scale, frame_count)
        if sample_id == "base":
            base_geometry = geometry
        elif sample_id == "boundary-1":
            require(geometry == base_geometry, "Boundary-condition geometry/time dimensions differ from base")
        magnitudes[sample_id] = {"wss": array.array("d"), "error": array.array("d")}
        frames = []
        chunks = []
        sample_wss_max = 0.0
        sample_error_max = 0.0
        mean_fields_identical = True if field_family == "0" else None
        attributes = mesh.GetPointData()
        for frame in range(frame_count):
            fields = []
            for kind in ("true", "pred"):
                values = source_vectors(attributes.GetArray(f"wss_{kind}_{field_family}_{frame:03}"), point_count)
                raw = little_endian_bytes(values)
                chunks.append(raw)
                fields.append(values)
                if field_family == "0":
                    mean = attributes.GetArray(f"wss_{kind}_mean_{frame:03}")
                    if mean is not None:
                        mean_fields_identical &= raw == little_endian_bytes(source_vectors(mean, point_count))
                    else:
                        mean_fields_identical = False
            stats = frame_statistics(*fields)
            magnitudes[sample_id]["wss"].extend(stats["wssMagnitudes"])
            magnitudes[sample_id]["error"].extend(stats["errorMagnitudes"])
            sample_wss_max = max(sample_wss_max, max(stats.pop("wssMagnitudes")))
            sample_error_max = max(sample_error_max, max(stats.pop("errorMagnitudes")))
            frames.append(stats)
        raw_vectors = b"".join(chunks)
        encoded = encode_vectors(raw_vectors, point_count, frame_count)
        decoded_count, decoded_frames, decoded = decode_vectors(encoded)
        require((decoded_count, decoded_frames) == (point_count, frame_count) and decoded == raw_vectors,
                "Vector byte-shuffle round-trip failed")
        geometry_name = "base-geometry.bin.gz" if sample_id == "boundary-1" else f"{sample_id}-geometry.bin.gz"
        vectors_name = f"{sample_id}-vectors.bin.gz"
        if geometry_name not in written_assets:
            written_assets[geometry_name] = {"file": geometry_name, **write_gzip(output / geometry_name, geometry)}
        geometry_audit = written_assets[geometry_name]
        vectors_audit = {"file": vectors_name, **write_gzip(output / vectors_name, encoded)}
        written_assets[vectors_name] = vectors_audit
        sample = {"id": sample_id, "label": label, "source": path.name,
                  "fieldFamily": field_family,
                  "pointCount": point_count, "triangleCount": mesh.GetNumberOfCells(),
                  "frameCount": frame_count, "geometry": geometry_name, "vectors": vectors_name,
                  "ranges": {"wss": [0, sample_wss_max], "error": [0, sample_error_max]},
                  "metrics": {"relativeL2": [frame["relativeL2"] for frame in frames],
                              "relativeL2AllFrames": pooled_relative_l2(frames)}}
        if sample_id in ("base", "extended", "boundary-1"):
            sample["dataset"] = "AAA-100"
        manifest["samples"].append(sample)
        audit["samples"].append({"id": sample_id, "source": path.name,
                                 "sourceSha256": sha256_file(path), "sourceBytes": path.stat().st_size,
                                 "pointCount": point_count, "triangleCount": mesh.GetNumberOfCells(),
                                 "frameCount": frame_count, "sourceBounds": list(mesh.GetBounds()),
                                 "geometry": geometry_audit, "vectors": vectors_audit,
                                 "geometryMaximumCoordinateError": geometry_error,
                                 "vectorsBitExact": True, "instanceZeroEqualsMean": mean_fields_identical,
                                 "sharedGeometryWith": "base" if sample_id == "boundary-1" else None,
                                 "sourceFields": {"gt": f"wss_true_{field_family}_{{frame:03}}",
                                                  "prediction": f"wss_pred_{field_family}_{{frame:03}}"},
                                 "frameReferenceNorms": [frame["referenceNorm"] for frame in frames],
                                 "frameErrorNorms": [frame["errorNorm"] for frame in frames]})
        print(f"  {point_count:,} points, {frame_count} frames; "
              f"{(geometry_audit['bytes'] + vectors_audit['bytes']) / 1024**2:.2f} MiB; "
              f"relative L2 {sample['metrics']['relativeL2AllFrames']:.4f}%", flush=True)
    for challenge in manifest["challenges"]:
        sample_ids = [case["sample"] for case in challenge["cases"]]
        ranges, populations = challenge_ranges(sample_ids, magnitudes)
        challenge["displayRanges"] = ranges
        audit["challenges"].append({"id": challenge["id"], "samples": sample_ids,
                                    "displayRangePopulation": populations, "displayRanges": ranges})
        print(f"{challenge['label']} display ranges (source units): {ranges}", flush=True)
    audit["displayRangeDefinition"] = "99th percentile pooled over each challenge's two cases and all frames; WSS includes CFD and prediction"
    audit["assets"] = list(written_assets.values())
    audit["generatedBytes"] = sum(asset["bytes"] for asset in written_assets.values())
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    (output / "audit.json").write_text(json.dumps(audit, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Total binary assets: {audit['generatedBytes'] / 1024**2:.2f} MiB", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", type=Path, default=ROOT / "AAA100_0_original.vtp")
    parser.add_argument("--extended", type=Path, default=ROOT / "AAA100_0.vtp")
    parser.add_argument("--boundary-conditions", type=Path, default=ROOT / "AAA100_1.vtp")
    parser.add_argument("--remodelling-earlier", type=Path, default=ROOT / "P6_20011025_0000_0.vtp")
    parser.add_argument("--remodelling-later", type=Path, default=ROOT / "P6_20101202_0000_0.vtp")
    parser.add_argument("--output", type=Path, default=ROOT / "assets/data/wss-demo")
    parser.add_argument("--units", default="Pa", help="Displayed unit label")
    parser.add_argument("--source-units", default="dyn/cm²", help="Original VTP vector units")
    parser.add_argument("--unit-scale", type=float, default=0.1, help="Source-to-display unit conversion; vectors stay unchanged")
    prepare(parser.parse_args())


if __name__ == "__main__":
    main()

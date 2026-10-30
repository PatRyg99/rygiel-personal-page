#!/usr/bin/env python3
"""Prepare supplied vascular vector fields for the interactive AB-GATr viewer.

Requires Python 3 and VTK (tested with 9.6.1); NumPy is not required.
Run from any directory: python3 scripts/prepare_aneumo.py
Optional positional arguments replace the default source selection.
Unchanged, validated cases are reused even if their original VTUs are absent;
--force requires the raw inputs and rebuilds every requested case. Temporal
fields use range-mapped uint16 storage by default; --lossless retains float32.

Raw velocities are in cm/s, as confirmed by the dataset owner. No unit
conversion is applied. Error values are the L2 magnitude of the supplied
error vector, interpolated by VTK onto the cut. This is not
abs(|prediction| - |GT|). AAA*-T sources contain 21 instantaneous frames,
retained separately with one common scale. Frame indices do not imply physical
time. Legacy averaged AAA files are also accepted explicitly, with no further
averaging. Source files stay intact.

Each deterministic gzip file contains little-endian binary data:
  uint32 magic=0x414E4531, vertex_count, index_count, field_count;
  float32 positions[vertex_count,3]; uint32 triangle_indices[index_count];
  float32 scalar_fields[field_count,vertex_count] in manifest fieldOrder.
Shells and temporal slice geometry have field_count=0. Temporal *.series.gz
files start with uint32 magic=0x41545331, vertex_count, frame_count, field_count;
then frame-major, field-major float32 magnitude bits. Frame zero is stored
verbatim; each later frame is bitwise XOR against the previous original frame.
The XOR transform is lossless and reversed before interpreting floats.
Compact series use magic=0x41545333 with the same four header words, followed
by one float64 maximum per field and byte-shuffled uint16 temporal deltas. Each field
uses one range across all 21 frames. Decoding multiplies by maximum/65535;
rounding is bounded by half a quantization step plus float32 reconstruction.
Geometry and color-scale ranges are never quantized. The audit records the
actual maximum error against the original prepared float32 fields.
One common transform places the longest source
bounding-box side at length 2; scalar values are never scaled.

Ordinary VTK cuts are retained. If a source polyhedron cannot be contoured,
only the missing intersected cells are tetrahedralized, checked for positive
volume and volume conservation, cut, and appended to the original cut.
Every intersecting source cell must then be represented. No holes are filled
synthetically and no source vectors or point coordinates are modified.
"""

import argparse
import base64
import array
import gzip
import gc
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import shutil
import time
import zlib
import sys

import vtk

ROOT = Path(__file__).resolve().parent.parent
MAGIC = 0x414E4531
SERIES_MAGIC = 0x41545331
COMPACT_SERIES_MAGIC = 0x41545333
LOSSLESS_ENCODING = "xor-float32-v1"
COMPACT_ENCODING = "uint16-delta-v1"
CELL_IDS = "_aneumo_source_cell_id"
FIELD_ORDER = [
    "GT", "AB-GATr", "AB-GATr-error", "AB-UPT", "AB-UPT-error",
    "AB-UPT-180", "AB-UPT-180-error", "LaB-GATr", "LaB-GATr-error",
    "Transolver", "Transolver-error", "Transolver-180", "Transolver-180-error",
]
MODEL_LABELS = [
    ("AB-GATr", "AB-GATr"), ("AB-UPT", "AB-UPT"),
    ("AB-UPT-180", "AB-UPT (rotation-trained)"), ("LaB-GATr", "LaB-GATr"),
    ("Transolver", "Transolver++"),
    ("Transolver-180", "Transolver++ (rotation-trained)"),
]
FRACTIONS = [round(0.08 + i * 0.06, 2) for i in range(15)]
DATASETS = [
    {"id": "aneumo", "label": "ANEUMO", "timeAveraged": False},
    {"id": "synthbifcor", "label": "SynthBifCor", "timeAveraged": False},
    {"id": "aaa-100", "label": "AAA-100", "timeAveraged": False,
     "timeResolved": True, "predictedTimeSteps": 21},
]
DEFAULT_SOURCES = [
    "777-combined.vtu", "832-combined.vtu", "845-combined.vtu",
    "sample-1815-combined.vtu", "sample-1847-combined.vtu", "sample-1962-combined.vtu",
    "AAA021-T-combined.vtu", "AAA048-T-combined.vtu", "AAA090-T-combined.vtu",
]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def identify_source(path):
    name = path.name
    match = re.fullmatch(r"(\d+)-combined\.vtu", name)
    if match:
        return {"id": match[1], "label": match[1], "dataset": "aneumo"}
    match = re.fullmatch(r"sample-(\d+)-combined\.vtu", name)
    if match:
        return {"id": match[1], "label": match[1], "dataset": "synthbifcor"}
    match = re.fullmatch(r"AAA(\d+)-T-combined\.vtu", name)
    if match:
        return {"id": "AAA" + match[1] + "-T", "label": match[1], "dataset": "aaa-100",
                "timeSteps": 21}
    match = re.fullmatch(r"AAA(\d+)-combined\.vtu", name)
    if match:
        return {"id": "AAA" + match[1], "label": match[1], "dataset": "aaa-100"}
    raise ValueError(f"Unrecognized dataset/sample filename: {name}")


def file_hash(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def add_temporal_metadata(sample):
    averaged = sample["dataset"] == "aaa-100" and not sample.get("timeSteps")
    if sample.get("timeSteps"):
        sample["predictedTimeSteps"] = sample["timeSteps"]
        sample["timeAveraged"] = False
        return sample
    sample["timeAveraged"] = averaged
    if averaged:
        sample["predictedTimeSteps"] = 21
        sample["temporalAggregation"] = "Input vectors are already averaged over the heart cycle; no additional averaging or unit conversion is applied. The display shows the magnitude of the supplied averaged vector."
    return sample


def validate_geometry_file(path, field_count, stats):
    raw = gzip.decompress(path.read_bytes())
    require(len(raw) >= 16, f"Truncated geometry: {path}")
    magic, vertices, indices, fields = struct.unpack_from("<4I", raw)
    require(magic == MAGIC and fields == field_count, f"Incompatible geometry: {path}")
    require(vertices > 0 and indices > 0 and indices % 3 == 0, f"Empty geometry: {path}")
    expected = 16 + vertices * 12 + indices * 4 + vertices * fields * 4
    require(len(raw) == expected, f"Invalid geometry length: {path}")
    require(vertices == stats["vertices"] and indices == stats["triangles"] * 3,
            f"Geometry does not match its audited dimensions: {path}")
    floats = array.array("f")
    floats.frombytes(raw[16:16 + vertices * 12])
    numbers = array.array("I")
    numbers.frombytes(raw[16 + vertices * 12:16 + vertices * 12 + indices * 4])
    scalars = array.array("f")
    scalars.frombytes(raw[16 + vertices * 12 + indices * 4:])
    if sys.byteorder != "little":
        for values in [floats, numbers, scalars]:
            values.byteswap()
    require(all(math.isfinite(value) for value in floats), f"Nonfinite geometry: {path}")
    require(all(index < vertices for index in numbers), f"Out-of-range index: {path}")
    require(all(math.isfinite(value) and value >= 0 for value in scalars),
            f"Invalid scalar value: {path}")
    digest = file_hash(path)
    require("sha256" not in stats or stats["sha256"] == digest,
            f"Geometry differs from its audited checksum: {path}")
    stats["sha256"] = digest


def cached_source(path, output, previous, previous_audit, source_hash):
    identity = identify_source(path)
    sample = next((s for s in previous.get("samples", []) if s["id"] == identity["id"]), None)
    audit = next((s for s in previous_audit.get("samples", []) if s["id"] == identity["id"]), None)
    if not sample or not audit or sample.get("source", {}).get("sha256") != source_hash:
        return None
    if previous.get("formatVersion") not in (1, 2) or previous.get("fieldOrder") != FIELD_ORDER or previous.get("fractions") != FRACTIONS:
        return None
    try:
        require(isinstance(source_hash, str) and bool(re.fullmatch(r"[a-f0-9]{64}", source_hash)),
                "Missing cached source checksum")
        require(len(audit["slices"]) == len(FRACTIONS) * 3, "Incomplete cached slice audit")
        validate_geometry_file(output / sample["shell"], 0, audit["shell"])
        temporal = bool(sample.get("timeSteps"))
        for details in audit["slices"]:
            filename = sample["slices"][details["axis"]][details["index"]]
            validate_geometry_file(output / filename, 0 if temporal else len(FIELD_ORDER), details)
        if temporal:
            require(sample.get("seriesEncoding") in (LOSSLESS_ENCODING, COMPACT_ENCODING), "Unsupported cached series encoding")
            require(len(audit["series"]) == len(FRACTIONS) * 3 * (len(MODEL_LABELS) + 1),
                    "Incomplete cached temporal series audit")
            for details in audit["series"]:
                filename = output / details["path"]
                require(file_hash(filename) == details["sha256"], "Temporal cache checksum mismatch")
                validate_series_file(filename, details["vertices"], details["fields"],
                                     sample["timeSteps"], details["decodedSha256"])
    except (OSError, ValueError, KeyError, IndexError, EOFError, struct.error, zlib.error):
        return None
    sample.update(identity)
    add_temporal_metadata(sample)
    audit["cacheValidation"] = {"sourceFilePresent": path.is_file(),
                                "sourceChecksumRechecked": path.is_file(),
                                "assetChecksumsRechecked": True}
    if not temporal:
        audit["providedErrorsMatchAbsoluteDifference"] = audit["sourceErrorResidual"] <= 1e-10
        if audit["sourceErrorResidual"] == 0:
            audit.setdefault("sourceErrorResidualByModel", {model: 0.0 for model, _ in MODEL_LABELS})
    audit.setdefault("errorSemantics", "The supplied error vectors are retained. Residuals compare them with componentwise absolute differences of the supplied GT/prediction vectors; no instantaneous fields are reconstructed from averaged data.")
    return sample, audit


def run(algorithm):
    sink = vtk.vtkStringOutputWindow()
    vtk.vtkOutputWindow.SetInstance(sink)
    algorithm.Update()
    return sink.GetOutput().strip()


def source_cell_ids(polydata):
    values = polydata.GetCellData().GetArray(CELL_IDS)
    require(values is not None, "VTK lost source-cell provenance")
    return {int(values.GetValue(i)) for i in range(values.GetNumberOfValues())}


def volumes(grid):
    sizes = vtk.vtkCellSizeFilter()
    sizes.SetInputData(grid)
    sizes.ComputeLengthOff()
    sizes.ComputeAreaOff()
    sizes.ComputeVertexCountOff()
    messages = run(sizes)
    require(not messages, "Volume validation failed: " + messages)
    values = sizes.GetOutput().GetCellData().GetArray("Volume")
    result = [values.GetValue(i) for i in range(values.GetNumberOfValues())]
    require(all(math.isfinite(value) and value > 0 for value in result),
            "Invalid or non-positive source/fallback cell volume")
    return sum(result)


def scalar_ranges_and_validation(grid, used):
    data = grid.GetPointData()
    fields = {name: data.GetArray(name) for name in FIELD_ORDER}
    for name, field in fields.items():
        require(field is not None and field.GetNumberOfComponents() == 3,
                f"Missing three-component field: {name}")
        require(field.GetNumberOfTuples() == grid.GetNumberOfPoints(),
                f"Field length differs from point count: {name}")
    velocity_max = error_max = residual = 0.0
    residuals = {model: 0.0 for model, _ in MODEL_LABELS}
    for point_id in range(grid.GetNumberOfPoints()):
        gt = fields["GT"].GetTuple3(point_id)
        require(all(math.isfinite(value) for value in gt), "Nonfinite GT value")
        represented = bool(used[point_id])
        if represented:
            velocity_max = max(velocity_max, math.hypot(*gt))
        for model, _ in MODEL_LABELS:
            predicted = fields[model].GetTuple3(point_id)
            error = fields[model + "-error"].GetTuple3(point_id)
            require(all(math.isfinite(value) for value in predicted + error),
                    f"Nonfinite source value: {model}")
            require(all(value >= 0 for value in error), "Negative absolute error")
            discrepancy = max(abs(error[i] - abs(predicted[i] - gt[i])) for i in range(3))
            residuals[model] = max(residuals[model], discrepancy)
            residual = max(residual, discrepancy)
            if represented:
                velocity_max = max(velocity_max, math.hypot(*predicted))
                error_max = max(error_max, math.hypot(*error))
    # Aggregated errors need not equal the error of aggregated predictions.
    # Preserve the supplied fields and report the comparison instead of replacing them.
    return [0, velocity_max], [0, error_max], residual, residuals


def triangulate(polydata):
    triangles = vtk.vtkTriangleFilter()
    triangles.SetInputData(polydata)
    triangles.PassLinesOff()
    triangles.PassVertsOff()
    messages = run(triangles)
    require(not messages, "Surface triangulation failed: " + messages)
    return triangles.GetOutput()


def write_geometry(path, polydata, center, scale, fields):
    polydata = triangulate(polydata)
    vertex_count = polydata.GetNumberOfPoints()
    require(vertex_count > 0, f"Empty geometry: {path}")
    positions = array.array("f")
    for index in range(vertex_count):
        point = polydata.GetPoint(index)
        require(all(math.isfinite(value) for value in point), "Nonfinite geometry")
        positions.extend((point[i] - center[i]) * scale for i in range(3))
    indices = array.array("I")
    cells = polydata.GetPolys()
    ids = vtk.vtkIdList()
    cells.InitTraversal()
    area = 0.0
    while cells.GetNextCell(ids):
        require(ids.GetNumberOfIds() == 3, "Nontriangle output")
        face = [ids.GetId(i) for i in range(3)]
        require(all(0 <= index < vertex_count for index in face), "Invalid triangle index")
        p, q, r = [polydata.GetPoint(index) for index in face]
        u, v = [q[i] - p[i] for i in range(3)], [r[i] - p[i] for i in range(3)]
        area += math.hypot(u[1] * v[2] - u[2] * v[1],
                           u[2] * v[0] - u[0] * v[2],
                           u[0] * v[1] - u[1] * v[0]) / 2
        indices.extend(face)
    require(len(indices) > 0 and len(indices) % 3 == 0, "No valid triangles")
    scalars = array.array("f")
    for name in fields:
        values = polydata.GetPointData().GetArray(name)
        require(values is not None and values.GetNumberOfTuples() == vertex_count,
                f"VTK lost interpolated field {name}")
        for index in range(vertex_count):
            magnitude = math.hypot(*values.GetTuple3(index))
            require(math.isfinite(magnitude) and magnitude >= 0, "Invalid scalar magnitude")
            scalars.append(magnitude)
    require(positions.itemsize == indices.itemsize == scalars.itemsize == 4,
            "This platform lacks 32-bit numeric arrays")
    if sys.byteorder != "little":
        for values in [positions, indices, scalars]:
            values.byteswap()
    raw = struct.pack("<4I", MAGIC, vertex_count, len(indices), len(fields))
    raw += positions.tobytes() + indices.tobytes() + scalars.tobytes()
    expected_bytes = 16 + vertex_count * 12 + len(indices) * 4 + len(fields) * vertex_count * 4
    require(len(raw) == expected_bytes, "Binary layout length mismatch")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
    require(gzip.decompress(path.read_bytes()) == raw, "Gzip round-trip failed")
    return {"vertices": vertex_count, "triangles": len(indices) // 3,
            "area": area, "bytes": path.stat().st_size, "rawBytes": len(raw),
            "sha256": file_hash(path)}


def prepare_source(path, output, source_hash):
    identity = identify_source(path)
    sample_id = identity["id"]
    reader = vtk.vtkXMLUnstructuredGridReader()
    reader.SetFileName(str(path))
    messages = run(reader)
    require(not messages, "VTU reader reported: " + messages)
    grid = reader.GetOutput()
    require(grid.GetNumberOfCells() > 0, "Empty source grid")
    connectivity = grid.GetCells().GetConnectivityArray()
    used = bytearray(grid.GetNumberOfPoints())
    for i in range(connectivity.GetNumberOfValues()):
        used[int(connectivity.GetValue(i))] = 1
    velocity_range, error_range, residual, residuals = scalar_ranges_and_validation(grid, used)
    bounds = grid.GetBounds()
    center = [(bounds[2 * i] + bounds[2 * i + 1]) / 2 for i in range(3)]
    scale = 2 / max(bounds[2 * i + 1] - bounds[2 * i] for i in range(3))
    # Six packed arrays avoid millions of Python lists/floats for the AAA meshes.
    cell_bounds = [array.array("d") for _ in range(6)]
    provenance = vtk.vtkIdTypeArray()
    provenance.SetName(CELL_IDS)
    provenance.SetNumberOfTuples(grid.GetNumberOfCells())
    for index in range(grid.GetNumberOfCells()):
        provenance.SetValue(index, index)
        box = [0.0] * 6
        grid.GetCellBounds(index, box)
        for axis, value in enumerate(box):
            cell_bounds[axis].append(value)
    grid.GetCellData().AddArray(provenance)

    surface = vtk.vtkDataSetSurfaceFilter()
    surface.SetInputData(grid)
    messages = run(surface)
    require(not messages, "Original shell extraction reported: " + messages)
    shell_path = f"{sample_id}/shell.bin.gz"
    shell_stats = write_geometry(output / shell_path, surface.GetOutput(), center, scale, [])
    sample = {
        **identity, "shell": shell_path,
        "slices": {axis: [] for axis in "xyz"},
        "velocityRange": velocity_range, "errorRange": error_range,
        "defaultAxis": "z", "defaultSlice": 7,
        "center": center, "scale": scale, "sourceBounds": list(bounds),
        "source": {"filename": path.name, "sha256": source_hash,
                   "pointCount": grid.GetNumberOfPoints(), "cellCount": grid.GetNumberOfCells(),
                   "excludedOrphanPoints": grid.GetNumberOfPoints() - sum(used)},
    }
    add_temporal_metadata(sample)
    audit = {"id": sample_id, "shell": shell_stats,
             "sourceErrorResidual": residual, "sourceErrorResidualByModel": residuals,
             "providedErrorsMatchAbsoluteDifference": residual <= 1e-10,
             "errorSemantics": "The original supplied error vectors are retained; residuals compare them to componentwise absolute differences of the provided GT/prediction vectors. This check does not reconstruct instantaneous errors from averaged data.",
             "slices": []}
    fallback_cache = {}
    for axis_index, axis in enumerate("xyz"):
        for slice_index, fraction in enumerate(FRACTIONS):
            position = bounds[2 * axis_index] + fraction * (bounds[2 * axis_index + 1] - bounds[2 * axis_index])
            origin = center.copy()
            origin[axis_index] = position
            normal = [0, 0, 0]
            normal[axis_index] = 1
            plane = vtk.vtkPlane()
            plane.SetOrigin(origin)
            plane.SetNormal(normal)
            cutter = vtk.vtkCutter()
            cutter.SetInputData(grid)
            cutter.SetCutFunction(plane)
            cutter.SetOutputPointsPrecision(vtk.vtkAlgorithm.DOUBLE_PRECISION)
            messages = run(cutter)
            cut = cutter.GetOutput()
            lower, upper = cell_bounds[2 * axis_index:2 * axis_index + 2]
            expected = {i for i, (lo, hi) in enumerate(zip(lower, upper))
                        if lo < position < hi}
            present = source_cell_ids(cut)
            missing = tuple(sorted(expected - present))
            details = {"axis": axis, "index": slice_index, "fraction": fraction,
                       "position": position, "expectedSourceCells": len(expected),
                       "tetrahedralizedSourceCells": list(missing)}
            if messages:
                require(missing and "cannot be contoured" in messages,
                        "Unexpected VTK contour warning: " + messages)
                details["originalContourWarnings"] = messages
            if missing:
                if missing not in fallback_cache:
                    extract = vtk.vtkExtractCells()
                    ids = vtk.vtkIdList()
                    for cell_id in missing:
                        ids.InsertNextId(cell_id)
                    extract.SetInputData(grid)
                    extract.SetCellList(ids)
                    require(not run(extract), "Cannot extract problem source cells")
                    original_cells = extract.GetOutput()
                    tetra = vtk.vtkDataSetTriangleFilter()
                    tetra.SetInputData(original_cells)
                    require(not run(tetra), "Cannot tetrahedralize problem source cells")
                    tetra_grid = tetra.GetOutput()
                    require(source_cell_ids(tetra_grid) == set(missing),
                            "Tetrahedralization dropped source cells")
                    before, after = volumes(original_cells), volumes(tetra_grid)
                    relative_volume_error = abs(after - before) / before
                    require(relative_volume_error < 1e-4,
                            f"Fallback does not conserve source volume: {relative_volume_error}")
                    fallback_cache[missing] = (tetra_grid, relative_volume_error)
                tetra_grid, volume_error = fallback_cache[missing]
                repaired = vtk.vtkCutter()
                repaired.SetInputData(tetra_grid)
                repaired.SetCutFunction(plane)
                repaired.SetOutputPointsPrecision(vtk.vtkAlgorithm.DOUBLE_PRECISION)
                require(not run(repaired), "Tetrahedralized source cells still cannot be cut")
                require(source_cell_ids(repaired.GetOutput()) == set(missing),
                        "Fallback did not represent all missing source cells")
                append = vtk.vtkAppendPolyData()
                append.AddInputData(cut)
                append.AddInputData(repaired.GetOutput())
                require(not run(append), "Cannot join faithful source-cell cuts")
                cut = append.GetOutput()
                details["relativeFallbackVolumeError"] = volume_error
            require(expected <= source_cell_ids(cut), "Incomplete slice: intersected cells are missing")
            relative_path = f"{sample_id}/{axis}-{slice_index:02d}.bin.gz"
            details.update(write_geometry(output / relative_path, cut, center, scale, FIELD_ORDER))
            sample["slices"][axis].append(relative_path)
            audit["slices"].append(details)
        print(f"{identity['dataset']} / {sample_id}: prepared {axis.upper()} cuts", flush=True)
    central = [item for item in audit["slices"] if item["index"] == 7]
    sample["defaultAxis"] = max(central, key=lambda item: item["area"])["axis"]
    sample["fallbackSliceCount"] = sum(bool(item["tetrahedralizedSourceCells"]) for item in audit["slices"])
    return sample, audit


def index_vtu_arrays(path):
    """Index inline binary payloads without parsing/copying the 1.7 GiB XML tree."""
    entries = {}
    active = None
    with path.open("rb") as handle:
        while True:
            before = handle.tell()
            line = handle.readline()
            if not line:
                break
            if b"<DataArray " in line:
                attributes = dict((key.decode(), value.decode())
                                  for key, value in re.findall(rb'(\w+)="([^"]*)"', line))
                require(b"</DataArray>" not in line, "Expected line-separated VTU binary payload")
                active = {**attributes, "start": handle.tell()}
            elif active is not None and b"</DataArray>" in line:
                active["end"] = before
                require(active.get("format") == "binary", "Expected inline binary VTU arrays")
                entries[active["Name"]] = active
                active = None
    return entries


def read_vtu_vector(handle, entry, points):
    """Decode the VTK zlib block envelope; retain Float64 source precision."""
    require(entry["type"] == "Float64" and entry.get("NumberOfComponents") == "3",
            "Temporal source needs three-component Float64 arrays")
    handle.seek(entry["start"])
    payload = handle.read(entry["end"] - entry["start"]).split(b"<", 1)[0]
    encoded = b"".join(payload.split())
    blocks, block_size, last_size = struct.unpack("<3I", base64.b64decode(encoded[:16]))
    header_length = 4 * ((4 * (3 + blocks) + 2) // 3)
    header = struct.unpack("<" + "I" * (3 + blocks), base64.b64decode(encoded[:header_length]))
    compressed = base64.b64decode(encoded[header_length:], validate=True)
    decoded = bytearray()
    offset = 0
    for length in header[3:]:
        decoded.extend(zlib.decompress(compressed[offset:offset + length]))
        offset += length
    require(offset == len(compressed), "Unused compressed VTU block bytes")
    require(len(decoded) == (blocks - 1) * block_size + last_size == points * 3 * 8,
            "Temporal source vector length mismatch")
    buffer = array.array("d")
    buffer.frombytes(decoded)
    if sys.byteorder != "little":
        buffer.byteswap()
    require(all(math.isfinite(value) for value in buffer), "Nonfinite source vector")
    field = vtk.vtkDoubleArray()
    field.SetNumberOfComponents(3)
    field.SetArray(buffer, len(buffer), 1)
    return field, buffer


def temporal_field_name(field, frame):
    if field == "GT":
        return f"GT-{frame}"
    error = field.endswith("-error")
    model = field[:-6] if error else field
    return f"{model}_0_{frame}" + ("-error" if error else "")


def temporal_slice_map(grid, cut, axis_index, plane_position):
    """Recover exact source-edge interpolation, checked against each cut point."""
    owners = array.array("q", [-1]) * cut.GetNumberOfPoints()
    provenance = cut.GetCellData().GetArray(CELL_IDS)
    cells = cut.GetPolys()
    ids = vtk.vtkIdList()
    cells.InitTraversal()
    index = 0
    while cells.GetNextCell(ids):
        owner = int(provenance.GetValue(index))
        for j in range(ids.GetNumberOfIds()):
            owners[ids.GetId(j)] = owner
        index += 1
    first, second, fractions = array.array("q"), array.array("q"), array.array("d")
    maximum_residual = 0.0
    for point_id, owner in enumerate(owners):
        require(owner >= 0, "Orphan slice vertex")
        cell = grid.GetCell(owner)
        point = cut.GetPoint(point_id)
        source_ids = [cell.GetPointId(i) for i in range(4)]
        source_points = [grid.GetPoint(i) for i in source_ids]
        best = None
        for left, right in ((0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)):
            pa, pb = source_points[left], source_points[right]
            denominator = pb[axis_index] - pa[axis_index]
            if not denominator:
                continue
            t = (plane_position - pa[axis_index]) / denominator
            if not -1e-7 <= t <= 1 + 1e-7:
                continue
            t = min(1.0, max(0.0, t))
            discrepancy = math.dist(point, [pa[i] * (1 - t) + pb[i] * t for i in range(3)])
            if best is None or discrepancy < best[0]:
                best = (discrepancy, source_ids[left], source_ids[right], t)
        require(best is not None, "No source edge crosses the cut point")
        discrepancy, a, b, t = best
        maximum_residual = max(maximum_residual, discrepancy)
        require(discrepancy < 1e-6, f"Edge interpolation does not reproduce cut geometry: {discrepancy}")
        first.append(a)
        second.append(b)
        fractions.append(t)
    return first, second, fractions, maximum_residual


class TemporalInterpolator:
    def __init__(self, mappings):
        self.first, self.second = vtk.vtkIdList(), vtk.vtkIdList()
        self.fractions = vtk.vtkDoubleArray()
        self.fractions.SetName("fraction")
        count = sum(len(mapping[0]) for mapping in mappings)
        self.first.SetNumberOfIds(count)
        self.second.SetNumberOfIds(count)
        self.fractions.SetNumberOfTuples(count)
        index = 0
        for first, second, fractions in mappings:
            for a, b, t in zip(first, second, fractions):
                self.first.SetId(index, a)
                self.second.SetId(index, b)
                self.fractions.SetValue(index, t)
                index += 1
        self.a, self.b = vtk.vtkDoubleArray(), vtk.vtkDoubleArray()
        for name, field in [("endpoint_a", self.a), ("endpoint_b", self.b)]:
            field.SetName(name)
            field.SetNumberOfComponents(3)
            field.SetNumberOfTuples(count)
        points = vtk.vtkPoints()
        points.SetNumberOfPoints(count)
        self.polydata = vtk.vtkPolyData()
        self.polydata.SetPoints(points)
        for field in [self.a, self.b, self.fractions]:
            self.polydata.GetPointData().AddArray(field)
        self.calculator = vtk.vtkArrayCalculator()
        self.calculator.SetInputData(self.polydata)
        self.calculator.AddVectorVariable("A", "endpoint_a")
        self.calculator.AddVectorVariable("B", "endpoint_b")
        self.calculator.AddScalarVariable("t", "fraction", 0)
        self.calculator.SetFunction("mag(A*(1-t)+B*t)")
        self.calculator.SetResultArrayName("magnitude")
        self.calculator.SetResultArrayType(vtk.VTK_FLOAT)

    def interpolate(self, source):
        source.GetTuples(self.first, self.a)
        source.GetTuples(self.second, self.b)
        self.a.Modified()
        self.b.Modified()
        self.polydata.Modified()
        self.calculator.Modified()
        require(not run(self.calculator), "Temporal interpolation failed")
        result = self.calculator.GetOutput().GetPointData().GetArray("magnitude")
        require(result is not None, "Missing interpolated magnitude")
        raw = memoryview(result).cast("B").tobytes()
        if sys.byteorder != "little":
            values = array.array("f")
            values.frombytes(raw)
            values.byteswap()
            raw = values.tobytes()
        return raw


def little_bytes(values):
    if sys.byteorder == "little":
        return values.tobytes()
    copy = array.array(values.typecode, values)
    copy.byteswap()
    return copy.tobytes()


def decode_series_bytes(raw):
    require(len(raw) >= 16, "Truncated series header")
    magic, vertices, frames, fields = struct.unpack_from("<4I", raw)
    require(vertices > 0 and frames >= 2 and fields in (1, 2), "Invalid series dimensions")
    count = vertices * frames * fields
    values = array.array("f")
    if magic == SERIES_MAGIC:
        require(len(raw) == 16 + count * 4, "Invalid float32 series length")
        stride, previous = vertices * fields * 4, 0
        for frame in range(frames):
            encoded = raw[16 + frame * stride:16 + (frame + 1) * stride]
            previous ^= int.from_bytes(encoded, "little")
            values.frombytes(previous.to_bytes(stride, "little"))
        if sys.byteorder != "little":
            values.byteswap()
    elif magic == COMPACT_SERIES_MAGIC:
        offset = 16 + fields * 8
        require(len(raw) == offset + count * 2, "Invalid uint16 series length")
        maxima = struct.unpack_from("<" + "d" * fields, raw, 16)
        require(all(math.isfinite(value) and value >= 0 for value in maxima), "Invalid quantization range")
        low, high = memoryview(raw)[offset:offset + count], memoryview(raw)[offset + count:]
        stride = vertices * fields
        previous = array.array("H", [0]) * stride
        for frame in range(frames):
            for field, maximum in enumerate(maxima):
                start = (frame * fields + field) * vertices
                step = maximum / 65535
                for i in range(start, start + vertices):
                    slot = i - frame * stride
                    code = ((low[i] | high[i] << 8) + previous[slot]) & 65535
                    previous[slot] = code
                    values.append(code * step)
    else:
        raise ValueError("Unsupported time-series header")
    require(all(math.isfinite(value) and value >= 0 for value in values), "Invalid temporal scalar")
    return vertices, frames, fields, values


def validate_series_file(path, vertices, fields, frames, expected_digest=None):
    decoded_vertices, decoded_frames, decoded_fields, values = decode_series_bytes(gzip.decompress(path.read_bytes()))
    require((decoded_vertices, decoded_frames, decoded_fields) == (vertices, frames, fields),
            f"Invalid series dimensions: {path}")
    digest = hashlib.sha256(little_bytes(values)).hexdigest()
    require(expected_digest is None or digest == expected_digest, f"Temporal round-trip mismatch: {path}")
    return {"vertices": vertices, "fields": fields, "frames": frames,
            "bytes": path.stat().st_size, "sha256": file_hash(path),
            "decodedSha256": digest}


def compact_temporal_source(output, sample, audit):
    """Compact legacy fields; retain geometry, every frame, and the display scales."""
    if sample.get("seriesEncoding") == COMPACT_ENCODING:
        return []
    obsolete, records, replacements = [], [], {}
    total_before = total_after = 0
    for old in audit["series"]:
        path = output / old["path"]
        vertices, frames, fields, reference = decode_series_bytes(gzip.decompress(path.read_bytes()))
        original_digest = hashlib.sha256(little_bytes(reference)).hexdigest()
        require(original_digest == old["decodedSha256"], "Original series checksum mismatch")
        maxima = [max(max(reference[(frame * fields + field) * vertices:(frame * fields + field + 1) * vertices])
                      for frame in range(frames)) for field in range(fields)]
        codes = array.array("H")
        for frame in range(frames):
            for field, maximum in enumerate(maxima):
                start = (frame * fields + field) * vertices
                factor = 65535 / maximum if maximum else 0
                codes.extend(int(value * factor + .5) for value in reference[start:start + vertices])
        stride = vertices * fields
        deltas = array.array("H", ((code - codes[i - stride]) & 65535 if i >= stride else code for i, code in enumerate(codes)))
        packed = little_bytes(deltas)
        encoded = struct.pack("<4I", COMPACT_SERIES_MAGIC, vertices, frames, fields)
        encoded += struct.pack("<" + "d" * fields, *maxima) + packed[0::2] + packed[1::2]
        _, _, _, reconstructed = decode_series_bytes(encoded)
        errors = [0.0] * fields
        for frame in range(frames):
            for field in range(fields):
                start = (frame * fields + field) * vertices
                error = max(abs(a - b) for a, b in zip(reference[start:start + vertices], reconstructed[start:start + vertices]))
                errors[field] = max(errors[field], error)
        bounds = [maximum / 131070 + maximum * 2**-24 for maximum in maxima]
        require(all(error <= bound + 1e-12 for error, bound in zip(errors, bounds)), "Quantization error exceeds its bound")
        relative = old["path"].removesuffix(".series.gz") + ".u16.series.gz"
        target = output / relative
        temporary = target.with_suffix(target.suffix + ".tmp")
        temporary.write_bytes(gzip.compress(encoded, compresslevel=9, mtime=0))
        stats = validate_series_file(temporary, vertices, fields, frames, hashlib.sha256(little_bytes(reconstructed)).hexdigest())
        temporary.replace(target)
        records.append({"path": relative, **stats, "originalDecodedSha256": original_digest,
                        "originalBytes": old["bytes"], "fieldMaxima": maxima,
                        "maxAbsoluteErrorByField": errors, "absoluteErrorBounds": bounds})
        total_before += old["bytes"]
        total_after += stats["bytes"]
        replacements[old["path"]] = relative
        obsolete.append(path)
        if len(records) % 45 == 0:
            print(f"{sample['id']}: compacted {len(records)}/{len(audit['series'])} series", flush=True)
    for entries in sample["series"].values():
        for entry in entries:
            entry["gt"] = replacements[entry["gt"]]
            entry["models"] = {model: replacements[path] for model, path in entry["models"].items()}
    sample["seriesEncoding"] = COMPACT_ENCODING
    sample["scalarStorage"] = {"bits": 16, "range": "One maximum per field and slice, shared across all frames",
                               "maxAbsoluteErrorCmPerSecond": max(max(record["maxAbsoluteErrorByField"]) for record in records)}
    audit["series"] = records
    audit["compression"] = {"encoding": COMPACT_ENCODING, "originalSeriesBytes": total_before,
                             "compactSeriesBytes": total_after, "geometryUnchanged": True,
                             "maxAbsoluteErrorCmPerSecond": sample["scalarStorage"]["maxAbsoluteErrorCmPerSecond"]}
    print(f"{sample['id']}: {total_before / 1024**2:.2f} → {total_after / 1024**2:.2f} MiB; "
          f"maximum rounding {sample['scalarStorage']['maxAbsoluteErrorCmPerSecond']:.8f} cm/s", flush=True)
    return obsolete


def prepare_temporal_source(path, output, source_hash):
    started = time.monotonic()
    identity = identify_source(path)
    sample_id, frames = identity["id"], identity["timeSteps"]
    entries = index_vtu_arrays(path)
    expected_fields = [temporal_field_name(field, frame) for field in FIELD_ORDER for frame in range(frames)]
    require(all(field in entries for field in expected_fields), "Missing temporal model/frame fields")
    print(f"{sample_id}: indexed {len(expected_fields)} vector arrays", flush=True)
    reader = vtk.vtkXMLUnstructuredGridReader()
    reader.SetFileName(str(path))
    reader.UpdateInformation()
    reader.GetPointDataArraySelection().DisableAllArrays()
    require(not run(reader), "Temporal geometry reader failed")
    grid = reader.GetOutput()
    points, cells = grid.GetNumberOfPoints(), grid.GetNumberOfCells()
    require(all(grid.GetCellType(i) == vtk.VTK_TETRA for i in range(cells)),
            "Temporal source currently requires tetrahedral cells")
    used = bytearray(points)
    connectivity = grid.GetCells().GetConnectivityArray()
    for i in range(connectivity.GetNumberOfValues()):
        used[int(connectivity.GetValue(i))] = 1
    require(all(used), "Temporal source contains unused points; ranges need a used-point mask")
    bounds = grid.GetBounds()
    center = [(bounds[2 * i] + bounds[2 * i + 1]) / 2 for i in range(3)]
    scale = 2 / max(bounds[2 * i + 1] - bounds[2 * i] for i in range(3))
    provenance = vtk.vtkIdTypeArray()
    provenance.SetName(CELL_IDS)
    provenance.SetNumberOfTuples(cells)
    cell_bounds = [array.array("d") for _ in range(6)]
    for index in range(cells):
        provenance.SetValue(index, index)
        box = [0.0] * 6
        grid.GetCellBounds(index, box)
        for i, value in enumerate(box):
            cell_bounds[i].append(value)
    grid.GetCellData().AddArray(provenance)
    surface = vtk.vtkDataSetSurfaceFilter()
    surface.SetInputData(grid)
    require(not run(surface), "Temporal original shell extraction failed")
    shell_path = f"{sample_id}/shell.bin.gz"
    shell_stats = write_geometry(output / shell_path, surface.GetOutput(), center, scale, [])
    sample = add_temporal_metadata({**identity, "seriesEncoding": LOSSLESS_ENCODING, "shell": shell_path,
        "slices": {axis: [] for axis in "xyz"}, "series": {axis: [] for axis in "xyz"},
        "velocityRange": [0, 0], "errorRange": [0, 0],
        "defaultAxis": "x", "defaultSlice": 7, "center": center, "scale": scale,
        "sourceBounds": list(bounds), "fallbackSliceCount": 0,
        "source": {"filename": path.name, "sha256": source_hash, "pointCount": points,
                   "cellCount": cells, "excludedOrphanPoints": 0}})
    audit = {"id": sample_id, "shell": shell_stats, "slices": [], "series": [],
             "sourceErrorResidualByModel": {}, "fieldRanges": {},
             "temporalFrameIndices": list(range(frames)),
             "errorSemantics": "The supplied instantaneous three-component error fields are interpolated before taking their L2 magnitude. No error is recomputed from scalar speeds.",
             "timeMetadata": "The source provides frame indices 0–20 but no physical time coordinates or heartbeat duration.",
             "interpolation": "Exact linear source-edge weights are recovered once from VTK cuts and reused for every time frame. Coordinates and interpolated first-frame GT are cross-checked against VTK."}
    mappings, slices, offset = [], [], 0
    first_cut = None
    for axis_index, axis in enumerate("xyz"):
        for index, fraction in enumerate(FRACTIONS):
            position = bounds[2 * axis_index] + fraction * (bounds[2 * axis_index + 1] - bounds[2 * axis_index])
            origin = center.copy()
            origin[axis_index] = position
            normal = [0, 0, 0]
            normal[axis_index] = 1
            plane = vtk.vtkPlane()
            plane.SetOrigin(origin)
            plane.SetNormal(normal)
            cutter = vtk.vtkCutter()
            cutter.SetInputData(grid)
            cutter.SetCutFunction(plane)
            cutter.SetOutputPointsPrecision(vtk.vtkAlgorithm.DOUBLE_PRECISION)
            require(not run(cutter), "Temporal source cut reported a warning")
            cut = triangulate(cutter.GetOutput())
            expected = {i for i, (lo, hi) in enumerate(zip(*cell_bounds[2 * axis_index:2 * axis_index + 2]))
                        if lo < position < hi}
            require(expected <= source_cell_ids(cut), "Temporal cut omitted source cells")
            first, second, fractions, residual = temporal_slice_map(grid, cut, axis_index, position)
            mappings.append((first, second, fractions))
            filename = f"{sample_id}/{axis}-{index:02d}.bin.gz"
            stats = write_geometry(output / filename, cut, center, scale, [])
            details = {"axis": axis, "index": index, "fraction": fraction, "position": position,
                       "expectedSourceCells": len(expected), "tetrahedralizedSourceCells": [],
                       "edgeCoordinateResidual": residual, **stats}
            audit["slices"].append(details)
            sample["slices"][axis].append(filename)
            sample["series"][axis].append({"gt": f"{sample_id}/{axis}-{index:02d}-GT.series.gz",
                "models": {model: f"{sample_id}/{axis}-{index:02d}-{model}.series.gz" for model, _ in MODEL_LABELS}})
            slices.append({"axis": axis, "index": index, "vertices": stats["vertices"], "offset": offset})
            offset += stats["vertices"]
            if first_cut is None:
                first_cut = (plane, cut, stats["vertices"])
        print(f"{sample_id}: prepared {axis.upper()} geometry and interpolation maps ({time.monotonic() - started:.1f}s)", flush=True)
    sample["defaultAxis"] = max((s for s in audit["slices"] if s["index"] == 7), key=lambda s: s["area"])["axis"]
    interpolator = TemporalInterpolator(mappings)
    del mappings, cell_bounds
    velocity_max = error_max = 0.0
    # One family at a time keeps all 21 frames available together in the browser,
    # without downloading unselected models or retaining all source arrays in RAM.
    with path.open("rb") as handle:
        for model in ["GT"] + [name for name, _ in MODEL_LABELS]:
            fields = ["GT"] if model == "GT" else [model, model + "-error"]
            streams, files, previous, digests = [], [], [], []
            for item in slices:
                record = sample["series"][item["axis"]][item["index"]]
                relative = record["gt"] if model == "GT" else record["models"][model]
                filename = output / relative
                files.append((filename, relative))
                stream = gzip.GzipFile(filename=str(filename), mode="wb", compresslevel=6, mtime=0)
                stream.write(struct.pack("<4I", SERIES_MAGIC, item["vertices"], frames, len(fields)))
                streams.append(stream)
                previous.append(0)
                digests.append(hashlib.sha256())
            try:
                for frame in range(frames):
                    scalar_fields = []
                    for field in fields:
                        name = temporal_field_name(field, frame)
                        source, buffer = read_vtu_vector(handle, entries[name], points)
                        maximum = source.GetRange(-1)[1]
                        require(math.isfinite(maximum) and maximum >= 0, "Invalid source magnitude range")
                        audit["fieldRanges"][name] = [0, maximum]
                        if field.endswith("-error"):
                            require(all(value >= 0 for value in buffer), "Negative supplied absolute error component")
                            error_max = max(error_max, maximum)
                        else:
                            velocity_max = max(velocity_max, maximum)
                        scalars = interpolator.interpolate(source)
                        if model == "GT" and frame == 0:
                            plane, original_cut, count = first_cut
                            source.SetName("_validation_gt")
                            grid.GetPointData().AddArray(source)
                            check = vtk.vtkCutter()
                            check.SetInputData(grid)
                            check.SetCutFunction(plane)
                            check.SetOutputPointsPrecision(vtk.vtkAlgorithm.DOUBLE_PRECISION)
                            require(not run(check), "VTK interpolation validation failed")
                            check_cut = triangulate(check.GetOutput())
                            require(check_cut.GetNumberOfPoints() == count, "Validation cut point count changed")
                            values = check_cut.GetPointData().GetArray("_validation_gt")
                            calculated = array.array("f")
                            calculated.frombytes(scalars[:count * 4])
                            if sys.byteorder != "little":
                                calculated.byteswap()
                            residual = max(abs(calculated[i] - math.hypot(*values.GetTuple3(i))) for i in range(count))
                            require(residual < 2e-6 * max(1, maximum), "Edge interpolation differs from VTK")
                            audit["vtkFirstFrameMagnitudeResidual"] = residual
                            grid.GetPointData().RemoveArray("_validation_gt")
                        scalar_fields.append(scalars)
                    for i, item in enumerate(slices):
                        start, length = item["offset"] * 4, item["vertices"] * 4
                        raw = b"".join(values[start:start + length] for values in scalar_fields)
                        digests[i].update(raw)
                        original = int.from_bytes(raw, "little")
                        encoded = original ^ previous[i]
                        previous[i] = original
                        streams[i].write(encoded.to_bytes(len(raw), "little"))
                    if frame in (0, 10, 20):
                        print(f"{sample_id}: {model} frame {frame + 1}/{frames} ({time.monotonic() - started:.1f}s)", flush=True)
            finally:
                for stream in streams:
                    stream.close()
            total = 0
            for item, (filename, relative), digest in zip(slices, files, digests):
                stats = validate_series_file(filename, item["vertices"], len(fields), frames, digest.hexdigest())
                audit["series"].append({"path": relative, **stats})
                total += stats["bytes"]
            sample["velocityRange"], sample["errorRange"] = [0, velocity_max], [0, error_max]
            print(f"{sample_id}: validated {model} series, {total / 1024**2:.2f} MiB ({time.monotonic() - started:.1f}s)", flush=True)
            # Staging metadata is outside published assets and never replaces the
            # complete site manifest before all model families have succeeded.
            (Path("/private/tmp") / f"{sample_id}-partial.json").write_text(json.dumps(sample, indent=2))
    audit["sourceErrorResidual"] = None
    audit["providedErrorsMatchAbsoluteDifference"] = None
    audit["errorEquivalenceCheck"] = "Not assumed: every supplied frame/error array is preserved and validated for finite, nonnegative components. Scalar errors are not replaced or derived from magnitudes."
    audit["elapsedSeconds"] = round(time.monotonic() - started, 2)
    return sample, audit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sources", type=Path, nargs="*")
    parser.add_argument("--output", type=Path, default=ROOT / "assets/data/abgatr-demo")
    parser.add_argument("--force", action="store_true", help="Regenerate even unchanged, validated cases")
    parser.add_argument("--lossless", action="store_true", help="Keep original float32 temporal scalars instead of compact uint16 storage")
    args = parser.parse_args()
    previous = previous_audit = {}
    try:
        previous = json.loads((args.output / "manifest.json").read_text())
        previous_audit = json.loads((args.output / "audit.json").read_text())
    except (OSError, ValueError):
        pass
    defaults = [ROOT / name for name in DEFAULT_SOURCES]
    defaults += [ROOT / sample["source"]["filename"] for sample in previous.get("samples", []) if sample.get("timeSteps")]
    defaults += sorted(ROOT.glob("AAA[0-9]*-T-combined.vtu"))
    sources = args.sources or list(dict.fromkeys(defaults))
    requested_ids = [identify_source(path)["id"] for path in sources]
    require(len(requested_ids) == len(set(requested_ids)), "Duplicate sample IDs in requested sources")
    vtk.vtkLogger.SetStderrVerbosity(vtk.vtkLogger.VERBOSITY_OFF)
    args.output.mkdir(parents=True, exist_ok=True)
    samples, audits, obsolete = [], [], []
    for path in sources:
        stored = next((s for s in previous.get("samples", []) if s["id"] == identify_source(path)["id"]), None)
        source_hash = file_hash(path) if path.is_file() else stored.get("source", {}).get("sha256") if stored else None
        reused = None if args.force else cached_source(path, args.output, previous, previous_audit, source_hash)
        if reused and args.lossless and reused[0].get("seriesEncoding") == COMPACT_ENCODING:
            reused = None
        if reused:
            sample, audit = reused
            count = 46 + len(audit.get("series", []))
            print(f"{sample['dataset']} / {sample['id']}: reused {count} validated assets", flush=True)
        else:
            print(f"Preparing {path.name}", flush=True)
            require(path.is_file(), f"Source absent and no validated cache available: {path}")
            if identify_source(path).get("timeSteps"):
                sample, audit = prepare_temporal_source(path, args.output, source_hash)
            else:
                sample, audit = prepare_source(path, args.output, source_hash)
        if sample.get("timeSteps") and not args.lossless:
            obsolete += compact_temporal_source(args.output, sample, audit)
        samples.append(sample)
        audits.append(audit)
        gc.collect()
    require(len({sample["id"] for sample in samples}) == len(samples), "Duplicate sample IDs")
    manifest = {
        "formatVersion": 2, "units": "cm/s", "fieldOrder": FIELD_ORDER,
        "datasets": DATASETS,
        "models": [{"id": name, "label": label, "errorField": name + "-error"}
                   for name, label in MODEL_LABELS],
        "fractions": FRACTIONS, "samples": samples,
        "interpolation": "VTK plane cuts interpolate the supplied three-component arrays; the viewer displays their L2 magnitudes. Only source cells that cannot be directly contoured are tetrahedralized, with cell coverage and volume conservation checked.",
        "sourceUnits": "Values are already cm/s, confirmed by the dataset owner; no scalar unit conversion is applied.",
        "vtkVersion": vtk.vtkVersion.GetVTKVersion(),
    }
    # Publish the manifest only after every requested case has completed.
    for filename, payload in [("audit.json", {"formatVersion": 2, "samples": audits}), ("manifest.json", manifest)]:
        temporary = args.output / ("." + filename + ".tmp")
        temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
        temporary.replace(args.output / filename)
    # Remove only replaced temporal derivatives after the complete manifest is ready.
    referenced = {path for sample in samples for entries in sample.get("series", {}).values()
                  for entry in entries for path in [entry["gt"], *entry["models"].values()]}
    obsolete += [args.output / record["path"] for audit in previous_audit.get("samples", [])
                 if audit["id"] in requested_ids for record in audit.get("series", []) if record["path"] not in referenced]
    for path in set(obsolete):
        if path.relative_to(args.output).as_posix() not in referenced:
            path.unlink(missing_ok=True)
    # Old averaged AAA derivatives are obsolete only after the new manifest is complete.
    retained = {sample["id"] for sample in samples}
    for old_id in ("AAA021", "AAA048", "AAA090"):
        old = args.output / old_id
        if old_id not in retained and old.is_dir():
            shutil.rmtree(old)
    total = sum(path.stat().st_size for path in args.output.rglob("*") if path.is_file())
    print(f"Prepared {len(samples)} cases and {len(samples) * len(FRACTIONS) * 3} complete cuts; {total / 1024**2:.2f} MiB", flush=True)


if __name__ == "__main__":
    main()

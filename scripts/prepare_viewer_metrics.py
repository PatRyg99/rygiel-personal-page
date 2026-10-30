#!/usr/bin/env python3
"""Prepare global relative L2 vector errors for the vascular viewer.

The reported percentage is 100 * ||GT - prediction||_2 / ||GT||_2, using one
Euclidean norm over all selected vector components. Prediction errors at exactly
zero reference vectors are included. Only source vertices not represented by
cells are excluded. Slice results use the prepared slice vertices, including any
duplicate vertices retained by the faithful polyhedron-cut fallback. No volume
or surface-area weights apply. Counts describe nonzero-reference vertices for
diagnostics; they do not mask prediction errors. A selection with zero reference
norm has no defined percentage, but its error norm still contributes when time
frames are combined with other frames having a nonzero reference norm.
volumeRelativeL2 combines every volume vertex and every available time frame in
one norm ratio; it never averages pointwise ratios or per-frame percentages.
slicesRelativeL2 retains a full-cycle result for each prepared slice for auditing.
The viewer uses per-frame slices values for the displayed slice and timestep,
while the displayed volume error uses the complete cycle.

Original double-precision vectors are used before any viewer scalar quantization
or colour clipping. Vector components are interpolated before evaluating the
slice error. Supplied -error fields are deliberately not used for this metric.

Requires Python 3 and VTK; uses the existing preparation pipeline without editing
geometry, scalar bundles, manifest, or audit. Run with no arguments for all cases;
positional sample IDs update selected cases while preserving the other records.
--validate-only checks metadata coverage and geometry checksums without the raw
VTUs. Normal runs also recheck available source checksums before reusing results.
"""

import argparse
import array
from contextlib import contextmanager
import gc
import hashlib
import json
import math
from pathlib import Path
import tempfile
import time

import vtk

import prepare_aneumo as source

MODELS = [name for name, _ in source.MODEL_LABELS]
HEADER = {
    "version": 4,
    "definition": "100 * norm(GT - prediction) / norm(GT)",
    "aggregation": "global L2 norm over selected vector components; whole-cycle volume uses all frames in one norm ratio",
    "zeroReferencePolicy": "include zero-GT prediction errors",
}
require = source.require


def reference_magnitudes(reference, used=None):
    require(len(reference) % 3 == 0, "Vectors must have three components")
    count = len(reference) // 3
    require(used is None or len(used) == count, "Used-point mask length mismatch")
    result = array.array("d")
    for vertex in range(count):
        start = vertex * 3
        norm = math.hypot(reference[start], reference[start + 1], reference[start + 2])
        require(math.isfinite(norm), "Nonfinite reference vector")
        result.append(norm if used is None or used[vertex] else 0.0)
    return result


def percent_from_norms(error_norm, reference_norm):
    require(all(type(value) in (float, int) and math.isfinite(value) and value >= 0
                for value in (error_norm, reference_norm)), "Invalid global L2 norm")
    percentage = 100 * (error_norm / reference_norm) if reference_norm else None
    require(percentage is None or math.isfinite(percentage), "Nonfinite relative L2 error")
    return percentage


def relative_l2_percent(reference, prediction, used=None, *, magnitudes=None,
                        start=0, count=None):
    """Return (percentage or None, nonzero-GT count, reference norm, error norm).

    start/count select vertices in flattened, three-component vector arrays.
    Precomputed magnitudes may include a source-cell participation mask, but the
    used mask must also be passed to exclude orphan prediction errors. A zero
    reference magnitude never excludes an otherwise represented vertex.
    """
    require(len(reference) == len(prediction) and len(reference) % 3 == 0,
            "Reference/prediction vector length mismatch")
    if magnitudes is None:
        magnitudes = reference_magnitudes(reference, used)
    require(len(magnitudes) * 3 == len(reference), "Magnitude length mismatch")
    require(used is None or len(used) == len(magnitudes), "Used-point mask length mismatch")
    count = len(magnitudes) - start if count is None else count
    require(0 <= start <= start + count <= len(magnitudes), "Invalid vertex range")
    errors = array.array("d")
    valid = 0
    for vertex in range(start, start + count):
        if used is not None and not used[vertex]:
            continue
        valid += magnitudes[vertex] != 0
        offset = vertex * 3
        errors.append(math.hypot(reference[offset] - prediction[offset],
                                 reference[offset + 1] - prediction[offset + 1],
                                 reference[offset + 2] - prediction[offset + 2]))
    # Nested hypot evaluates the same flattened Euclidean norm without squaring
    # tiny components to zero or overflowing intermediate sums of squares.
    reference_norm = math.hypot(*(magnitudes[vertex] for vertex in range(start, start + count)
                                  if used is None or used[vertex]))
    error_norm = math.hypot(*errors)
    return percent_from_norms(error_norm, reference_norm), valid, reference_norm, error_norm


def vector_buffer(field):
    require(field is not None and field.GetNumberOfComponents() == 3,
            "Missing three-component vector field")
    values = array.array("d")
    if field.GetDataType() == vtk.VTK_DOUBLE:
        # VTK's Python buffer uses native byte order, as does array('d').
        values.frombytes(memoryview(field).cast("B"))
    else:
        for vertex in range(field.GetNumberOfTuples()):
            values.extend(field.GetTuple3(vertex))
    require(len(values) == field.GetNumberOfTuples() * 3, "Invalid vector buffer")
    return values


def preparation_fingerprint(sample, audit, manifest):
    provenance = {
        "metricVersion": HEADER["version"],
        "source": sample["source"], "frames": sample.get("timeSteps", 1),
        "fractions": manifest["fractions"], "slices": sample["slices"],
        "center": sample["center"], "scale": sample["scale"],
        "sourceBounds": sample["sourceBounds"], "models": MODELS,
        "geometry": [{key: row[key] for key in
                      ("axis", "index", "fraction", "position", "vertices", "triangles", "sha256")}
                     for row in audit["slices"]],
    }
    return hashlib.sha256(json.dumps(provenance, sort_keys=True,
                                     separators=(",", ":")).encode()).hexdigest()


def new_record(sample, audit, manifest):
    def slices():
        return {axis: [[] for _ in manifest["fractions"]] for axis in "xyz"}
    return {
        "sourceSha256": sample["source"]["sha256"],
        "preparationSha256": preparation_fingerprint(sample, audit, manifest),
        "frameCount": sample.get("timeSteps", 1),
        "volumeReferenceNorms": [],
        "sliceReferenceNorms": slices(),
        "counts": {"volume": [], "slices": slices()},
        "models": {model: {"volume": [], "volumeErrorNorms": [], "slices": slices(),
                           "sliceErrorNorms": slices()} for model in MODELS},
    }


def add_volume_relative_l2(record):
    """Combine frame norms as one concatenated space-time tensor norm ratio."""
    reference_norm = math.hypot(*record["volumeReferenceNorms"])
    for entry in record["models"].values():
        entry["volumeRelativeL2"] = percent_from_norms(math.hypot(*entry["volumeErrorNorms"]), reference_norm)
    record["counts"]["volumeAllFrames"] = sum(record["counts"]["volume"])


def add_slice_relative_l2(record):
    """Combine each slice's vectors over the complete cycle in one norm ratio."""
    for entry in record["models"].values():
        entry["slicesRelativeL2"] = {
            axis: [percent_from_norms(math.hypot(*entry["sliceErrorNorms"][axis][index]),
                                     math.hypot(*reference_norms))
                   for index, reference_norms in enumerate(record["sliceReferenceNorms"][axis])]
            for axis in "xyz"
        }


def validate_geometry_checksums(sample, audit, output):
    require(len(audit["slices"]) == len(source.FRACTIONS) * 3, "Incomplete geometry audit")
    seen = set()
    for row in audit["slices"]:
        key = row["axis"], row["index"]
        require(key not in seen, "Duplicate geometry audit entry")
        seen.add(key)
        filename = output / sample["slices"][row["axis"]][row["index"]]
        require(source.file_hash(filename) == row["sha256"],
                f"Prepared slice checksum changed: {filename}")
    require(seen == {(axis, i) for axis in "xyz" for i in range(len(source.FRACTIONS))},
            "Incomplete slice geometry coverage")


def validate_record(record, sample, audit, manifest):
    require(record["sourceSha256"] == sample["source"]["sha256"], "Stale metric source checksum")
    require(record["preparationSha256"] == preparation_fingerprint(sample, audit, manifest),
            "Stale slice provenance; regenerate metrics")
    frames = sample.get("timeSteps", 1)
    require(record["frameCount"] == frames, "Metric frame count mismatch")
    require(set(record["models"]) == set(MODELS), "Metric model coverage mismatch")
    slice_counts = {(row["axis"], row["index"]): row["vertices"] for row in audit["slices"]}
    volume_count = sample["source"]["pointCount"] - sample["source"]["excludedOrphanPoints"]

    def check_counts(values, maximum):
        require(len(values) == frames, "Count frame coverage mismatch")
        require(all(type(value) is int and 0 <= value <= maximum for value in values),
                "Invalid valid-reference count")

    def check_values(values, counts):
        require(len(values) == frames, "Metric frame coverage mismatch")
        for value, count in zip(values, counts):
            require((value is None and count == 0) or
                    (type(value) in (float, int) and math.isfinite(value) and value >= 0 and count > 0),
                    "Invalid metric percentage or empty-reference handling")

    def check_reference_norms(values, counts):
        require(len(values) == frames, "Reference norm frame coverage mismatch")
        require(all(type(value) in (float, int) and math.isfinite(value) and value >= 0 and
                    ((value == 0) == (count == 0)) for value, count in zip(values, counts)),
                "Invalid reference norm or diagnostic count")

    def check_norm_ratios(values, error_norms, reference_norms, full_cycle):
        require(len(error_norms) == frames, "Error norm frame coverage mismatch")
        expected_values = [percent_from_norms(error, reference)
                           for error, reference in zip(error_norms, reference_norms)]
        expected_cycle = percent_from_norms(math.hypot(*error_norms), math.hypot(*reference_norms))
        for value, expected in zip(values + [full_cycle], expected_values + [expected_cycle]):
            require((expected is None and value is None) or
                    (expected is not None and type(value) in (float, int) and math.isfinite(value) and
                     math.isclose(value, expected, rel_tol=1e-12, abs_tol=1e-12)),
                    "Global L2 percentage differs from its stored norm provenance")

    counts = record["counts"]
    check_counts(counts["volume"], volume_count)
    require("volumeMean" not in counts and all("volumeMean" not in entry for entry in record["models"].values()),
            "Obsolete pointwise-mean metric fields")
    reference_norms = record["volumeReferenceNorms"]
    check_reference_norms(reference_norms, counts["volume"])
    require(type(counts.get("volumeAllFrames")) is int and counts["volumeAllFrames"] == sum(counts["volume"]),
            "Missing or inconsistent full-cycle valid-reference count")
    require(set(counts["slices"]) == set("xyz"), "Count axis coverage mismatch")
    require(set(record["sliceReferenceNorms"]) == set("xyz"), "Reference norm axis coverage mismatch")
    for axis in "xyz":
        require(len(counts["slices"][axis]) == len(manifest["fractions"]), "Count slice coverage mismatch")
        require(len(record["sliceReferenceNorms"][axis]) == len(manifest["fractions"]),
                "Reference norm slice coverage mismatch")
        for index, values in enumerate(counts["slices"][axis]):
            check_counts(values, slice_counts[axis, index])
            check_reference_norms(record["sliceReferenceNorms"][axis][index], values)
    for model in MODELS:
        entry = record["models"][model]
        check_values(entry["volume"], counts["volume"])
        check_norm_ratios(entry["volume"], entry["volumeErrorNorms"], reference_norms, entry["volumeRelativeL2"])
        require(set(entry["slices"]) == set("xyz"), "Metric axis coverage mismatch")
        require(set(entry["sliceErrorNorms"]) == set("xyz"), "Error norm axis coverage mismatch")
        require(set(entry["slicesRelativeL2"]) == set("xyz"), "Full-cycle slice axis coverage mismatch")
        for axis in "xyz":
            require(len(entry["slices"][axis]) == len(manifest["fractions"]), "Metric slice coverage mismatch")
            require(len(entry["sliceErrorNorms"][axis]) == len(manifest["fractions"]),
                    "Error norm slice coverage mismatch")
            require(len(entry["slicesRelativeL2"][axis]) == len(manifest["fractions"]),
                    "Full-cycle slice coverage mismatch")
            for index, values in enumerate(entry["slices"][axis]):
                check_values(values, counts["slices"][axis][index])
                check_norm_ratios(values, entry["sliceErrorNorms"][axis][index],
                                  record["sliceReferenceNorms"][axis][index], entry["slicesRelativeL2"][axis][index])


@contextmanager
def scoped_static_hooks(writer, validator):
    original_writer = source.write_geometry
    original_validator = source.scalar_ranges_and_validation
    source.write_geometry = writer
    source.scalar_ranges_and_validation = validator
    try:
        yield original_writer, original_validator
    finally:
        source.write_geometry = original_writer
        source.scalar_ranges_and_validation = original_validator


def prepare_static(path, sample, audit, manifest):
    record = new_record(sample, audit, manifest)
    slices = {(row["axis"], row["index"]): row for row in audit["slices"]}
    original_writer = source.write_geometry
    original_validator = source.scalar_ranges_and_validation

    def capture_volume(grid, used):
        require(grid.GetNumberOfPoints() == sample["source"]["pointCount"] and
                grid.GetNumberOfCells() == sample["source"]["cellCount"] and
                len(used) - sum(used) == sample["source"]["excludedOrphanPoints"],
                "Static source dimensions changed")
        data = grid.GetPointData()
        reference = vector_buffer(data.GetArray("GT"))
        magnitudes = reference_magnitudes(reference, used)
        for model in MODELS:
            value, valid, reference_norm, error_norm = relative_l2_percent(
                reference, vector_buffer(data.GetArray(model)), used, magnitudes=magnitudes)
            record["models"][model]["volume"].append(value)
            record["models"][model]["volumeErrorNorms"].append(error_norm)
        record["counts"]["volume"].append(valid)
        record["volumeReferenceNorms"].append(reference_norm)
        return original_validator(grid, used)

    def capture_slice(target, polydata, center, scale, fields):
        stats = original_writer(target, polydata, center, scale, fields)
        if not fields:
            require(stats["sha256"] == audit["shell"]["sha256"], "Static shell changed")
            return stats
        axis, index = target.name.split(".")[0].split("-")
        index = int(index)
        expected = slices[axis, index]
        require(stats["sha256"] == expected["sha256"],
                f"Regenerated static slice differs from prepared asset: {target.name}")
        data = source.triangulate(polydata).GetPointData()
        reference = vector_buffer(data.GetArray("GT"))
        magnitudes = reference_magnitudes(reference)
        for model in MODELS:
            value, valid, reference_norm, error_norm = relative_l2_percent(
                reference, vector_buffer(data.GetArray(model)), magnitudes=magnitudes)
            record["models"][model]["slices"][axis][index].append(value)
            record["models"][model]["sliceErrorNorms"][axis][index].append(error_norm)
        record["counts"]["slices"][axis][index].append(valid)
        record["sliceReferenceNorms"][axis][index].append(reference_norm)
        return stats

    # Reuse the exact VTK polyhedron fallback and original interpolation. Its
    # temporary scalar files are checksum-compared, then automatically removed.
    with tempfile.TemporaryDirectory(prefix="viewer-metrics-static-") as directory:
        with scoped_static_hooks(capture_slice, capture_volume):
            source.prepare_source(path, Path(directory), sample["source"]["sha256"])
    return record


class VectorInterpolator(source.TemporalInterpolator):
    """The geometry preparer's edge weights, retaining all double components."""
    def __init__(self, mappings):
        super().__init__(mappings)
        self.calculator.SetFunction("A*(1-t)+B*t")
        self.calculator.SetResultArrayType(vtk.VTK_DOUBLE)

    def vectors(self, field):
        field.GetTuples(self.first, self.a)
        field.GetTuples(self.second, self.b)
        self.a.Modified()
        self.b.Modified()
        self.polydata.Modified()
        self.calculator.Modified()
        require(not source.run(self.calculator), "Double vector interpolation failed")
        return vector_buffer(self.calculator.GetOutput().GetPointData().GetArray("magnitude"))


def verify_vtk_interpolation(grid, plane, field, interpolated, vertices):
    """Independently cross-check edge interpolation against a native VTK cut."""
    field.SetName("_relative_metric_validation")
    grid.GetPointData().AddArray(field)
    try:
        cutter = vtk.vtkCutter()
        cutter.SetInputData(grid)
        cutter.SetCutFunction(plane)
        cutter.SetOutputPointsPrecision(vtk.vtkAlgorithm.DOUBLE_PRECISION)
        require(not source.run(cutter), "Native interpolation verification failed")
        cut = source.triangulate(cutter.GetOutput())
        require(cut.GetNumberOfPoints() == vertices, "Verification slice vertices changed")
        native = vector_buffer(cut.GetPointData().GetArray(field.GetName()))
        residual = max(abs(a - b) for a, b in zip(native, interpolated[:vertices * 3]))
        maximum = max(abs(value) for value in native)
        # vtkCutter's interpolation fractions can round differently from the
        # double edge weights used by the existing temporal asset preparer.
        # Match that preparer's native-VTK cross-check tolerance; geometry and
        # vertex order are separately required to match the original checksum.
        require(residual < 2e-6 * max(1, maximum),
                f"Double vector interpolation differs from VTK: {residual}")
        return residual
    finally:
        grid.GetPointData().RemoveArray(field.GetName())


def prepare_temporal(path, sample, audit, manifest):
    started = time.monotonic()
    record = new_record(sample, audit, manifest)
    frames = record["frameCount"]
    entries = source.index_vtu_arrays(path)
    require(all(source.temporal_field_name(field, frame) in entries
                for field in ["GT"] + MODELS for frame in range(frames)),
            "Missing temporal GT/prediction vectors")
    reader = vtk.vtkXMLUnstructuredGridReader()
    reader.SetFileName(str(path))
    reader.UpdateInformation()
    reader.GetPointDataArraySelection().DisableAllArrays()
    require(not source.run(reader), "Temporal geometry reader failed")
    grid = reader.GetOutput()
    points, cells = grid.GetNumberOfPoints(), grid.GetNumberOfCells()
    require(points == sample["source"]["pointCount"] and cells == sample["source"]["cellCount"],
            "Temporal source dimensions changed")
    require(all(grid.GetCellType(i) == vtk.VTK_TETRA for i in range(cells)),
            "Temporal source requires tetrahedral cells")
    used = bytearray(points)
    connectivity = grid.GetCells().GetConnectivityArray()
    for index in range(connectivity.GetNumberOfValues()):
        used[int(connectivity.GetValue(index))] = 1
    require(points - sum(used) == sample["source"]["excludedOrphanPoints"], "Orphan count changed")
    bounds = grid.GetBounds()
    require(list(bounds) == sample["sourceBounds"], "Source bounds changed")
    provenance = vtk.vtkIdTypeArray()
    provenance.SetName(source.CELL_IDS)
    provenance.SetNumberOfTuples(cells)
    for index in range(cells):
        provenance.SetValue(index, index)
    grid.GetCellData().AddArray(provenance)
    expected = {(row["axis"], row["index"]): row for row in audit["slices"]}
    mappings, slices, offset, first_plane = [], [], 0, None
    with tempfile.TemporaryDirectory(prefix="viewer-metrics-temporal-") as directory:
        for axis_index, axis in enumerate("xyz"):
            for index, fraction in enumerate(manifest["fractions"]):
                position = bounds[2 * axis_index] + fraction * (bounds[2 * axis_index + 1] - bounds[2 * axis_index])
                origin = sample["center"].copy()
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
                require(not source.run(cutter), "Temporal slice warning")
                cut = source.triangulate(cutter.GetOutput())
                stats = source.write_geometry(Path(directory) / f"{axis}-{index}.bin.gz",
                                               cut, sample["center"], sample["scale"], [])
                require(stats["sha256"] == expected[axis, index]["sha256"],
                        f"Regenerated temporal slice differs from prepared asset: {axis}-{index}")
                first, second, weights, _ = source.temporal_slice_map(grid, cut, axis_index, position)
                mappings.append((first, second, weights))
                slices.append((axis, index, offset, stats["vertices"]))
                offset += stats["vertices"]
                if first_plane is None:
                    first_plane = plane
            print(f"{sample['id']}: verified {axis.upper()} slices and interpolation ({time.monotonic() - started:.1f}s)", flush=True)
    interpolator = VectorInterpolator(mappings)
    del mappings
    maximum_vtk_residual = 0.0
    with path.open("rb") as handle:
        for frame in range(frames):
            gt, reference = source.read_vtu_vector(handle, entries[source.temporal_field_name("GT", frame)], points)
            slice_reference = interpolator.vectors(gt)
            volume_norms = reference_magnitudes(reference, used)
            slice_norms = reference_magnitudes(slice_reference)
            record["volumeReferenceNorms"].append(math.hypot(*volume_norms))
            record["counts"]["volume"].append(sum(value != 0 for value in volume_norms))
            for axis, index, start, count in slices:
                record["counts"]["slices"][axis][index].append(sum(value != 0 for value in slice_norms[start:start + count]))
                record["sliceReferenceNorms"][axis][index].append(math.hypot(*slice_norms[start:start + count]))
            if frame in (0, frames - 1):
                maximum_vtk_residual = max(maximum_vtk_residual, verify_vtk_interpolation(
                    grid, first_plane, gt, slice_reference, slices[0][3]))
            for model in MODELS:
                prediction_field, prediction = source.read_vtu_vector(
                    handle, entries[source.temporal_field_name(model, frame)], points)
                slice_prediction = interpolator.vectors(prediction_field)
                value, valid, reference_norm, error_norm = relative_l2_percent(reference, prediction, used, magnitudes=volume_norms)
                require(valid == record["counts"]["volume"][-1], "Volume validity count differs by model")
                require(reference_norm == record["volumeReferenceNorms"][-1], "Reference norm differs by model")
                record["models"][model]["volume"].append(value)
                record["models"][model]["volumeErrorNorms"].append(error_norm)
                for axis, index, start, count in slices:
                    value, valid, reference_norm, error_norm = relative_l2_percent(
                        slice_reference, slice_prediction, magnitudes=slice_norms, start=start, count=count)
                    require(valid == record["counts"]["slices"][axis][index][-1],
                            "Slice validity count differs by model")
                    require(reference_norm == record["sliceReferenceNorms"][axis][index][-1],
                            "Slice reference norm differs by model")
                    record["models"][model]["slices"][axis][index].append(value)
                    record["models"][model]["sliceErrorNorms"][axis][index].append(error_norm)
                if frame in (0, frames - 1):
                    maximum_vtk_residual = max(maximum_vtk_residual, verify_vtk_interpolation(
                        grid, first_plane, prediction_field, slice_prediction, slices[0][3]))
            print(f"{sample['id']}: relative metrics frame {frame + 1}/{frames} ({time.monotonic() - started:.1f}s)", flush=True)
    print(f"{sample['id']}: native VTK vector check max residual {maximum_vtk_residual:.3g}", flush=True)
    return record


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path, payload):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":"),
                                     allow_nan=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("samples", nargs="*", help="Sample IDs from manifest.json (default: all)")
    parser.add_argument("--output", type=Path, default=source.ROOT / "assets/data/abgatr-demo")
    parser.add_argument("--source-dir", type=Path, default=source.ROOT)
    parser.add_argument("--force", action="store_true", help="Regenerate selected metrics")
    parser.add_argument("--validate-only", action="store_true", help="Validate without raw sources")
    args = parser.parse_args()
    manifest = read_json(args.output / "manifest.json")
    audits = {item["id"]: item for item in read_json(args.output / "audit.json")["samples"]}
    samples = {item["id"]: item for item in manifest["samples"]}
    require(manifest["fractions"] == source.FRACTIONS, "Slice fractions differ from preparation pipeline")
    require([model["id"] for model in manifest["models"]] == MODELS, "Model definitions differ")
    selected = args.samples or list(samples)
    require(len(set(selected)) == len(selected), "Duplicate selected sample ID")
    require(all(sample_id in samples for sample_id in selected), "Unknown selected sample ID")
    target = args.output / "metrics.json"
    payload = read_json(target) if target.exists() else {**HEADER, "samples": {}}
    if not all(payload.get(key) == value for key, value in HEADER.items()):
        require(args.force and not args.validate_only and set(selected) == set(samples),
                "Incompatible metric definition/schema; regenerate all cases with --force")
        payload = {**HEADER, "samples": {}}
    for sample_id in selected:
        sample, audit = samples[sample_id], audits[sample_id]
        validate_geometry_checksums(sample, audit, args.output)
        cached = payload["samples"].get(sample_id)
        valid_cache = False
        if cached:
            try:
                validate_record(cached, sample, audit, manifest)
                valid_cache = True
            except (ValueError, KeyError, TypeError):
                if args.validate_only:
                    raise
        if args.validate_only:
            require(valid_cache, f"Missing metrics for {sample_id}")
            print(f"{sample_id}: verified metric coverage and prepared geometry", flush=True)
            continue
        path = args.source_dir / sample["source"]["filename"]
        if path.is_file():
            require(source.file_hash(path) == sample["source"]["sha256"],
                    f"Source changed for {sample_id}; regenerate viewer assets before metrics")
        if valid_cache and not args.force:
            print(f"{sample_id}: reused verified metrics (source present: {path.is_file()})", flush=True)
            continue
        require(path.is_file(), f"Original vectors required to prepare metrics: {path}")
        prepare = prepare_temporal if sample.get("timeSteps") else prepare_static
        record = prepare(path, sample, audit, manifest)
        add_volume_relative_l2(record)
        add_slice_relative_l2(record)
        validate_record(record, sample, audit, manifest)
        payload["samples"][sample_id] = record
        save_json(target, payload)
        gc.collect()
        print(f"{sample_id}: saved validated percentages", flush=True)
    if target.exists():
        print(f"Metrics: {target.stat().st_size:,} bytes; {len(payload['samples'])} cases", flush=True)


if __name__ == "__main__":
    main()

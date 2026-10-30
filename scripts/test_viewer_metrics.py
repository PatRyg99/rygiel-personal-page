#!/usr/bin/env python3
"""Numerical regression checks for global vector L2 ratios (no Torch required)."""

import array
import json
import math
from pathlib import Path
import unittest

import vtk

from prepare_viewer_metrics import (VectorInterpolator, add_slice_relative_l2, add_volume_relative_l2,
                                    relative_l2_percent, reference_magnitudes,
                                    vector_buffer)


class RelativeMetricTests(unittest.TestCase):
    def test_equal_speeds_different_directions(self):
        value, count, reference_norm, error_norm = relative_l2_percent([1, 0, 0], [0, 1, 0])
        self.assertAlmostEqual(value, 100 * math.sqrt(2))
        self.assertEqual(count, 1)
        self.assertEqual(reference_norm, 1)
        self.assertEqual(error_norm, math.sqrt(2))

    def test_global_norm_ratio_not_mean_of_pointwise_ratios(self):
        # Pointwise ratios average to 55%; the requested whole-sample norm
        # ratio is sqrt(1^2 + 1^2) / sqrt(1^2 + 10^2), about 14.07%.
        value, count, _, _ = relative_l2_percent([1, 0, 0, 10, 0, 0], [0, 0, 0, 9, 0, 0])
        self.assertAlmostEqual(value, 100 * math.sqrt(2 / 101))
        self.assertNotAlmostEqual(value, 55)
        self.assertEqual(count, 2)

    def test_matches_flattened_sample_vector_norm(self):
        reference = [1, 2, -3, -4, 5, 6]
        prediction = [2, 1, -4, -3, 5, 5]
        value, count, reference_norm, error_norm = relative_l2_percent(reference, prediction)
        expected_error = math.hypot(*(a - b for a, b in zip(reference, prediction)))
        expected_reference = math.hypot(*reference)
        self.assertAlmostEqual(value, 100 * expected_error / expected_reference)
        self.assertAlmostEqual(reference_norm, expected_reference)
        self.assertAlmostEqual(error_norm, expected_error)
        self.assertEqual(count, 2)

    def test_zero_gt_prediction_errors_are_included(self):
        value, count, reference_norm, error_norm = relative_l2_percent(
            [0, 0, 0, 1, 0, 0], [3, 4, 0, 1, 0, 0])
        self.assertEqual((value, count, reference_norm, error_norm), (500, 1, 1, 5))
        self.assertEqual(relative_l2_percent([0, 0, 0], [1, 2, 3]), (None, 0, 0, math.sqrt(14)))

    def test_tiny_nonzero_vectors_are_retained(self):
        value, count, reference_norm, error_norm = relative_l2_percent([1e-200, 0, 0], [0, 0, 0])
        self.assertEqual(value, 100)
        self.assertEqual(count, 1)
        self.assertEqual(reference_norm, 1e-200)
        self.assertEqual(error_norm, 1e-200)

    def test_large_components_do_not_overflow_intermediate_squares(self):
        value, count, reference_norm, error_norm = relative_l2_percent([1e200, 0, 0], [0, 0, 0])
        self.assertEqual((value, count, reference_norm, error_norm), (100, 1, 1e200, 1e200))

    def test_orphan_source_vertices_excluded(self):
        reference = [1, 0, 0, 1, 0, 0, 2, 0, 0]
        predicted = [1, 0, 0, 101, 0, 0, 1, 0, 0]
        value, count, _, _ = relative_l2_percent(reference, predicted, [1, 0, 1])
        self.assertAlmostEqual(value, 100 / math.sqrt(5))
        self.assertEqual(count, 2)

    def test_orphan_mask_applies_with_precomputed_reference_magnitudes(self):
        reference = [1, 0, 0, 1000, 0, 0, 0, 0, 0]
        predicted = [1, 0, 0, 1e6, 0, 0, 3, 4, 0]
        used = [1, 0, 1]
        for magnitudes in (reference_magnitudes(reference), reference_magnitudes(reference, used)):
            result = relative_l2_percent(reference, predicted, used, magnitudes=magnitudes)
            self.assertEqual(result, (500, 1, 1, 5))

    def test_slice_range_and_precomputed_reference(self):
        reference = [1, 0, 0, 2, 0, 0, 4, 0, 0]
        predicted = [0, 0, 0, 2, 0, 0, 2, 0, 0]
        norms = reference_magnitudes(reference)
        value, count, _, _ = relative_l2_percent(reference, predicted, magnitudes=norms, start=1, count=2)
        self.assertAlmostEqual(value, 100 * 2 / math.sqrt(20))
        self.assertEqual(count, 2)

    def test_interpolate_vectors_before_computing_relative_error(self):
        # Opposite endpoint errors cancel at the midpoint. Interpolating their
        # absolute magnitudes would incorrectly report 100% instead of 0%.
        mapping = [(array.array("q", [0]), array.array("q", [1]), array.array("d", [.5]))]
        interpolator = VectorInterpolator(mapping)

        def field(values):
            result = vtk.vtkDoubleArray()
            result.SetNumberOfComponents(3)
            for vector in values:
                result.InsertNextTuple3(*vector)
            return result

        reference = interpolator.vectors(field([(1, 0, 0), (1, 0, 0)]))
        prediction = interpolator.vectors(field([(0, 0, 0), (2, 0, 0)]))
        self.assertEqual(list(reference), [1, 0, 0])
        self.assertEqual(relative_l2_percent(reference, prediction), (0, 1, 1, 0))

    def test_double_precision_is_preserved(self):
        field = vtk.vtkDoubleArray()
        field.SetNumberOfComponents(3)
        value = 1 + 2**-40
        field.InsertNextTuple3(value, 2, 3)
        self.assertEqual(vector_buffer(field)[0], value)

    def test_invalid_vector_lengths_rejected(self):
        with self.assertRaises(ValueError):
            relative_l2_percent([1, 0, 0], [1, 0])

    def test_time_pool_combines_norms_not_frame_ratios(self):
        record = {"frameCount": 2, "volumeReferenceNorms": [1, 10],
                  "counts": {"volume": [1, 1]},
                  "models": {"example": {"volume": [100, 10], "volumeErrorNorms": [1, 1]}}}
        add_volume_relative_l2(record)
        self.assertAlmostEqual(record["models"]["example"]["volumeRelativeL2"],
                               100 * math.sqrt(2 / 101))
        self.assertEqual(record["counts"]["volumeAllFrames"], 2)
        self.assertEqual(record["models"]["example"]["volume"], [100, 10])

    def test_time_pool_matches_concatenated_tensor_with_zero_only_frame(self):
        reference = [1, 0, 0, 2, 0, 0, 1, 0, 0, 0, 0, 0, 4, 0, 0]
        prediction = [.8, 0, 0, 1.6, 0, 0, .8, 0, 0, 100, 0, 0, .8, 0, 0]
        results = [relative_l2_percent(reference, prediction, start=start, count=count)
                   for start, count in [(0, 3), (3, 1), (4, 1)]]
        record = {"frameCount": 3, "volumeReferenceNorms": [r[2] for r in results],
                  "counts": {"volume": [r[1] for r in results]},
                  "models": {"example": {"volume": [r[0] for r in results],
                                          "volumeErrorNorms": [r[3] for r in results]}}}
        add_volume_relative_l2(record)
        direct, count, _, _ = relative_l2_percent(reference, prediction)
        self.assertAlmostEqual(record["models"]["example"]["volumeRelativeL2"], direct)
        self.assertEqual(record["counts"]["volumeAllFrames"], count)
        self.assertEqual(record["counts"]["volume"], [3, 0, 1])
        self.assertEqual(record["models"]["example"]["volumeErrorNorms"][1], 100)
        self.assertIsNone(record["models"]["example"]["volume"][1])
        self.assertGreater(record["models"]["example"]["volumeRelativeL2"], 1000)

    def test_zero_reference_frame_contributes_to_full_cycle_numerator(self):
        record = {"frameCount": 2, "volumeReferenceNorms": [0, 4],
                  "counts": {"volume": [0, 1]},
                  "models": {"example": {"volume": [None, 0], "volumeErrorNorms": [3, 0]}}}
        add_volume_relative_l2(record)
        self.assertEqual(record["models"]["example"]["volumeRelativeL2"], 75)

    def test_time_pool_handles_empty_and_tiny_reference_norms(self):
        for reference_norm, count, expected in [(0, 0, None), (1e-200, 1, 100)]:
            record = {"frameCount": 2, "volumeReferenceNorms": [reference_norm, reference_norm],
                      "counts": {"volume": [count, count]},
                      "models": {"example": {"volumeErrorNorms": [reference_norm, reference_norm]}}}
            add_volume_relative_l2(record)
            self.assertEqual(record["models"]["example"]["volumeRelativeL2"], expected)

    def test_slice_pool_combines_unequal_energies_and_zero_reference_frames(self):
        record = {"sliceReferenceNorms": {"x": [[1, 10, 0], [0, 0, 0]], "y": [], "z": []},
                  "models": {"example": {"sliceErrorNorms": {"x": [[1, 1, 3], [2, 3, 4]], "y": [], "z": []}}}}
        add_slice_relative_l2(record)
        values = record["models"]["example"]["slicesRelativeL2"]["x"]
        self.assertAlmostEqual(values[0], 100 * math.sqrt(11 / 101))
        self.assertIsNone(values[1])

    def test_static_slice_aggregate_equals_single_frame_ratio(self):
        record = {"sliceReferenceNorms": {"x": [[2]], "y": [[5]], "z": [[0]]},
                  "models": {"example": {"sliceErrorNorms": {"x": [[1]], "y": [[0]], "z": [[3]]}}}}
        add_slice_relative_l2(record)
        self.assertEqual(record["models"]["example"]["slicesRelativeL2"],
                         {"x": [50], "y": [0], "z": [None]})


class SuppliedReferenceTests(unittest.TestCase):
    def test_all_18_aaa_ratios_match_the_supplied_reference(self):
        root = Path(__file__).resolve().parent.parent
        fixture = json.loads((root / "scripts/fixtures/aaa-relative-l2.json").read_text())
        metrics = json.loads((root / "assets/data/abgatr-demo/metrics.json").read_text())
        manifest = json.loads((root / "assets/data/abgatr-demo/manifest.json").read_text())
        sources = {sample["id"]: sample["source"]["sha256"] for sample in manifest["samples"]}
        self.assertEqual(metrics["version"], 4)
        self.assertEqual(metrics["zeroReferencePolicy"], "include zero-GT prediction errors")
        cases = 0
        for sample_id, expected in fixture["samples"].items():
            record = metrics["samples"][sample_id]
            self.assertEqual(record["sourceSha256"], expected["sourceSha256"])
            self.assertEqual(sources[sample_id], expected["sourceSha256"])
            for model, ratio in expected["ratios"].items():
                with self.subTest(sample=sample_id, model=model):
                    actual = record["models"][model]["volumeRelativeL2"] / 100
                    self.assertEqual(round(actual, 6), ratio)
                    cases += 1
        self.assertEqual(cases, 18)


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Numerical and binary-format regression checks for the surface WSS viewer."""

import array
import gzip
import json
import math
from pathlib import Path
import struct
import unittest

import vtk

from prepare_wss import (HEADER, GEOMETRY_MAGIC, VECTOR_MAGIC, decode_vectors, encode_vectors,
                         challenge_ranges, frame_statistics, percentile, pooled_relative_l2, shuffle_float32,
                         little_endian_bytes, read_mesh, source_field_family, source_frame_count,
                         source_vectors, unshuffle_float32)


class WSSCodecTests(unittest.TestCase):
    def test_signed_vectors_and_numeric_frame_order_round_trip(self):
        # Two timesteps, one vertex, CFD followed by LaB-GATr in each frame.
        values = (-0.0, -1.25, 2.5, 3.0, -4.5, 5.25,
                  6.75, 7.5, -8.25, -9.0, 10.5, -11.25)
        raw = struct.pack("<12f", *values)
        compressed = gzip.compress(encode_vectors(raw, 1, 2), mtime=0)
        count, frames, decoded = decode_vectors(gzip.decompress(compressed))
        self.assertEqual((count, frames), (1, 2))
        self.assertEqual(decoded, raw)  # Includes the negative-zero bit pattern.
        self.assertEqual(struct.unpack("<12f", decoded), values)

    def test_byte_lanes_match_browser_contract(self):
        raw = bytes(range(16))
        expected = bytes([0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15])
        self.assertEqual(shuffle_float32(raw), expected)
        self.assertEqual(unshuffle_float32(expected), raw)

    def test_incomplete_and_unsupported_packets_rejected(self):
        valid = encode_vectors(struct.pack("<6f", 1, 2, 3, 4, 5, 6), 1, 1)
        for packet in (valid[:12], valid[:-1], valid + b"extra",
                       HEADER.pack(0, 1, 1, 2) + valid[16:],
                       HEADER.pack(VECTOR_MAGIC, 1, 1, 3) + valid[16:]):
            with self.assertRaises(ValueError):
                decode_vectors(packet)
        with self.assertRaises(ValueError):
            encode_vectors(b"", 1, 1)


class WSSMetricTests(unittest.TestCase):
    def test_equal_magnitudes_opposite_direction_have_nonzero_error(self):
        stats = frame_statistics([1, 0, 0], [-1, 0, 0])
        self.assertEqual(stats["relativeL2"], 200)
        self.assertEqual(list(stats["errorMagnitudes"]), [2])

    def test_zero_reference_prediction_error_is_included(self):
        stats = frame_statistics([1, 0, 0, 0, 0, 0], [1, 0, 0, 3, 4, 0])
        self.assertEqual(stats["relativeL2"], 500)
        self.assertIsNone(frame_statistics([0, 0, 0], [3, 4, 0])["relativeL2"])

    def test_whole_cycle_is_pooled_norm_not_mean_frame_error(self):
        frames = [frame_statistics([1, 0, 0], [0, 0, 0]),
                  frame_statistics([10, 0, 0], [9, 0, 0])]
        self.assertAlmostEqual(pooled_relative_l2(frames), 100 * math.sqrt(2 / 101))
        self.assertNotAlmostEqual(pooled_relative_l2(frames), 55)

    def test_zero_only_frame_still_contributes_error(self):
        frames = [frame_statistics([1, 0, 0], [1, 0, 0]),
                  frame_statistics([0, 0, 0], [0, 3, 4])]
        self.assertEqual(pooled_relative_l2(frames), 500)

    def test_percentile_interpolates_sorted_population(self):
        self.assertEqual(percentile([4, 0, 2, 1, 3], .75), 3)
        self.assertAlmostEqual(percentile([0, 100], .99), 99)

    def test_challenge_scales_pool_only_the_selected_cases(self):
        magnitudes = {"base": {"wss": [1, 2], "error": [1]},
                      "extended": {"wss": [3, 4], "error": [3]},
                      "boundary-1": {"wss": [100, 200], "error": [100]}}
        topology, population = challenge_ranges(["base", "extended"], magnitudes)
        boundary, _ = challenge_ranges(["base", "boundary-1"], magnitudes)
        self.assertAlmostEqual(topology["wss"][1], 3.97)
        self.assertAlmostEqual(boundary["wss"][1], 197)
        self.assertEqual(population, {"wss": 4, "error": 2})


class WSSSourceSeriesTests(unittest.TestCase):
    def mesh_with_series(self, families, frames=21):
        mesh = vtk.vtkPolyData()
        for family in families:
            for kind in ("true", "pred"):
                for frame in range(frames):
                    field = vtk.vtkFloatArray()
                    field.SetName(f"wss_{kind}_{family}_{frame:03}")
                    field.SetNumberOfComponents(3)
                    field.InsertNextTuple3(frame, -frame, 1)
                    mesh.GetPointData().AddArray(field)
        return mesh

    def test_use_supplied_mean_series_when_instance_is_absent(self):
        mesh = self.mesh_with_series(["mean", "var"])
        self.assertEqual(source_field_family(mesh), "mean")
        self.assertEqual(source_frame_count(mesh), 21)

    def test_prefer_instance_vectors_without_averaging_with_means(self):
        mesh = self.mesh_with_series(["mean", "0"])
        self.assertEqual(source_field_family(mesh), "0")
        self.assertEqual(source_frame_count(mesh), 21)

    def test_incomplete_series_or_variance_only_is_rejected(self):
        mesh = self.mesh_with_series(["mean"])
        mesh.GetPointData().RemoveArray("wss_pred_mean_010")
        with self.assertRaises(ValueError):
            source_frame_count(mesh)
        with self.assertRaises(ValueError):
            source_field_family(self.mesh_with_series(["var"]))


class GeneratedWSSAssetsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = Path(__file__).resolve().parents[1] / "assets/data/wss-demo"
        if not (cls.directory / "manifest.json").exists():
            raise unittest.SkipTest("Run scripts/prepare_wss.py to inspect generated assets")
        cls.manifest = json.loads((cls.directory / "manifest.json").read_text())

    def test_manifest_and_full_geometry_connectivity(self):
        self.assertEqual(self.manifest["version"], 2)
        self.assertEqual(self.manifest["model"], "LaB-GATr")
        self.assertEqual({sample["id"] for sample in self.manifest["samples"]},
                         {"base", "extended", "boundary-1", "p6-earlier", "p6-later"})
        for sample in self.manifest["samples"]:
            packet = gzip.decompress((self.directory / sample["geometry"]).read_bytes())
            magic, points, indices, frames = HEADER.unpack_from(packet)
            self.assertEqual(magic, GEOMETRY_MAGIC)
            self.assertEqual(points, sample["pointCount"])
            self.assertEqual(indices, sample["triangleCount"] * 3)
            self.assertEqual(frames, sample["frameCount"])
            self.assertEqual(len(packet), 16 + points * 3 * 4 + indices * 4)
            connectivity = struct.unpack_from(f"<{indices}I", packet, 16 + points * 3 * 4)
            self.assertEqual(set(connectivity), set(range(points)))

    def test_boundary_conditions_share_mesh_but_change_cfd_vectors(self):
        samples = {sample["id"]: sample for sample in self.manifest["samples"]}
        base, changed = samples["base"], samples["boundary-1"]
        self.assertEqual(base["geometry"], changed["geometry"])
        self.assertEqual(base["pointCount"], changed["pointCount"])
        self.assertNotEqual(base["vectors"], changed["vectors"])
        decoded = [decode_vectors(gzip.decompress((self.directory / sample["vectors"]).read_bytes()))[2]
                   for sample in (base, changed)]
        frame_bytes = base["pointCount"] * 3 * 4
        # Check CFD fields specifically: different predictions alone would not
        # establish different physical conditions for this shared geometry.
        self.assertTrue(any(decoded[0][frame * 2 * frame_bytes:(frame * 2 + 1) * frame_bytes]
                            != decoded[1][frame * 2 * frame_bytes:(frame * 2 + 1) * frame_bytes]
                            for frame in range(base["frameCount"])))
        self.assertFalse((self.directory / "boundary-1-geometry.bin.gz").exists())

    def test_challenge_pairs_and_unique_asset_accounting(self):
        challenges = {challenge["id"]: challenge for challenge in self.manifest["challenges"]}
        self.assertEqual(self.manifest["defaultChallenge"], "topology")
        self.assertNotIn("defaultSample", self.manifest)
        self.assertNotIn("displayRanges", self.manifest)
        self.assertEqual(set(challenges), {"topology", "boundary-conditions", "remodelling"})
        self.assertEqual([case["sample"] for case in challenges["topology"]["cases"]], ["base", "extended"])
        self.assertEqual([case["sample"] for case in challenges["boundary-conditions"]["cases"]], ["base", "boundary-1"])
        self.assertEqual([case["sample"] for case in challenges["remodelling"]["cases"]], ["p6-earlier", "p6-later"])
        for challenge in challenges.values():
            for kind in ("wss", "error"):
                low, high = challenge["displayRanges"][kind]
                self.assertEqual(low, 0)
                self.assertTrue(math.isfinite(high) and high > low)
        audit = json.loads((self.directory / "audit.json").read_text())
        names = [asset["file"] for asset in audit["assets"]]
        self.assertEqual(len(names), len(set(names)))
        self.assertEqual(set(names), {path.name for path in self.directory.glob("*.bin.gz")})
        self.assertEqual(audit["generatedBytes"], sum((self.directory / name).stat().st_size for name in names))

    def test_source_field_families_and_dataset_labels_are_explicit(self):
        self.assertNotIn("dataset", self.manifest)
        audit = json.loads((self.directory / "audit.json").read_text())
        audit_samples = {sample["id"]: sample for sample in audit["samples"]}
        for sample in self.manifest["samples"]:
            family = "mean" if sample["id"].startswith("p6-") else "0"
            self.assertEqual(sample["fieldFamily"], family)
            self.assertEqual(audit_samples[sample["id"]]["sourceFields"]["gt"], f"wss_true_{family}_{{frame:03}}")
            if family == "mean":
                self.assertNotIn("dataset", sample)
                self.assertIsNone(audit_samples[sample["id"]]["instanceZeroEqualsMean"])
            else:
                self.assertEqual(sample["dataset"], "AAA-100")

    def test_delivered_longitudinal_vectors_and_relative_size_match_source(self):
        samples = [sample for sample in self.manifest["samples"] if sample["id"].startswith("p6-")]
        root = self.directory.parents[2]
        if not all((root / sample["source"]).exists() for sample in samples):
            self.skipTest("Local original VTP files are optional and intentionally not published")
        for sample in samples:
            mesh = read_mesh(root / sample["source"])
            geometry = gzip.decompress((self.directory / sample["geometry"]).read_bytes())
            positions = struct.unpack_from(f"<{sample['pointCount'] * 3}f", geometry, HEADER.size)
            rendered_height = max(positions[2::3]) - min(positions[2::3])
            source_height = mesh.GetBounds()[5] - mesh.GetBounds()[4]
            self.assertAlmostEqual(rendered_height / self.manifest["renderTransform"]["scale"],
                                   source_height, places=6)
            _, _, raw = decode_vectors(gzip.decompress((self.directory / sample["vectors"]).read_bytes()))
            stride = sample["pointCount"] * 3 * 4
            for frame in range(sample["frameCount"]):
                for field_index, kind in enumerate(("true", "pred")):
                    source = mesh.GetPointData().GetArray(f"wss_{kind}_mean_{frame:03}")
                    expected = little_endian_bytes(source_vectors(source, sample["pointCount"]))
                    offset = (frame * 2 + field_index) * stride
                    self.assertEqual(raw[offset:offset + stride], expected)

    def test_metrics_and_challenge_ranges_recomputed_from_delivered_vectors(self):
        magnitudes = {}
        for sample in self.manifest["samples"]:
            packet = gzip.decompress((self.directory / sample["vectors"]).read_bytes())
            points, frames, raw = decode_vectors(packet)
            self.assertEqual((points, frames), (sample["pointCount"], 21))
            frame_bytes = points * 3 * 4
            stats = []
            magnitudes[sample["id"]] = {"wss": array.array("d"), "error": array.array("d")}
            for frame in range(frames):
                fields = []
                for kind in range(2):
                    offset = (frame * 2 + kind) * frame_bytes
                    fields.append(struct.unpack_from(f"<{points * 3}f", raw, offset))
                stat = frame_statistics(*fields)
                magnitudes[sample["id"]]["wss"].extend(stat.pop("wssMagnitudes"))
                magnitudes[sample["id"]]["error"].extend(stat.pop("errorMagnitudes"))
                stats.append(stat)
                self.assertAlmostEqual(stat["relativeL2"], sample["metrics"]["relativeL2"][frame], places=10)
            self.assertAlmostEqual(pooled_relative_l2(stats), sample["metrics"]["relativeL2AllFrames"], places=10)
        for challenge in self.manifest["challenges"]:
            ranges, _ = challenge_ranges([case["sample"] for case in challenge["cases"]], magnitudes)
            for kind in ("wss", "error"):
                self.assertAlmostEqual(ranges[kind][1], challenge["displayRanges"][kind][1], places=10)


if __name__ == "__main__":
    unittest.main()

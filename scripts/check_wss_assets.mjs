// Cross-language check: use the browser's decoder on the published binary files.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { decodeSurface, decodeVectors } from '../assets/js/wss-codec.js';

const root = new URL('../assets/data/wss-demo/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root)));
const unpack = async file => {
  const buffer = gunzipSync(await readFile(new URL(file, root)));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
assert.equal(manifest.unitScale, .1);
assert.equal(manifest.units, 'Pa');
for (const sample of manifest.samples) {
  const geometry = decodeSurface(await unpack(sample.geometry));
  const vectors = decodeVectors(await unpack(sample.vectors));
  assert.equal(geometry.count, vectors.count);
  assert.equal(geometry.count, sample.pointCount);
  assert.equal(geometry.indices.length, sample.triangleCount * 3);
  assert.equal(vectors.frameCount, 21);
  let allError = 0, allReference = 0, maximumError = 0, maximumWSS = 0;
  for (let step = 0; step < vectors.frameCount; step++) {
    const truth = vectors.frame(step, 0), prediction = vectors.frame(step, 1);
    let error = 0, reference = 0;
    for (let i = 0; i < truth.length; i++) {
      error += (prediction[i] - truth[i]) ** 2; reference += truth[i] ** 2;
    }
    for (let i = 0; i < truth.length; i += 3) {
      maximumError = Math.max(maximumError, Math.hypot(prediction[i] - truth[i], prediction[i + 1] - truth[i + 1], prediction[i + 2] - truth[i + 2]));
      maximumWSS = Math.max(maximumWSS, Math.hypot(truth[i], truth[i + 1], truth[i + 2]), Math.hypot(prediction[i], prediction[i + 1], prediction[i + 2]));
    }
    close(100 * Math.sqrt(error / reference), sample.metrics.relativeL2[step]);
    allError += error; allReference += reference;
  }
  close(100 * Math.sqrt(allError / allReference), sample.metrics.relativeL2AllFrames);
  close(maximumError, sample.ranges.error[1]); close(maximumWSS, sample.ranges.wss[1]);
  assert.throws(() => vectors.frame(-1, 0));
  assert.throws(() => decodeVectors(new ArrayBuffer(15)));
  assert.throws(() => decodeSurface(new ArrayBuffer(15)));
  console.log(`${sample.label}: all 21 frames, vector magnitudes, and space-time L₂ match the source-derived manifest.`);
}

// Check the browser decoder against the producer audit, optionally against the
// pre-compression float32 bundles: node scripts/check_viewer_assets.mjs /path/to/baseline
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeTimeSeries } from '../assets/js/aneumo-codec.js';

const root = fileURLToPath(new URL('../assets/data/abgatr-demo/', import.meta.url));
const baseline = process.argv[2] ? resolve(process.argv[2]) : null;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const arrayBuffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const floatsHash = values => hash(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
const loadJSON = async path => JSON.parse(await readFile(path, 'utf8'));

// Independent fixtures exercise negative/wrapping deltas, field order, zero
// ranges, malformed data, and compatibility with the original XOR format.
const codes = [0, 65535, 65535, 0, 65535, 0, 0, 65535, 10, 32768, 200, 60000];
const fixture = Buffer.alloc(32 + codes.length * 2);
[0x41545333, 2, 3, 2].forEach((n, i) => fixture.writeUInt32LE(n, i * 4));
fixture.writeDoubleLE(65535, 16); fixture.writeDoubleLE(131070, 24);
codes.forEach((code, i) => {
  const delta = (code - (i >= 4 ? codes[i - 4] : 0)) & 65535;
  fixture[32 + i] = delta & 255; fixture[32 + codes.length + i] = delta >> 8;
});
assert.deepEqual([...decodeTimeSeries(arrayBuffer(fixture)).values], codes.map((n, i) => n * (Math.floor(i / 2) % 2 + 1)));
const zero = Buffer.from(fixture); zero.writeDoubleLE(0, 16); zero.writeDoubleLE(0, 24);
assert.ok(decodeTimeSeries(arrayBuffer(zero)).values.every(n => n === 0));
assert.throws(() => decodeTimeSeries(arrayBuffer(fixture.subarray(0, -1))), /dimensions/);
const invalidRange = Buffer.from(fixture); invalidRange.writeDoubleLE(Infinity, 16);
assert.throws(() => decodeTimeSeries(arrayBuffer(invalidRange)), /range/);
const invalidCount = Buffer.from(fixture); invalidCount.writeUInt32LE(0xffffffff, 4);
assert.throws(() => decodeTimeSeries(arrayBuffer(invalidCount)), /dimensions/);
const exactValues = new Float32Array([0, 1, 0.25, 50, 3, 0]);
const exactBits = new Uint32Array(exactValues.buffer);
const legacy = Buffer.alloc(16 + exactValues.byteLength);
[0x41545331, 2, 3, 1].forEach((n, i) => legacy.writeUInt32LE(n, i * 4));
exactBits.forEach((n, i) => legacy.writeUInt32LE((n ^ (i >= 2 ? exactBits[i - 2] : 0)) >>> 0, 16 + i * 4));
assert.deepEqual([...decodeTimeSeries(arrayBuffer(legacy)).values], [...exactValues]);

const manifest = await loadJSON(join(root, 'manifest.json'));
const audit = await loadJSON(join(root, 'audit.json'));
const oldManifest = baseline ? await loadJSON(join(baseline, 'manifest.json')) : null;
const oldAudit = baseline ? await loadJSON(join(baseline, 'audit.json')) : null;
let checked = 0, scalarCount = 0, maximumError = 0;
for (const sample of manifest.samples) {
  const record = audit.samples.find(item => item.id === sample.id);
  const before = oldAudit?.samples.find(item => item.id === sample.id);
  if (oldManifest) {
    const oldSample = oldManifest.samples.find(item => item.id === sample.id);
    for (const key of ['source', 'timeSteps', 'velocityRange', 'errorRange', 'defaultAxis', 'defaultSlice', 'slices', 'shell']) {
      assert.deepEqual(sample[key], oldSample[key], `${sample.id}: ${key} unchanged`);
    }
    assert.deepEqual(record.shell, before.shell, `${sample.id}: original wall unchanged`);
    assert.deepEqual(record.slices, before.slices, `${sample.id}: complete slice geometry unchanged`);
  }
  for (const entry of record.series || []) {
    const bytes = await readFile(join(root, entry.path));
    assert.equal(hash(bytes), entry.sha256, entry.path);
    const packet = decodeTimeSeries(arrayBuffer(gunzipSync(bytes)));
    assert.deepEqual([packet.vertices, packet.frameCount, packet.fieldCount], [entry.vertices, entry.frames, entry.fields]);
    assert.equal(floatsHash(packet.values), entry.decodedSha256, `${entry.path}: JS and Python agree on every decoded float`);
    if (baseline) {
      const oldPath = entry.path.replace('.u16.series.gz', '.series.gz');
      const old = decodeTimeSeries(arrayBuffer(gunzipSync(await readFile(join(baseline, oldPath)))));
      assert.equal(floatsHash(old.values), entry.originalDecodedSha256);
      assert.equal(packet.values.length, old.values.length);
      const errors = Array(packet.fieldCount).fill(0);
      for (let i = 0; i < packet.values.length; i++) {
        const field = Math.floor(i / packet.vertices) % packet.fieldCount;
        errors[field] = Math.max(errors[field], Math.abs(packet.values[i] - old.values[i]));
      }
      errors.forEach((error, field) => {
        assert.equal(error, entry.maxAbsoluteErrorByField[field]);
        assert.ok(error <= entry.absoluteErrorBounds[field] + 1e-12);
        maximumError = Math.max(maximumError, error);
      });
    }
    checked++; scalarCount += packet.values.length;
    if (checked % 90 === 0) console.log(`Verified ${checked} temporal bundles…`);
  }
}
console.log(`Verified ${checked} bundles and ${scalarCount.toLocaleString()} scalar values with the actual browser decoder.`);
if (baseline) console.log(`Geometry, all frames, and color scales unchanged. Maximum scalar rounding: ${maximumError.toFixed(9)} cm/s.`);

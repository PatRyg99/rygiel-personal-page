// Prepared surface meshes and lossless, byte-shuffled float32 vector series.
export function decodeSurface(buffer) {
  if (buffer.byteLength < 16) throw new Error('Truncated WSS geometry');
  const header = new DataView(buffer);
  const count = header.getUint32(4, true), indexCount = header.getUint32(8, true);
  const frameCount = header.getUint32(12, true);
  if (header.getUint32(0, true) !== 0x57534731 || !count || !frameCount || indexCount % 3 || buffer.byteLength !== 16 + count * 12 + indexCount * 4) throw new Error('Invalid WSS geometry');
  const positions = new Float32Array(buffer, 16, count * 3);
  const indices = new Uint32Array(buffer, 16 + count * 12, indexCount);
  if (positions.some(value => !Number.isFinite(value)) || indices.some(value => value >= count)) throw new Error('Invalid surface coordinates');
  return { count, frameCount, positions, indices };
}

export function decodeVectors(buffer) {
  if (buffer.byteLength < 16) throw new Error('Truncated WSS vectors');
  const header = new DataView(buffer);
  const count = header.getUint32(4, true), frameCount = header.getUint32(8, true);
  const fieldCount = header.getUint32(12, true), length = count * frameCount * fieldCount * 3;
  if (header.getUint32(0, true) !== 0x57535632 || !count || !frameCount || fieldCount !== 2 || buffer.byteLength !== 16 + length * 4) throw new Error('Invalid WSS vectors');
  const lanes = new Uint8Array(buffer, 16), bytes = new Uint8Array(length * 4);
  for (let lane = 0; lane < 4; lane++) for (let i = 0; i < length; i++) bytes[4 * i + lane] = lanes[lane * length + i];
  const values = new Float32Array(bytes.buffer);
  if (values.some(value => !Number.isFinite(value))) throw new Error('Non-finite WSS vectors');
  return {
    count, frameCount,
    frame(step, field) {
      if (!Number.isInteger(step) || step < 0 || step >= frameCount || ![0, 1].includes(field)) throw new Error('Invalid WSS frame');
      const offset = (step * 2 + field) * count * 3;
      return values.subarray(offset, offset + count * 3);
    },
  };
}

// A fixed spatial grid avoids concentrating glyphs in densely meshed areas.
export function glyphSites(positions, spacing) {
  const cells = new Set(), sites = [];
  for (let i = 0; i < positions.length; i += 3) {
    const key = `${Math.floor(positions[i] / spacing)},${Math.floor(positions[i + 1] / spacing)},${Math.floor(positions[i + 2] / spacing)}`;
    if (!cells.has(key)) { cells.add(key); sites.push(i / 3); }
  }
  return sites;
}

// Prepared files retain a common coordinate frame and a scalar array per source vector field.
export function decodeGeometry(buffer, fieldOrder) {
  const header = new DataView(buffer);
  if (buffer.byteLength < 16 || header.getUint32(0, true) !== 0x414E4531) throw new Error('Invalid geometry header');
  const vertices = header.getUint32(4, true), indexCount = header.getUint32(8, true), fieldCount = header.getUint32(12, true);
  const expected = 16 + vertices * 12 + indexCount * 4 + vertices * fieldCount * 4;
  if (expected !== buffer.byteLength || indexCount % 3 || (fieldCount !== 0 && fieldCount !== fieldOrder.length)) throw new Error('Invalid geometry dimensions');
  const positions = new Float32Array(buffer, 16, vertices * 3);
  const indices = new Uint32Array(buffer, 16 + vertices * 12, indexCount);
  if (!positions.every(Number.isFinite) || !indices.every(index => index < vertices)) throw new Error('Invalid mesh coordinates');
  const fields = new Map();
  let offset = 16 + vertices * 12 + indexCount * 4;
  for (let index = 0; index < fieldCount; index++) {
    const values = new Float32Array(buffer, offset, vertices);
    if (!values.every(value => Number.isFinite(value) && value >= 0)) throw new Error('Invalid field magnitude');
    fields.set(fieldOrder[index], values);
    offset += vertices * 4;
  }
  return { positions, indices, fields, vertices };
}

// Geometry is unchanged. Legacy packets use exact float32 XOR deltas; compact
// packets use 16-bit range mapping with one fixed maximum per field across time.
export function decodeTimeSeries(buffer) {
  if (buffer.byteLength < 16) throw new Error('Invalid time-series header');
  const header = new DataView(buffer);
  const magic = header.getUint32(0, true);
  if (![0x41545331, 0x41545333].includes(magic)) throw new Error('Invalid time-series header');
  const vertices = header.getUint32(4, true), frameCount = header.getUint32(8, true), fieldCount = header.getUint32(12, true);
  const stride = vertices * fieldCount;
  const count = stride * frameCount;
  if (!vertices || frameCount < 2 || ![1, 2].includes(fieldCount)) throw new Error('Invalid time-series dimensions');
  let values;
  if (magic === 0x41545331) {
    if (buffer.byteLength !== 16 + count * 4) throw new Error('Invalid time-series dimensions');
    const bits = new Uint32Array(buffer, 16);
    for (let index = stride; index < bits.length; index++) bits[index] ^= bits[index - stride];
    values = new Float32Array(buffer, 16);
  } else {
    const offset = 16 + fieldCount * 8;
    if (buffer.byteLength !== offset + count * 2) throw new Error('Invalid time-series dimensions');
    const maxima = Array.from({ length: fieldCount }, (_, field) => header.getFloat64(16 + field * 8, true));
    if (!maxima.every(value => Number.isFinite(value) && value >= 0)) throw new Error('Invalid time-series range');
    const low = new Uint8Array(buffer, offset, count), high = new Uint8Array(buffer, offset + count, count);
    const previous = new Uint16Array(stride);
    values = new Float32Array(count);
    for (let frame = 0; frame < frameCount; frame++) {
      for (let field = 0; field < fieldCount; field++) {
        const start = (frame * fieldCount + field) * vertices;
        const step = maxima[field] / 65535;
        for (let index = start; index < start + vertices; index++) {
          const slot = index - frame * stride;
          previous[slot] = (low[index] | high[index] << 8) + previous[slot];
          values[index] = previous[slot] * step;
        }
      }
    }
  }
  if (!values.every(value => Number.isFinite(value) && value >= 0)) throw new Error('Invalid time-series magnitude');
  return { vertices, frameCount, fieldCount, values };
}


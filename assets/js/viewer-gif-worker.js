import { GIFEncoder, quantize, applyPalette } from './vendor/gifenc/gifenc.esm.js';

let encoder, palette;
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'frame') {
      const rgba = new Uint8Array(data.pixels);
      if (!encoder) {
        encoder = GIFEncoder();
        // Include the complete color ramps, even when the first timestep has low values.
        // One palette for the full cycle keeps colors and legends stable between frames.
        const ramps = new Uint8Array(data.ramps);
        const sample = new Uint8Array(Math.ceil(rgba.length / 64) * 4 + ramps.length);
        let offset = 0;
        for (let i = 0; i < rgba.length; i += 64) { sample.set(rgba.subarray(i, i + 4), offset); offset += 4; }
        sample.set(ramps, offset);
        palette = quantize(sample, 256);
      }
      const index = applyPalette(rgba, palette);
      encoder.writeFrame(index, data.width, data.height, { palette: data.first ? palette : undefined, delay: data.delay, repeat: 0, dispose: 1 });
      self.postMessage({ type: 'frame' });
    } else if (data.type === 'finish') {
      encoder.finish();
      const bytes = encoder.bytes();
      self.postMessage({ type: 'finish', bytes: bytes.buffer }, [bytes.buffer]);
    }
  } catch (error) { self.postMessage({ error: error.message }); }
};

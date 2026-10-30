# Three.js

Pinned release: **r186 / npm version 0.186.0**, MIT license (see `LICENSE`).

These local files avoid runtime CDN requests and do not require an npm build:

- `three.module.min.js`: https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.min.js
- `three.core.min.js`: https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.core.min.js
- `OrbitControls.js`: https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/jsm/controls/OrbitControls.js
- `LICENSE`: https://raw.githubusercontent.com/mrdoob/three.js/r186/LICENSE

The minified modules are jsDelivr's Terser 5.48.0 minifications of the upstream npm package's `three.module.js` and `three.core.js` build artifacts, saved locally. The release is documented at https://github.com/mrdoob/three.js/releases/tag/r186 and the npm package metadata at https://registry.npmjs.org/three/0.186.0.

Local modifications: the single bare `three` import in `OrbitControls.js` is changed to `./three.module.min.js`; both `./three.core.js` import/re-export references in `three.module.min.js` are changed to `./three.core.min.js`. No import map or bundler is required. `three.core.min.js` is unchanged. Preserve the upstream license notices when updating.

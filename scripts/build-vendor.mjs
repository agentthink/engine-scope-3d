import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const localEsbuild = path.resolve(projectRoot, 'node_modules/esbuild/lib/main.js');
const siblingRoot = path.resolve(projectRoot, '../threejs-pond');
const siblingEsbuild = path.resolve(siblingRoot, 'node_modules/esbuild/lib/main.js');

const esbuildPath = fs.existsSync(localEsbuild) ? localEsbuild : siblingEsbuild;
const resolveBase = fs.existsSync(localEsbuild) ? projectRoot : siblingRoot;
const esbuild = await import(pathToFileURL(esbuildPath).href);

const entryContent = `
import * as THREE_CORE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const THREE = Object.assign({}, THREE_CORE, {
  OrbitControls,
  RoomEnvironment,
  EffectComposer,
  RenderPass,
  UnrealBloomPass,
  OutlinePass,
  OutputPass,
  CSS2DRenderer,
  CSS2DObject,
  mergeGeometries
});

window.THREE = THREE;
export default THREE;
`;

await esbuild.build({
  stdin: {
    contents: entryContent,
    resolveDir: resolveBase,
    loader: 'js'
  },
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  outfile: path.resolve(projectRoot, 'lib/three.bundle.js')
});

console.log('Built lib/three.bundle.js successfully.');

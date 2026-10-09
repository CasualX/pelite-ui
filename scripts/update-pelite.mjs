import { accessSync, constants, copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const packageRoot = process.argv[2]
	? resolve(process.argv[2])
	: resolve(require.resolve('pelite-js/package.json'), '..');
const destination = resolve(uiRoot, 'dist/deps');

const artifacts = [
	['dist/pelite.js', 'pelite.js'],
	['dist/pelite.wasm', 'pelite.wasm'],
	['dist/pelite.d.ts', 'pelite.d.ts'],
	['license.txt', 'pelite-license.txt'],
];
// Check the complete package before replacing the UI's current copy.
for (const [source] of artifacts) accessSync(resolve(packageRoot, source), constants.R_OK);
mkdirSync(destination, { recursive: true });
for (const [source, target] of artifacts) copyFileSync(resolve(packageRoot, source), resolve(destination, target));
console.log(`Updated ${destination} from ${packageRoot}.`);

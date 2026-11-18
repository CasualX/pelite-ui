import { accessSync, constants, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = fileURLToPath(new URL('../', import.meta.url));
const packageRoot = process.argv[2]
	? resolve(process.argv[2])
	: resolve(uiRoot, '../pelite/pelite-js');
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

let revision = null;
let sourceModified = null;
try {
	revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: packageRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	sourceModified = execFileSync('git', ['diff', 'HEAD', '--', 'src', 'rust', 'scripts', 'package.json', 'tsconfig.json'], { cwd: packageRoot, stdio: ['ignore', 'pipe', 'ignore'] }).length > 0;
} catch {}
writeFileSync(resolve(destination, 'pelite-source.json'), JSON.stringify({
  repository: 'https://github.com/CasualX/pelite', revision, sourceModified,
  sha256: Object.fromEntries(artifacts.map(([, target]) => [target, createHash('sha256').update(readFileSync(resolve(destination, target))).digest('hex')])),
}, null, 2) + '\n');

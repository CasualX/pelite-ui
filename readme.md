# PeLite UI

A browser-based Windows PE inspector powered by pelite and WebAssembly, built with Vue-Script. Files are analyzed locally in your browser.

## Building

Install Node.js, npm, and Vue-Script, then run:

```sh
npm ci
npm run check
npm run build
```

`npm ci` installs the prebuilt `pelite-js` package from the published
[pelite-js-v0.1.0 release](https://github.com/CasualX/pelite/releases/tag/pelite-js-v0.1.0).
Its postinstall step copies the JavaScript, wasm, type declarations, and license
into `dist/deps`. No local pelite checkout or Rust wasm build is required.
Serve `dist` over HTTP to use the inspector.

GitHub Pages runs `npm ci --ignore-scripts`, then checks and builds using the
committed files in `dist/deps`. This skips the postinstall copy, so CI can deploy
a development build of pelite before a new package release is published.

## Updating pelite-js

The release URL is pinned in `package.json`, with its integrity recorded in
`package-lock.json`. To adopt a newer published release, install its tarball:

```sh
npm install --save-exact https://github.com/CasualX/pelite/releases/download/pelite-js-v0.1.0/pelite-js-0.1.0.tgz
npm run update:pelite
npm run check
npm run build
```

Replace both version numbers in the URL with the new release version.
`npm run update:pelite` copies `pelite.js`, `pelite.wasm`, `pelite.d.ts`, and
`pelite-license.txt` from the installed package into `dist/deps`.
Keep the JavaScript and wasm from the same package together: the module loads
its adjacent wasm file during import. Check opening and closing a PE file,
the hex dump, and disassembly after an update. Commit `package.json`,
`package-lock.json`, the updated files in `dist/deps`, and any required UI fixes.

## Using a local development build

Build `pelite-js` in your local pelite checkout, then copy its package directory:

```sh
npm --prefix ../pelite/pelite-js ci
npm --prefix ../pelite/pelite-js run build
npm run update:pelite -- ../pelite/pelite-js
npm run check
npm run build
```

Adjust the checkout path as needed. Leave the copied files unstaged for local
experiments, or commit them to have CI deploy that build. The release dependency
can stay pinned while the vendored build moves ahead during development.
Check and build commands preserve the current copy. To reinstall npm dependencies
without replacing it, use `npm ci --ignore-scripts`; normal `npm ci` and
`npm run update:pelite` restore the installed GitHub release assets.

License
-------

Licensed under [GPL 3.0 License](https://opensource.org/licenses/GPL-3.0), see [license.txt](license.txt).

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in the work by you, shall be licensed as above, without any additional terms or conditions.

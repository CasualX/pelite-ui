# PeLite UI

A browser-based Windows PE inspector powered by pelite and WebAssembly, built with Vue-Script. Files are analyzed locally in your browser.

## Building

Install Node.js, npm, and Vue-Script, then run:

```sh
npm ci
npm run check
npm run build
```

The matching JavaScript, WASM, type declarations, and license are vendored in
`dist/deps`. Ordinary `npm ci`, checks, and builds preserve this copy; no pelite
checkout or Rust build is needed. Serve `dist` over HTTP to use the inspector.
GitHub Pages deploys the same committed assets.

## Facts analysis

Open a PE file, then choose **Analysis → Facts**. Two horizontal views separate
inspection from editing:

- **Inspect facts** combines the visible layers in a full-width, read-only record
  table. The image address map, layer checkboxes, search, kind, section, and
  inclusive hexadecimal RVA filters work across these layers. Right-click an
  address to navigate to Hex Dump or Disassembly. The table displays records by
  RVA with 100 per page; duplicates remain separate records.
- **Manage layers** contains the layers table, import, and layer controls. Create,
  rename, duplicate, reorder, merge, or delete layers, then edit the selected layer
  below the table. Add, edit, or remove individual facts, or edit the complete
  native `#factmap` text. The editor shows stored record order independently of
  the inspection filters. Deletions require confirmation; undo/redo retains up to
  40 changes. Drafts survive switching views.

Import one or more `.factmap`, legacy `.symtext`, or text files to append separate
layers. WASM validates the entire batch before adding any layer. **Export factmap**
saves the selected layer as native text. File comments and source formatting are
canonicalized; fact comments and duplicate records are retained. Merging appends
the selected layer’s records to the preceding layer and keeps the preceding label
and visibility. No override resolution or deduplication is applied.

The database belongs to the open PE and survives closing the Facts tab, but is
held only in memory. Export individual factmaps before closing or reloading.
Facts currently do not affect disassembly, scanning, or other `PeFile` operations.

## Updating the vendored pelite build

Build in a local pelite checkout, then copy its package directory:

```sh
npm --prefix ../pelite/pelite-js ci
npm --prefix ../pelite/pelite-js run build
npm run update:pelite
npm run check
npm run build
```

The updater defaults to `../pelite/pelite-js`; pass another package directory with
`npm run update:pelite -- /path/to/pelite-js`. Always update JS and WASM together.
Commit the files in `dist/deps`, including `pelite-source.json` provenance.
The Facts editor uses the existing layer APIs: it validates a replacement with
`addLayer`, preserves the label, moves the new layer into place with `shiftLayer`,
and removes the original with `deleteLayer`. No pelite API changes are required.

## UI document ownership

The UI passes one `PeDocument` for each open binary. It owns the browser `File`,
the native `peFile`, and a lazily initialized `facts` database. View preparation,
live viewers, and address navigation share this object; they do not independently
own or dispose the native handles. Closing the binary disposes the whole document.
The pelite.js `PeFile` and `Facts` APIs remain independent.

## Browser regression checks

After building, serve the repository root (for example,
`python3 -m http.server 8000 --bind 127.0.0.1`) and open
`http://127.0.0.1:8000/tests/facts.html`. The integration suite creates synthetic
PE32 and PE32+ fixtures and exercises editing, duplicate identity, atomic
validation, layer operations, undo/redo, filters, factmap I/O,
pagination, close protection, and native-handle disposal through the running UI.
It does not require binary fixtures from a separate checkout.

License
-------

Licensed under [GPL 3.0 License](https://opensource.org/licenses/GPL-3.0), see [license.txt](license.txt).

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in the work by you, shall be licensed as above, without any additional terms or conditions.

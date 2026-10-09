<link rel="component" href="../../components/property-grid.vue">

<script>
/** @typedef {{ ordinal: number, target: number | null | string, names: string[] }} ExportRow */
/** @typedef {{ directory: import('./deps/pelite.js').PeExportDirectory, rows: ExportRow[], state: { query: string } }} ExportsViewData */

/** @param {ViewContext} context @returns {boolean} */
function isExportsAvailable(context) {
	const exports = context.peFile.exports();
	return exports !== null && !(exports instanceof Error);
}

/** @param {number} value @returns {string} */
function formatExportHex(value) {
	return value === 0 ? '0' : `0x${value.toString(16)}`;
}

/** @param {ViewContext} context @returns {ViewContent} */
function prepareExportsView(context) {
	const result = context.peFile.exports();
	if (result instanceof Error) throw result;
	// The serializer returns null when the export lookup tables cannot be parsed.
	if (result === null) throw new Error('The export tables could not be parsed.');
	const directory = /** @type {import('./deps/pelite.js').PeExportDirectory} */ (/** @type {unknown} */ (result));
	// One row per function slot, in ordinal order; aliases share the Name cell.
	const rows = directory.functions.map((target, index) => ({
		ordinal: directory.ordinal_base + index, target, names: /** @type {string[]} */ ([]),
	}));
	for (const [name, index] of Object.entries(directory.names)) rows[index].names.push(name);
	return {
		component: 'view-exports',
		data: { directory, rows, state: { query: '' } },
	};
}

const ViewExports = Vue.defineComponent({
	template: '#view-exports',
	props: { data: { type: Object, required: true } },
	data() {
		return {
			headerInterpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', style: { minWidth: '240px' }, format: (value, name) => String(name) },
				{ title: 'Value', style: { minWidth: '140px', textAlign: 'right' }, format: value => typeof value === 'number' ? formatExportHex(value) : String(value) },
				{ title: 'Interpretation', style: { minWidth: '240px' }, format: (value, name) => {
					if (name !== 'TimeDateStamp') return '';
					const timestamp = Number(value);
					if (timestamp === 0 || timestamp === 0xffffffff) return 'Unspecified';
					return new Date(timestamp * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
				} },
			]),
		};
	},
	computed: {
		interpretations() {
			const columns = /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Ordinal', style: { minWidth: '80px', textAlign: 'right' }, format: value => String((/** @type {ExportRow} */ (value)).ordinal) },
				{ title: 'Name', style: { minWidth: '260px' }, format: value => (/** @type {ExportRow} */ (value)).names.join('\n') || '—' },
				{ title: 'RVA', kind: 'rva', style: { minWidth: '120px', textAlign: 'right' }, format: value => {
					const row = /** @type {ExportRow} */ (value);
					return row.target === null ? 'null' : typeof row.target === 'number' ? formatExportHex(row.target) : '';
				} },
			]);
			if (this.exportsData.rows.some(row => typeof row.target === 'string')) {
				columns.push({ title: 'Forwarded to', style: { minWidth: '220px' }, format: value => {
					const target = (/** @type {ExportRow} */ (value)).target;
					return typeof target === 'string' ? target : '';
				} });
			}
			return columns;
		},
		exportsData() {
			return /** @type {ExportsViewData} */ (/** @type {unknown} */ (this.data));
		},
		state() { return this.exportsData.state; },
		filteredRows() {
			const query = this.state.query.trim().toLowerCase();
			if (!query) return this.exportsData.rows;
			return this.exportsData.rows.filter(row =>
				[String(row.ordinal), ...row.names, typeof row.target === 'number' ? formatExportHex(row.target) : String(row.target)]
					.some(value => value.toLowerCase().includes(query))
			);
		},
	},
});
</script>

<template id="view-exports">
	<section class="view-exports">
		<strong class="view-exports__dll">{{ data.directory.dll_name ?? 'DLL name unavailable' }}</strong>
		<details class="view-exports__header">
			<summary>Directory header</summary>
			<property-grid :list="data.directory.image" :interpretations="headerInterpretations" label="Export directory header"></property-grid>
		</details>
		<label class="view-exports__search">Search
			<input v-model="state.query" type="search" placeholder="Name, ordinal, RVA, or forwarder" spellcheck="false" autocomplete="off">
		</label>
		<property-grid v-if="filteredRows.length" :list="filteredRows" :interpretations="interpretations" label="Exports"></property-grid>
		<p v-else class="view-exports__empty">{{ data.rows.length ? 'No matching entries.' : 'No exports.' }}</p>
	</section>
</template>

<style>
.view-exports__dll { display: block; margin-bottom: 24px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 15px; }
.view-exports__header { margin-bottom: 24px; }
.view-exports__header summary { width: max-content; margin-bottom: 12px; font-size: 12px; font-weight: 600; cursor: pointer; user-select: none; }
.view-exports__search { display: flex; flex-direction: column; gap: 8px; max-width: 540px; margin-bottom: 24px; font-size: 12px; }
.view-exports__search input { min-width: 0; height: 36px; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); color: var(--color-text); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; }
.view-exports__search input::placeholder { color: color-mix(in srgb, var(--color-muted) 55%, var(--color-surface)); }
.view-exports__search input:focus-visible, .view-exports__header summary:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.view-exports__empty { margin: 0; color: var(--color-muted); font-size: 12px; }
</style>

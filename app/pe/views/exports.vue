<link rel="component" href="../../components/property-grid.vue">
<link rel="component" href="filter-toolbar.vue">

<script>
const exportSearchFields = /** @type {const} */ (['Name', 'Ordinal', 'RVA', 'Forwarder']);
/** @typedef {(typeof exportSearchFields)[number]} ExportSearchField */
/** @typedef {{ ordinal: number, target: number | null | string, names: string[] }} ExportRow */
/** @typedef {{ directory: PeLite.PeExportDirectory, rows: ExportRow[], state: { query: string, matchFields: ExportSearchField[] } }} ExportsViewData */

/** @param {number} value @returns {string} */
function formatExportHex(value) {
	return value === 0 ? '0' : `0x${value.toString(16)}`;
}

/** @param {PeDocument} context @returns {ViewContent} */
function prepareExportsView(context) {
	const result = context.peFile.exports();
	if (result instanceof Error) throw result;
	// The serializer returns null when the export lookup tables cannot be parsed.
	if (result === null) throw new Error('The export tables could not be parsed.');
	const directory = /** @type {PeLite.PeExportDirectory} */ (/** @type {unknown} */ (result));
	// One row per function slot, in ordinal order; aliases share the Name cell.
	const rows = directory.functions.map((target, index) => ({
		ordinal: directory.ordinal_base + index, target, names: /** @type {string[]} */ ([]),
	}));
	for (const [name, index] of Object.entries(directory.names)) rows[index].names.push(name);
	return {
		component: 'view-exports',
		data: { directory, rows, state: { query: '', matchFields: [...exportSearchFields] } },
	};
}

const ViewExports = Vue.defineComponent({
	template: '#view-exports',
	components: { PeFilterToolbar },
	props: { data: { type: Object, required: true } },
	data() {
		return {
			searchFields: exportSearchFields,
			headerInterpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', width: 'clamp(11rem, 26.5cqi, 16rem)', format: (value, name) => String(name) },
				{ title: 'Value', kind: (value, field) => value && ['Name', 'AddressOfFunctions', 'AddressOfNames', 'AddressOfNameOrdinals'].includes(String(field)) ? 'rva' : undefined,
					width: 'clamp(7.5rem, 18.5cqi, 10rem)', style: { textAlign: 'right' }, format: value => typeof value === 'number' ? formatExportHex(value) : String(value) },
				{ title: 'Interpretation', format: (value, name) => {
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
				{ title: 'Ordinal', width: '7rem', style: { textAlign: 'right' }, format: value => String((/** @type {ExportRow} */ (value)).ordinal) },
				{ title: 'Name', format: value => (/** @type {ExportRow} */ (value)).names.join('\n') || '—' },
				{ title: 'RVA', kind: value => typeof (/** @type {ExportRow} */ (value)).target === 'number' ? 'rva' : undefined,
					width: '8rem', style: { textAlign: 'right' }, format: value => {
					const row = /** @type {ExportRow} */ (value);
					return row.target === null ? 'null' : typeof row.target === 'number' ? formatExportHex(row.target) : '';
				} },
			]);
			if (this.exportsData.rows.some(row => typeof row.target === 'string')) {
				columns.push({ title: 'Forwarded to', format: value => {
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
			const fields = this.state.matchFields;
			return this.exportsData.rows.filter(({ ordinal, names, target }) => (
				(fields.includes('Name') && names.some(name => name.toLowerCase().includes(query))) ||
				(fields.includes('Ordinal') && String(ordinal).includes(query)) ||
				(fields.includes('RVA') && typeof target !== 'string' && (target === null ? 'null' : formatExportHex(target)).includes(query)) ||
				(fields.includes('Forwarder') && typeof target === 'string' && target.toLowerCase().includes(query))
			));
		},
	},
});
</script>

<template id="view-exports">
	<section class="view-exports">
		<strong class="view-exports__dll">{{ data.directory.dll_name ?? 'DLL name unavailable' }}</strong>
		<details class="view-exports__header">
			<summary>Directory header</summary>
			<property-grid :list="data.directory.image" :interpretations="headerInterpretations" min-width="27rem" label="Export directory header"></property-grid>
		</details>
		<pe-filter-toolbar label="Filter exports" :fields="searchFields" v-model:query="state.query" v-model:match-fields="state.matchFields">
			<span class="view-exports__count" role="status">{{ filteredRows.length.toLocaleString() }} {{ filteredRows.length === 1 ? 'export' : 'exports' }}</span>
		</pe-filter-toolbar>
		<property-grid v-if="filteredRows.length" :list="filteredRows" :interpretations="interpretations" min-width="30rem" label="Exports"></property-grid>
		<p v-else class="view-exports__empty">{{ data.rows.length ? 'No matching entries.' : 'No exports.' }}</p>
	</section>
</template>

<style>
.view-exports__dll { display: block; padding-block: 14px; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 15px; }
.view-exports__header { margin-inline: calc(-1 * var(--workspace-view-inline-padding, 0px)); border-block: 1px solid var(--color-border); }
.view-exports__header > summary { padding: 8px var(--workspace-view-inline-padding, 12px); background: var(--color-surface); font-size: 12px; font-weight: 600; cursor: pointer; }
.view-exports__header > summary::marker { color: var(--color-muted); }
.view-exports__header > summary:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.view-exports__header .property-grid { margin-inline: 0; }
.view-exports__count { margin-inline-start: auto; color: var(--color-muted); font-size: 12px; }
.view-exports__empty { margin: 12px 0 0; color: var(--color-muted); font-size: 12px; }
</style>

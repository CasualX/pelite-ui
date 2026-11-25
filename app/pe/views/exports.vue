<link rel="component" href="../../components/property-grid.vue">
<link rel="component" href="filter-toolbar.vue">

<script>
const exportSearchFields = /** @type {const} */ (['Name', 'Forwarder', 'Ord', 'RVA']);
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
		data: { directory, rows, state: { query: '', matchFields: ['Name', 'Forwarder'] } },
	};
}

const ViewExports = Vue.defineComponent({
	template: '#view-exports',
	components: { PeFilterToolbar },
	props: { data: { type: Object, required: true } },
	data() {
		return { searchFields: exportSearchFields, directoryId: Vue.useId(), directoryOpen: false };
	},
	computed: {
		/** @returns {PropertyGridColumn[]} */
		headerInterpretations() {
			return [
				{ title: 'Field', width: 'clamp(0px, 37cqi, 16rem)', format: (value, name) => String(name) },
				{ title: 'Value', kind: (value, field) => value && ['Name', 'AddressOfFunctions', 'AddressOfNames', 'AddressOfNameOrdinals'].includes(String(field)) ? 'rva' : undefined,
					width: 'clamp(0px, 26cqi, 10rem)', style: { textAlign: 'right' }, format: value => typeof value === 'number' ? formatExportHex(value) : String(value) },
				{ title: 'Interpretation', format: (value, name) => {
					if (name === 'Name') return this.exportsData.directory.dll_name ?? 'DLL name unavailable';
					if (name !== 'TimeDateStamp') return '';
					const timestamp = Number(value);
					if (timestamp === 0 || timestamp === 0xffffffff) return 'Unspecified';
					return new Date(timestamp * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
				} },
			];
		},
		interpretations() {
			const columns = /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Ord', label: 'Ordinal', width: 'calc(3.1em + var(--workspace-gutter, 12px) + 12px)', style: { textAlign: 'right' },
					format: value => String((/** @type {ExportRow} */ (value)).ordinal) },
				{ title: 'RVA', kind: value => typeof (/** @type {ExportRow} */ (value)).target === 'number' ? 'rva' : undefined,
					width: 'calc(6.25em + 24px)', style: { textAlign: 'right' }, format: value => {
					const row = /** @type {ExportRow} */ (value);
					return row.target === null ? 'null' : typeof row.target === 'number' ? formatExportHex(row.target) : '';
				} },
				{ title: 'Name', format: value => (/** @type {ExportRow} */ (value)).names.join('\n') || '—' },
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
				(fields.includes('Ord') && String(ordinal).includes(query)) ||
				(fields.includes('RVA') && typeof target !== 'string' && (target === null ? 'null' : formatExportHex(target)).includes(query)) ||
				(fields.includes('Forwarder') && typeof target === 'string' && target.toLowerCase().includes(query))
			));
		},
	},
});
</script>

<template id="view-exports">
	<section class="view-exports" :class="{ 'view-exports--directory-open': directoryOpen }">
		<pe-filter-toolbar label="Filter exports" :fields="searchFields" v-model:query="state.query" v-model:match-fields="state.matchFields">
			<div class="view-exports__toolbar-end">
				<span class="view-exports__count" role="status">{{ filteredRows.length.toLocaleString() }} {{ filteredRows.length === 1 ? 'export' : 'exports' }}</span>
				<button class="view-exports__header" type="button" :aria-expanded="directoryOpen"
					:aria-controls="directoryId" @click="directoryOpen = !directoryOpen">
					Directory header
					<svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
						<path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			</div>
		</pe-filter-toolbar>
		<div class="view-exports__body">
			<div :id="directoryId" class="view-exports__directory" :inert="!directoryOpen">
				<property-grid class="property-grid--scrollable" tabindex="0" :list="data.directory.image" :interpretations="headerInterpretations"
					label="Export directory header"></property-grid>
			</div>
			<property-grid v-if="filteredRows.length" class="view-exports__results property-grid--scrollable" tabindex="0"
				:list="filteredRows" :interpretations="interpretations" label="Exports"></property-grid>
			<p v-else class="view-exports__empty">{{ data.rows.length ? 'No matching entries.' : 'No exports.' }}</p>
		</div>
	</section>
</template>

<style>
.view-exports { container: export-pane / size; display: flex; flex-direction: column; height: 100%; overflow: clip; }
.view-exports__toolbar-end { display: flex; flex: none; align-items: center; gap: 12px; margin-inline-start: auto; white-space: nowrap; }
.view-exports__count { padding-inline-end: 12px; border-inline-end: 1px solid var(--color-border); color: var(--color-muted); font-size: 12px; line-height: 18px; }
.view-exports__header { display: flex; align-items: center; gap: 6px; min-height: 28px; padding: 4px 10px; border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--color-muted); font-size: 12px; cursor: pointer; }
.view-exports__header:hover { border-color: var(--color-border); color: var(--color-text); }
.view-exports__header[aria-expanded="true"] { border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-border)); background: color-mix(in srgb, var(--color-accent) 14%, var(--color-surface)); color: var(--color-accent-hover); }
.view-exports__header[aria-expanded="true"] svg { transform: rotate(180deg); }
.view-exports__body { display: flex; flex: 1; flex-direction: column; min-height: 0; }
.view-exports__directory { display: grid; grid-template-rows: 0fr; flex: none; min-height: 0; overflow: clip; transition: grid-template-rows 180ms ease-out; }
.view-exports--directory-open .view-exports__directory { grid-template-rows: 1fr; }
.view-exports__directory > .property-grid { align-self: start; min-height: 0; background: var(--color-background); }
.view-exports__results { flex: 1; min-height: 0; }
.view-exports__header:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.view-exports__empty { margin: 12px var(--workspace-gutter) 0; color: var(--color-muted); font-size: 12px; }
@container export-pane (height < 34rem) or (width < 22rem) {
	/* Give the open directory the rows area when there is too little room for both tables. */
	.view-exports__body { display: grid; grid-template-rows: minmax(0, 1fr); }
	.view-exports__body > * { grid-area: 1 / 1; }
	.view-exports__directory { z-index: 1; }
	.view-exports__directory > .property-grid { align-self: stretch; }
	.view-exports--directory-open :is(.view-exports__results, .view-exports__empty) { display: none; }
}
@media (prefers-reduced-motion: reduce) {
	.view-exports__directory { transition: none; }
}
</style>

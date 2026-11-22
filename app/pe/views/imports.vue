<link rel="component" href="../../components/property-grid.vue">

<script>
const importSearchFields = /** @type {const} */ (['DLL', 'Name', 'Ordinal', 'Hint', 'IAT RVA']);
/** @typedef {(typeof importSearchFields)[number]} ImportSearchField */
/** @typedef {{ descriptors: PeLite.PeImportDescriptor[], state: { query: string, matchFields: ImportSearchField[], selectedIndex: number | null } }} ImportsViewData */
/** @typedef {{ descriptor: PeLite.PeImportDescriptor, index: number, rows: PeLite.PeImportEntry[] | null }} ImportModule */

/** @param {number} value @returns {string} */
function formatImportHex(value) {
	return value === 0 ? '0' : `0x${value.toString(16)}`;
}

/** @type {Record<Exclude<ImportSearchField, 'DLL'>, (row: PeLite.PeImportEntry) => string>} */
const importSearchValues = {
	Name: row => row.import?.ByName?.name ?? '',
	Ordinal: row => String(row.import?.ByOrdinal?.ord ?? ''),
	Hint: row => String(row.import?.ByName?.hint ?? ''),
	'IAT RVA': row => formatImportHex(row.address),
};

/** @param {PeDocument} context @returns {ViewContent} */
function prepareImportsView(context) {
	const result = context.peFile.imports();
	if (result instanceof Error) throw result;
	if (result === null) throw new Error('The import directory is unavailable.');
	return { component: 'view-imports', data: { descriptors: result, state: { query: '', matchFields: ['DLL', 'Name'], selectedIndex: null } } };
}

const ViewImports = Vue.defineComponent({
	template: '#view-imports',
	props: { data: { type: Object, required: true } },
	data() {
		return {
			searchFields: importSearchFields,
			libraryColumns: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Library', slot: 'library' },
				{ title: '#', label: 'Functions', width: 'calc(3.125rem + var(--workspace-view-inline-padding))', style: { textAlign: 'right' }, format: value => {
					const rows = (/** @type {ImportModule} */ (value)).rows;
					return rows?.length.toLocaleString() ?? '—';
				} },
			]),
			interpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'IAT RVA', width: 'calc(5.5rem + var(--workspace-view-inline-padding))', kind: 'rva',
					format: value => formatImportHex((/** @type {PeLite.PeImportEntry} */ (value)).address) },
				{ title: 'Name', format: value => {
					const symbol = (/** @type {PeLite.PeImportEntry} */ (value)).import;
					return symbol === null ? 'Unavailable' : symbol.ByName?.name ?? '—';
				} },
				{ title: 'Ordinal', width: '5.5rem', style: { textAlign: 'right' }, format: value => {
					const ordinal = (/** @type {PeLite.PeImportEntry} */ (value)).import?.ByOrdinal?.ord;
					return ordinal === undefined ? '' : String(ordinal);
				} },
				{ title: 'Hint', width: '5rem', style: { textAlign: 'right' }, format: value => {
					const hint = (/** @type {PeLite.PeImportEntry} */ (value)).import?.ByName?.hint;
					return hint === undefined ? '' : String(hint);
				} },
			]),
			headerInterpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', width: 'max(10.5rem, 26.5cqi)', format: (value, name) => String(name) },
				{ title: 'Value', kind: (value, field) => value && ['OriginalFirstThunk', 'Name', 'FirstThunk'].includes(String(field)) ? 'rva' : undefined,
					width: 'max(7.5rem, 18.5cqi)', style: { textAlign: 'right' }, format: value => typeof value === 'number' ? formatImportHex(value) : String(value) },
				{ title: 'Interpretation', format: (value, name) => {
					if (name !== 'TimeDateStamp') return '';
					const timestamp = Number(value);
					if (timestamp === 0) return 'Not bound';
					if (timestamp === 0xffffffff) return 'See bound import directory';
					return new Date(timestamp * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
				} },
			]),
		};
	},
	computed: {
		importsData() { return /** @type {ImportsViewData} */ (/** @type {unknown} */ (this.data)); },
		state() { return this.importsData.state; },
		/** @returns {ImportModule[]} */
		filteredDescriptors() {
			const query = this.state.query.trim().toLowerCase();
			const matchDll = this.state.matchFields.includes('DLL');
			const rowFields = this.state.matchFields.filter(field => field !== 'DLL');
			return this.importsData.descriptors.map((descriptor, index) => {
				const dllMatches = !query || (matchDll && (descriptor.dll_name ?? '').toLowerCase().includes(query));
				const rows = dllMatches ? descriptor.imports : descriptor.imports?.filter(row =>
					rowFields.some(field => importSearchValues[field](row).toLowerCase().includes(query))
				) ?? null;
				return { descriptor, index, rows, visible: dllMatches || !!rows?.length };
			}).filter(group => group.visible);
		},
		selectedModule() {
			return this.filteredDescriptors.find(group => group.index === this.state.selectedIndex) ?? this.filteredDescriptors[0];
		},
	},
	methods: {
		/** @param {ImportSearchField} field */
		toggleSearchField(field) {
			const fields = this.state.matchFields;
			if (!fields.includes(field)) fields.push(field);
			else if (fields.length > 1) this.state.matchFields = fields.filter(selected => selected !== field);
		},
	},
});
</script>

<template id="view-imports">
	<section class="view-imports">
		<div class="view-imports__toolbar">
			<div class="view-imports__search">
				<input v-model="state.query" type="search" aria-label="Filter imports" placeholder="Filter imports" spellcheck="false" autocomplete="off">
			</div>
			<div class="view-imports__filters" role="group" aria-label="Match in">
				<span aria-hidden="true">Match in</span>
				<button v-for="field in searchFields" :key="field" type="button" :aria-pressed="state.matchFields.includes(field)"
					:disabled="state.matchFields.length === 1 && state.matchFields.includes(field)" @click="toggleSearchField(field)">{{ field }}</button>
			</div>
		</div>
		<div v-if="selectedModule" class="view-imports__layout">
			<property-grid class="view-imports__libraries" :list="filteredDescriptors" :interpretations="libraryColumns" :row-key="library => library.index" label="Imported libraries">
				<template #library="{ value: library }">
					<button type="button" class="view-imports__library" :title="library.descriptor.dll_name ?? 'DLL name unavailable'"
						:aria-current="library.index === selectedModule.index ? 'true' : undefined" @click="state.selectedIndex = library.index">{{ library.descriptor.dll_name ?? 'DLL name unavailable' }}</button>
				</template>
			</property-grid>
			<section class="view-imports__details" tabindex="0" :aria-label="'Imports from ' + (selectedModule.descriptor.dll_name ?? 'unknown DLL')">
				<h2>Directory descriptor</h2>
				<property-grid :list="selectedModule.descriptor.image" :interpretations="headerInterpretations" min-width="27rem" label="Import directory descriptor"></property-grid>
				<h2>Functions</h2>
				<property-grid v-if="selectedModule.rows?.length" :list="selectedModule.rows" :interpretations="interpretations" min-width="30rem" :label="'Imports from ' + (selectedModule.descriptor.dll_name ?? 'unknown DLL')"></property-grid>
				<p v-else class="view-imports__empty">{{ selectedModule.rows === null ? 'The import lookup table could not be parsed.' : 'No imported symbols.' }}</p>
			</section>
		</div>
		<p v-else class="view-imports__empty">{{ importsData.descriptors.length ? 'No matching entries.' : 'The import directory is empty.' }}</p>
	</section>
</template>

<style>
.workspace-area__view:has(> .view-imports) { padding-block-end: 0; overflow: clip; }
.view-imports { display: flex; flex-direction: column; block-size: 100%; }
.view-imports__toolbar, .view-imports__layout { margin-inline: calc(-1 * var(--workspace-view-inline-padding)); }
.view-imports__toolbar { display: flex; flex: none; flex-wrap: wrap; align-items: center; gap: 6px 14px; padding: 7px var(--workspace-view-inline-padding); border-block-end: 1px solid var(--color-border); background: var(--color-surface); }
.view-imports__search { position: relative; flex: 0 1 16rem; max-inline-size: 100%; }
.view-imports__search::before, .view-imports__search::after { content: ''; position: absolute; color: var(--color-muted); pointer-events: none; }
.view-imports__search::before { inset-block-start: 9px; inset-inline-start: 10px; inline-size: 9px; block-size: 9px; border: 1px solid; border-radius: 50%; }
.view-imports__search::after { inset-block-start: 17px; inset-inline-start: 17px; inline-size: 5px; border-block-start: 1px solid; transform: rotate(45deg); transform-origin: left; }
.view-imports__search input { display: block; inline-size: 100%; block-size: 30px; padding: 4px 8px 4px 28px; border: 1px solid var(--color-border); border-radius: 5px; background: var(--color-background); color: var(--color-text); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; }
.view-imports__search input::placeholder { color: var(--color-muted); }
.view-imports__filters { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; min-inline-size: 0; color: var(--color-muted); font-size: 12px; }
.view-imports__filters > span { margin-inline-end: 4px; }
.view-imports__filters button { padding: 3px 8px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: inherit; white-space: nowrap; cursor: pointer; }
.view-imports__filters button[aria-pressed="true"] { border-color: var(--color-border); background: var(--color-background); color: var(--color-text); }
.view-imports__filters button:hover:enabled { border-color: var(--color-accent); color: var(--color-accent-hover); }
.view-imports__filters button:disabled { cursor: default; }
.view-imports__search input:focus-visible, .view-imports__filters button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
.view-imports__layout { display: grid; flex: 1; min-block-size: 0; grid-template-columns: clamp(13rem, 27%, 20rem) minmax(0, 1fr); }
.view-imports__layout .property-grid { margin-inline: 0; }
.view-imports__libraries, .view-imports__details { overflow: auto; overscroll-behavior: contain; }
.view-imports__libraries { --workspace-view-inline-padding: 12px; }
.view-imports__libraries .property-grid__table tbody td:first-child { padding: 0; }
.view-imports__libraries tr:has(.view-imports__library[aria-current="true"]) { background: color-mix(in srgb, var(--color-accent) 13%, var(--color-background)); }
.view-imports__library { display: block; width: 100%; padding: 6px 12px 6px var(--workspace-view-inline-padding); border: 0; background: transparent; color: inherit; font: inherit; text-align: left; overflow-wrap: anywhere; cursor: pointer; }
.view-imports__library:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.view-imports__details { min-width: 0; padding-block: 10px 24px; border-inline-start: 1px solid var(--color-border); }
.view-imports__details .property-grid { overflow: visible; }
.view-imports__details h2, .view-imports__details > p { padding-inline: var(--workspace-view-inline-padding); }
.view-imports__details h2 { margin: 0 0 10px; font-size: 13px; font-weight: 600; }
.view-imports__details .property-grid + h2 { margin-top: 20px; }
.view-imports__empty { margin: 0; color: var(--color-muted); font-size: 12px; }
.view-imports > .view-imports__empty { margin-block-start: 12px; }
@container (width < 44rem) {
	.view-imports__layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: fit-content(40%) minmax(0, 1fr); gap: 20px; }
	.view-imports__details { padding-block-start: 0; border-inline-start: 0; }
}
</style>

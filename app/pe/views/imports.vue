<link rel="component" href="../../components/property-grid.vue">

<script>
/** @typedef {{ descriptors: PeLite.PeImportDescriptor[], state: { query: string, selectedIndex: number | null } }} ImportsViewData */
/** @typedef {{ descriptor: PeLite.PeImportDescriptor, index: number, rows: PeLite.PeImportEntry[] | null }} ImportModule */

/** @param {number} value @returns {string} */
function formatImportHex(value) {
	return value === 0 ? '0' : `0x${value.toString(16)}`;
}

/** @param {PeDocument} context @returns {ViewContent} */
function prepareImportsView(context) {
	const result = context.peFile.imports();
	if (result instanceof Error) throw result;
	if (result === null) throw new Error('The import directory is unavailable.');
	return { component: 'view-imports', data: { descriptors: result, state: { query: '', selectedIndex: null } } };
}

const ViewImports = Vue.defineComponent({
	template: '#view-imports',
	props: { data: { type: Object, required: true } },
	data() {
		return {
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
			return this.importsData.descriptors.map((descriptor, index) => {
				const dllMatches = !query || (descriptor.dll_name ?? '').toLowerCase().includes(query);
				const rows = dllMatches ? descriptor.imports : descriptor.imports?.filter(row =>
					[formatImportHex(row.address), row.import?.ByName?.name ?? '',
						String(row.import?.ByName?.hint ?? ''), String(row.import?.ByOrdinal?.ord ?? '')]
						.some(value => value.toLowerCase().includes(query))
				) ?? null;
				return { descriptor, index, rows, visible: dllMatches || !!rows?.length };
			}).filter(group => group.visible);
		},
		selectedModule() {
			return this.filteredDescriptors.find(group => group.index === this.state.selectedIndex) ?? this.filteredDescriptors[0];
		},
	},
});
</script>

<template id="view-imports">
	<section class="view-imports">
		<label class="view-imports__search">Search
			<input v-model="state.query" type="search" placeholder="DLL, name, ordinal, hint, or IAT RVA" spellcheck="false" autocomplete="off">
		</label>
		<div v-if="selectedModule" class="view-imports__layout">
			<property-grid class="view-imports__libraries" :list="filteredDescriptors" :interpretations="libraryColumns" :row-key="library => library.index" label="Imported libraries">
				<template #library="{ value: library }">
					<button type="button" class="view-imports__library" :title="library.descriptor.dll_name ?? 'DLL name unavailable'"
						:aria-current="library.index === selectedModule.index ? 'true' : undefined" @click="state.selectedIndex = library.index">{{ library.descriptor.dll_name ?? 'DLL name unavailable' }}</button>
				</template>
			</property-grid>
			<section class="view-imports__details" :aria-label="'Imports from ' + (selectedModule.descriptor.dll_name ?? 'unknown DLL')">
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
.workspace-area__view:has(> .view-imports) { padding-block-end: 0; }
.view-imports { display: flex; flex-direction: column; min-block-size: 100%; }
.view-imports__search { display: flex; flex-direction: column; gap: 8px; max-width: 540px; margin-bottom: 24px; font-size: 12px; }
.view-imports__search input { min-width: 0; height: 36px; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); color: var(--color-text); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; }
.view-imports__search input::placeholder { color: color-mix(in srgb, var(--color-muted) 55%, var(--color-surface)); }
.view-imports__search input:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.view-imports__layout { display: grid; flex: 1; grid-template-columns: clamp(13rem, 27%, 20rem) minmax(0, 1fr); margin-inline: calc(-1 * var(--workspace-view-inline-padding)); border-block-start: 1px solid var(--color-border); }
.view-imports__layout .property-grid { margin-inline: 0; }
.view-imports__libraries { --workspace-view-inline-padding: 12px; align-self: start; }
.view-imports__libraries .property-grid__table tbody td:first-child { padding: 0; }
.view-imports__libraries tr:has(.view-imports__library[aria-current="true"]) { background: color-mix(in srgb, var(--color-accent) 13%, var(--color-background)); }
.view-imports__library { display: block; width: 100%; padding: 6px 12px 6px var(--workspace-view-inline-padding); border: 0; background: transparent; color: inherit; font: inherit; text-align: left; overflow-wrap: anywhere; cursor: pointer; }
.view-imports__library:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.view-imports__details { min-width: 0; padding-block: 10px 24px; border-inline-start: 1px solid var(--color-border); }
.view-imports__details h2, .view-imports__details > p { padding-inline: var(--workspace-view-inline-padding); }
.view-imports__details h2 { margin: 0 0 10px; font-size: 13px; font-weight: 600; }
.view-imports__details .property-grid + h2 { margin-top: 20px; }
.view-imports__empty { margin: 0; color: var(--color-muted); font-size: 12px; }
@container (width < 44rem) {
	.view-imports__layout { grid-template-columns: minmax(0, 1fr); align-content: start; gap: 20px; }
	.view-imports__libraries { max-height: 40dvh; }
	.view-imports__details { padding-block-start: 0; border-inline-start: 0; }
}
</style>

<link rel="component" href="../../components/property-grid.vue">

<script>
/** @typedef {{ descriptors: import('./deps/pelite.js').PeImportDescriptor[], state: { query: string } }} ImportsViewData */

/** @param {ViewContext} context @returns {boolean} */
function isImportsAvailable(context) {
	return !(context.peFile.imports() instanceof Error);
}

/** @param {number} value @returns {string} */
function formatImportHex(value) {
	return value === 0 ? '0' : `0x${value.toString(16)}`;
}

/** @param {ViewContext} context @returns {ViewContent} */
function prepareImportsView(context) {
	const result = context.peFile.imports();
	if (result instanceof Error) throw result;
	const descriptors = result ?? [];
	return { component: 'view-imports', data: { descriptors, state: { query: '' } } };
}

const ViewImports = Vue.defineComponent({
	template: '#view-imports',
	props: { data: { type: Object, required: true } },
	data() {
		return {
			interpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'IAT RVA', style: { minWidth: '120px', textAlign: 'right' }, format: value => formatImportHex((/** @type {import('./deps/pelite.js').PeImportEntry} */ (value)).address) },
				{ title: 'Name', style: { minWidth: '260px' }, format: value => {
					const symbol = (/** @type {import('./deps/pelite.js').PeImportEntry} */ (value)).import;
					return symbol === null ? 'Unavailable' : symbol.ByName?.name ?? '—';
				} },
				{ title: 'Ordinal', style: { minWidth: '80px', textAlign: 'right' }, format: value => {
					const ordinal = (/** @type {import('./deps/pelite.js').PeImportEntry} */ (value)).import?.ByOrdinal?.ord;
					return ordinal === undefined ? '' : String(ordinal);
				} },
				{ title: 'Hint', style: { minWidth: '80px', textAlign: 'right' }, format: value => {
					const hint = (/** @type {import('./deps/pelite.js').PeImportEntry} */ (value)).import?.ByName?.hint;
					return hint === undefined ? '' : String(hint);
				} },
			]),
			headerInterpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', style: { minWidth: '240px' }, format: (value, name) => String(name) },
				{ title: 'Value', style: { minWidth: '140px', textAlign: 'right' }, format: value => typeof value === 'number' ? formatImportHex(value) : String(value) },
				{ title: 'Interpretation', style: { minWidth: '240px' }, format: (value, name) => {
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
	},
});
</script>

<template id="view-imports">
	<section class="view-imports">
		<label class="view-imports__search">Search
			<input v-model="state.query" type="search" placeholder="DLL, name, ordinal, hint, or IAT RVA" spellcheck="false" autocomplete="off">
		</label>
		<section v-for="group in filteredDescriptors" :key="group.index" class="view-imports__dll">
			<h2>{{ group.descriptor.dll_name ?? 'DLL name unavailable' }}</h2>
			<details class="view-imports__header">
				<summary>Directory descriptor</summary>
				<property-grid :list="group.descriptor.image" :interpretations="headerInterpretations" label="Import directory descriptor"></property-grid>
			</details>
			<property-grid v-if="group.rows?.length" :list="group.rows" :interpretations="interpretations" :label="'Imports from ' + (group.descriptor.dll_name ?? 'unknown DLL')"></property-grid>
			<p v-else class="view-imports__empty">{{ group.rows === null ? 'The import lookup table could not be parsed.' : 'No imported symbols.' }}</p>
		</section>
		<p v-if="!filteredDescriptors.length" class="view-imports__empty">{{ data.descriptors.length ? 'No matching entries.' : 'No imports.' }}</p>
	</section>
</template>

<style>
.view-imports__search { display: flex; flex-direction: column; gap: 8px; max-width: 540px; margin-bottom: 24px; font-size: 12px; }
.view-imports__search input { min-width: 0; height: 36px; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); color: var(--color-text); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; }
.view-imports__search input::placeholder { color: color-mix(in srgb, var(--color-muted) 55%, var(--color-surface)); }
.view-imports__search input:focus-visible, .view-imports__header summary:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.view-imports__dll + .view-imports__dll { margin-top: 32px; }
.view-imports__dll h2 { margin: 0 0 16px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 15px; }
.view-imports__header { margin-bottom: 16px; }
.view-imports__header summary { width: max-content; margin-bottom: 12px; font-size: 12px; font-weight: 600; cursor: pointer; user-select: none; }
.view-imports__empty { margin: 0; color: var(--color-muted); font-size: 12px; }
</style>

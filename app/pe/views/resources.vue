<link rel="component" href="../../components/property-grid.vue">

<script>
/** @typedef {{ tree: import('./deps/pelite.js').PeResourceTreeEntry[], state: { expanded: Set<string> } }} ResourcesViewData */
/** @typedef {{ entry: import('./deps/pelite.js').PeResourceTreeEntry, key: string, depth: number }} ResourceTreeRow */

/** @param {PeDocument} context @returns {ViewContent} */
function prepareResourcesView(context) {
	const tree = context.peFile.resourcesTree();
	if (tree instanceof Error) throw tree;
	if (tree === null) throw new Error('The resource directory could not be parsed.');
	return { component: 'view-resources', data: { tree, state: { expanded: new Set() } } };
}

const ViewResources = Vue.defineComponent({
	template: '#view-resources',
	props: { data: { type: Object, required: true } },
	data() {
		const numericStyle = { textAlign: 'right' };
		return {
			columns: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Resource', slot: 'resource' },
				{ title: 'RVA', width: '120px', style: numericStyle,
					kind: value => (/** @type {ResourceTreeRow} */ (value)).entry.data ? 'rva' : undefined,
					format: value => {
						const data = (/** @type {ResourceTreeRow} */ (value)).entry.data;
						return data ? formatPropertyGridHex(data.image.OffsetToData) : '';
					} },
				{ title: 'Size (bytes)', width: '120px', style: numericStyle,
					format: value => String((/** @type {ResourceTreeRow} */ (value)).entry.data?.size ?? '') },
				{ title: 'Code page', width: '120px', style: numericStyle,
					format: value => String((/** @type {ResourceTreeRow} */ (value)).entry.data?.code_page ?? '') },
			]),
		};
	},
	computed: {
		resourcesData() { return /** @type {ResourcesViewData} */ (/** @type {unknown} */ (this.data)); },
		state() { return this.resourcesData.state; },
		rows() {
			/** @type {ResourceTreeRow[]} */
			const rows = [];
			/** @param {import('./deps/pelite.js').PeResourceTreeEntry[]} entries @param {string} parent @param {number} depth */
			const visit = (entries, parent, depth) => {
				entries.forEach((entry, index) => {
					const key = `${parent}/${index}`;
					rows.push({ entry, key, depth });
					if (entry.directory && this.state.expanded.has(key)) visit(entry.directory, key, depth + 1);
				});
			};
			visit(this.resourcesData.tree, '', 0);
			return rows;
		},
	},
	methods: {
		/** @param {string} key */
		toggle(key) {
			if (this.state.expanded.has(key)) this.state.expanded.delete(key);
			else this.state.expanded.add(key);
		},
		expandAll() {
			/** @param {import('./deps/pelite.js').PeResourceTreeEntry[]} entries @param {string} parent */
			const visit = (entries, parent) => {
				entries.forEach((entry, index) => {
					if (!entry.directory) return;
					const key = `${parent}/${index}`;
					this.state.expanded.add(key);
					visit(entry.directory, key);
				});
			};
			visit(this.resourcesData.tree, '');
		},
		/** @param {import('./deps/pelite.js').PeResourceTreeEntry} entry @returns {string} */
		name(entry) { return typeof entry.name === 'number' ? `#${entry.name}` : entry.name ?? 'Name unavailable'; },
		/** @param {ResourceTreeRow} row */
		rowKey(row) { return row.key; },
	},
});
</script>

<template id="view-resources">
	<section class="view-resources">
		<div class="view-resources__toolbar">
			<button type="button" @click="expandAll">Expand all</button>
			<button type="button" @click="state.expanded.clear()">Collapse all</button>
		</div>
		<property-grid v-if="rows.length" class="view-resources__tree" :list="rows" :interpretations="columns" :row-key="rowKey" label="Resource tree" min-width="680px" auto-layout>
			<template #resource="{ value: row }">
				<div :style="{ paddingInlineStart: row.depth * 20 + 'px' }">
					<button v-if="row.entry.directory" type="button" class="view-resources__branch" :aria-expanded="state.expanded.has(row.key)" @click="toggle(row.key)">
						<svg class="view-resources__chevron" :class="{ 'view-resources__chevron--expanded': state.expanded.has(row.key) }" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg>
						<svg class="view-resources__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h5l2 2h5v7H2Z" /></svg>
						{{ name(row.entry) }}
					</button>
					<span v-else class="view-resources__leaf">
						<svg class="view-resources__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h5l3 3v9H4ZM9 2v4h3" /></svg>
						{{ name(row.entry) }}
						<span v-if="!row.entry.data" class="view-resources__unavailable">Unavailable</span>
					</span>
				</div>
			</template>
		</property-grid>
		<p v-else class="view-resources__empty">No resource entries.</p>
	</section>
</template>

<style>
.view-resources__toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.view-resources__toolbar button { padding: 5px 10px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); color: var(--color-text); font-size: 12px; cursor: pointer; user-select: none; }
.view-resources__toolbar button:hover { background: var(--color-border); }
.view-resources__tree :is(th, td) { white-space: nowrap; }
.view-resources__branch, .view-resources__leaf { display: flex; align-items: center; gap: 6px; min-height: 24px; }
.view-resources__branch { width: 100%; padding: 0; border: 0; background: transparent; color: var(--color-text); font: inherit; text-align: left; cursor: pointer; user-select: none; }
.view-resources__leaf { padding-left: 22px; }
.view-resources__chevron, .view-resources__icon { width: 16px; height: 16px; flex-shrink: 0; fill: none; stroke: var(--color-muted); stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; }
.view-resources__chevron--expanded { transform: rotate(90deg); }
.view-resources__unavailable, .view-resources__empty { color: var(--color-muted); font-size: 12px; }
.view-resources__toolbar button:focus-visible, .view-resources__branch:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
</style>

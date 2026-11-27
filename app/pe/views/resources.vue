<link rel="component" href="resource-details.vue">

<script>
/** @typedef {{ tree: PeLite.PeResourceTreeEntry[], document: PeDocument }} ResourcesViewData */
/** @typedef {{ entry: PeLite.PeResourceTreeEntry, key: string, parent: string, path: string[], detail: string, detailLabel: string }} ResourceTreeRow */

/** @param {PeDocument} context @returns {ViewContent} */
function prepareResourcesView(context) {
	const tree = context.peFile.resourcesTree();
	if (tree instanceof Error) throw tree;
	if (tree === null) throw new Error('The resource directory could not be parsed.');
	return { component: 'view-resources', data: { tree, document: context } };
}

/** @param {number} bytes */
function formatResourceSize(bytes) {
	const units = ['B', 'KB', 'MB', 'GB'];
	let unit = 0;
	while (bytes >= 1000 && unit < units.length - 1) {
		unit++;
		bytes /= 1000;
	}
	return `${bytes.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[unit]}`;
}

/** @param {PeLite.PeResourceTreeEntry[]} tree @returns {ResourceTreeRow[]} */
function resourceTreeRows(tree) {
	/** @type {ResourceTreeRow[]} */
	const rows = [];
	/** @param {PeLite.PeResourceTreeEntry[]} entries @param {string} parent @param {string[]} parentPath */
	function visit(entries, parent, parentPath) {
		entries.forEach((entry, index) => {
			const key = parent ? `${parent}-${index}` : String(index);
			const name = typeof entry.name === 'number' ? `#${entry.name}` : entry.name ?? 'Name unavailable';
			const path = [...parentPath, name];
			const count = entry.directory?.length;
			const size = entry.data?.size;
			const detail = count !== undefined ? count.toLocaleString() : size !== undefined ? formatResourceSize(size) : '';
			const detailLabel = count !== undefined ? `${detail} ${count === 1 ? 'entry' : 'entries'}`
				: size !== undefined ? `${size.toLocaleString()} ${size === 1 ? 'byte' : 'bytes'}` : '';
			rows.push({ entry, key, parent, path, detail, detailLabel });
			if (entry.directory?.length) visit(entry.directory, key, path);
		});
	}
	visit(tree, '', []);
	return rows;
}

// The tree has one Tab stop. Arrow keys and Home/End move focus, while Enter,
// Space, or click expand a folder or select a leaf without moving into details.
const ViewResources = Vue.defineComponent({
	template: '#view-resources',
	components: { ResourceDetails },
	props: { data: { type: Object, required: true } },
	data() {
		return {
			expanded: /** @type {Set<string>} */ (new Set()),
			collapsedMatches: /** @type {Set<string>} */ (new Set()),
			query: '',
			focusKey: '0',
			selected: /** @type {ResourceTreeRow | null} */ (null),
		};
	},
	computed: {
		resourcesData() { return /** @type {ResourcesViewData} */ (/** @type {unknown} */ (this.data)); },
		allRows() { return resourceTreeRows(this.resourcesData.tree); },
		matchKeys() {
			const query = this.query.trim().toLowerCase();
			if (!query) return null;
			const keys = /** @type {Set<string>} */ (new Set());
			for (const row of this.allRows.toReversed()) {
				if (!keys.has(row.key) && !row.path.join('/').toLowerCase().includes(query)) continue;
				keys.add(row.key);
				keys.add(row.parent);
			}
			return keys;
		},
		openKeys() {
			const matches = this.matchKeys;
			if (!matches) return this.expanded;
			return new Set(this.allRows.filter(row => row.entry.directory?.length && matches.has(row.key) && !this.collapsedMatches.has(row.key)).map(row => row.key));
		},
		rows() {
			const visible = new Set(['']);
			const counts = /** @type {Map<string, number>} */ (new Map());
			return this.allRows.flatMap(row => {
				if (!visible.has(row.parent) || (this.matchKeys && !this.matchKeys.has(row.key))) return [];
				if (this.openKeys.has(row.key)) visible.add(row.key);
				const position = (counts.get(row.parent) ?? 0) + 1;
				counts.set(row.parent, position);
				return [{ ...row, position }];
			}).map(row => ({ ...row, siblings: counts.get(row.parent) }));
		},
		tabStop() { return this.rows.some(row => row.key === this.focusKey) ? this.focusKey : this.rows[0]?.key; },
		selectedOffset() {
			const rva = this.selected?.entry.data?.image.OffsetToData;
			if (rva === undefined) return null;
			const offset = this.resourcesData.document.peFile.rvaToFileOffset(rva, true);
			return offset instanceof Error ? null : offset;
		},
		selectedLanguage() {
			const row = this.selected;
			return row?.path.length === 3 && typeof row.entry.name === 'number' ? row.entry.name : null;
		},
	},
	watch: {
		query() { this.collapsedMatches.clear(); },
	},
	methods: {
		expandAll() {
			if (this.matchKeys) {
				this.collapsedMatches.clear();
				return;
			}
			for (const row of this.allRows) {
				if (row.entry.directory?.length) this.expanded.add(row.key);
			}
		},
		collapseAll() {
			this.focusKey = this.focusKey.split('-')[0];
			if (this.matchKeys) {
				for (const key of this.openKeys) this.collapsedMatches.add(key);
			} else this.expanded.clear();
		},
		/** @param {string} key */
		toggleFolder(key) {
			const toggles = this.matchKeys ? this.collapsedMatches : this.expanded;
			if (toggles.has(key)) toggles.delete(key);
			else toggles.add(key);
		},
		/** @param {string | undefined} key */
		focusRow(key) {
			if (key === undefined) return;
			const tree = this.$refs.tree;
			if (!(tree instanceof HTMLElement)) return;
			const item = tree.querySelector(`[data-resource-key="${key}"]`);
			if (item instanceof HTMLElement) item.focus();
		},
		/** @param {ResourceTreeRow} row */
		activate(row) {
			this.focusKey = row.key;
			if (row.entry.directory) {
				if (row.entry.directory.length) this.toggleFolder(row.key);
			} else {
				this.selected = row;
			}
		},
		/** @param {KeyboardEvent} event @param {ResourceTreeRow} row @param {number} index */
		onTreeKey(event, row, index) {
			if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
			const target = /** @type {HTMLElement} */ (event.currentTarget);
			const rtl = getComputedStyle(target).direction === 'rtl';
			let next;
			switch (event.key) {
				case 'Enter':
				case ' ':
					this.activate(row);
					break;
				case 'ArrowDown': next = this.rows[index + 1]; break;
				case 'ArrowUp': next = this.rows[index - 1]; break;
				case 'Home': next = this.rows[0]; break;
				case 'End': next = this.rows.at(-1); break;
				case rtl ? 'ArrowLeft' : 'ArrowRight':
					if (row.entry.directory?.length) {
						if (this.openKeys.has(row.key)) next = this.rows[index + 1];
						else this.toggleFolder(row.key);
					}
					break;
				case rtl ? 'ArrowRight' : 'ArrowLeft':
					if (this.openKeys.has(row.key)) this.toggleFolder(row.key);
					else next = this.rows.find(candidate => candidate.key === row.parent);
					break;
				default: {
					if (event.key.length !== 1) return;
					const letter = event.key.toLowerCase();
					const following = [...this.rows.slice(index + 1), ...this.rows.slice(0, index)];
					next = following.find(candidate => candidate.path.at(-1)?.toLowerCase().startsWith(letter));
				}
			}
			event.preventDefault();
			this.focusRow(next?.key);
		},
	},
});
</script>

<template id="view-resources">
	<section class="view-resources">
		<div v-if="allRows.length" class="view-resources__layout">
			<div class="view-resources__navigation">
				<div class="view-resources__toolbar">
					<div class="view-resources__filter">
						<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="6.5" cy="6.5" r="3.5" /><path d="m9 9 3 3" /></svg>
						<input v-model="query" type="search" aria-label="Filter resources" placeholder="Filter resources"
							spellcheck="false" autocomplete="off" @keydown.down.prevent="focusRow(tabStop)">
					</div>
					<button type="button" aria-label="Expand all" title="Expand all" @click="expandAll">
						<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 3.5 3 3.5-3m-7 5 3.5 3 3.5-3" /></svg>
					</button>
					<button type="button" aria-label="Collapse all" title="Collapse all" @click="collapseAll">
						<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 7 3.5-3 3.5 3m-7 5 3.5-3 3.5 3" /></svg>
					</button>
				</div>
				<ul v-if="rows.length" ref="tree" class="view-resources__tree" role="tree" aria-label="Resource files">
					<li v-for="(row, index) in rows" :key="row.key" role="treeitem"
						class="view-resources__node" :style="{ '--resource-level': row.path.length - 1 }"
						:data-resource-key="row.key" :title="row.path.at(-1)"
						:aria-label="row.detailLabel ? row.path.at(-1) + ', ' + row.detailLabel : row.path.at(-1)"
						:tabindex="tabStop === row.key ? 0 : -1"
						:aria-level="row.path.length" :aria-posinset="row.position" :aria-setsize="row.siblings"
						:aria-expanded="row.entry.directory?.length ? openKeys.has(row.key) : undefined"
						:aria-selected="row.entry.directory ? undefined : selected?.key === row.key"
						@focus="focusKey = row.key" @click="activate(row)" @keydown="onTreeKey($event, row, index)">
						<svg class="view-resources__chevron" :class="{ 'view-resources__chevron--hidden': !row.entry.directory?.length }"
							viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg>
						<svg class="view-resources__icon" viewBox="0 0 16 16" aria-hidden="true">
							<path v-if="row.entry.directory" d="M2 4h4.5l1.5 1.5H14v7H2Z" />
							<path v-else d="M4 2h5l3 3v9H4ZM9 2v4h3" />
						</svg>
						<span class="view-resources__name">{{ row.path.at(-1) }}</span>
						<span v-if="row.detail" class="view-resources__metric" :title="row.detailLabel">{{ row.detail }}</span>
					</li>
				</ul>
				<p v-else class="view-resources__empty" role="status">No matching resources.</p>
			</div>
			<div :key="selected?.key" class="view-resources__details">
				<resource-details v-if="selected" :entry="selected.entry.data ?? null"
					:path="selected.path" :file-offset="selectedOffset" :language-id="selectedLanguage"></resource-details>
				<p v-else class="view-resources__empty">Select a file to see its details.</p>
			</div>
		</div>
		<p v-else class="view-resources__empty">No resource entries.</p>
	</section>
</template>

<style>
.view-resources { container-type: inline-size; height: 100%; font-size: 13px; }
.view-resources__layout { display: grid; height: 100%; grid-template-columns: clamp(12rem, 31%, 21rem) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
.view-resources__navigation { display: flex; flex-direction: column; min-width: 0; min-height: 0; border-inline-end: 1px solid var(--color-border); }
.view-resources__toolbar { display: flex; align-items: center; gap: 4px; padding: 8px 9px 8px 10px; border-bottom: 1px solid var(--color-border); background: var(--workspace-background); }
.view-resources__toolbar svg, .view-resources__node svg { flex: none; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; }
.view-resources__toolbar button { display: grid; flex: none; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--color-muted); cursor: pointer; }
.view-resources__toolbar button:hover { background: var(--color-border); color: var(--color-text); }
.view-resources__filter { position: relative; flex: 1; min-width: 0; }
.view-resources__filter svg { position: absolute; inset-block-start: 7px; inset-inline-start: 8px; color: var(--color-muted); pointer-events: none; }
.view-resources__filter input { display: block; width: 100%; min-width: 0; height: 28px; padding: 3px 6px; padding-inline-start: 28px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--workspace-surface); color: var(--color-text); font: 12px ui-monospace, SFMono-Regular, Consolas, monospace; }
.view-resources__filter input::placeholder { color: var(--color-muted); opacity: 1; }
.view-resources__tree, .view-resources__details { min-height: 0; overflow: auto; overscroll-behavior: contain; }
.view-resources__tree { margin: 0; padding: 0 0 6px; list-style: none; }
.view-resources__node { --resource-indent: min(var(--resource-level) * 16px, 30%); position: relative; display: flex; align-items: center; gap: 6px; min-height: 28px; padding: 4px 10px; padding-inline-start: calc(10px + var(--resource-indent)); border-inline-start: 3px solid transparent; color: var(--color-text); font: 12px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; cursor: pointer; }
.view-resources__node::before { position: absolute; inset-block: 0; inset-inline-start: 17px; width: var(--resource-indent); background: repeating-linear-gradient(90deg, var(--color-border) 0 1px, transparent 1px 16px); pointer-events: none; content: ''; }
.view-resources__node:dir(rtl)::before { transform: scaleX(-1); }
.view-resources__node:hover { background: var(--workspace-surface); }
.view-resources__node[aria-selected="true"] { border-inline-start-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 15%, var(--workspace-background)); }
.view-resources__node[aria-selected="true"] .view-resources__icon { color: var(--color-accent-hover); }
.view-resources__toolbar :is(input, button):focus-visible, .view-resources__node:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.view-resources__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.view-resources__metric { flex: none; margin-inline-start: auto; color: var(--color-muted); white-space: nowrap; }
.view-resources__chevron, .view-resources__icon { color: var(--color-muted); }
.view-resources__chevron:dir(rtl) { transform: scaleX(-1); }
.view-resources__node[aria-expanded="true"] .view-resources__chevron { transform: rotate(90deg); }
.view-resources__chevron--hidden { visibility: hidden; }
.view-resources__empty { margin: 12px var(--workspace-gutter, 12px); color: var(--color-muted); font-size: 13px; }

@container (width < 38rem) {
	.view-resources__layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 36%) minmax(0, 1fr); }
	.view-resources__navigation { border-inline-end: 0; border-block-end: 1px solid var(--color-border); }
}
</style>

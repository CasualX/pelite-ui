<link rel="component" href="../facts.vue.js">
<link rel="component" href="../../components/property-grid.vue">

<script>
/** @param {PeDocument} context @returns {ViewContent} */
function prepareFactsView(context) {
	// Initialize once when first opening Facts, inside the workspace's error boundary.
	context.facts;
	return { component: 'view-facts', data: { document: context } };
}

const ViewFacts = Vue.defineComponent({
	template: '#view-facts',
	props: { data: { type: Object, required: true } },
	computed: {
		db() { return (/** @type {PeDocument} */ (this.data.document)).facts; },
		/** @returns {PropertyGridColumn[]} */
		layerColumns() {
			return [
				{ title: 'Inspect', width: '1%', slot: 'inspect' },
				{ title: 'Order', width: '1%', style: { textAlign: 'right' }, format: (_layer, index) => String(Number(index) + 1) },
				{ title: 'Layer', slot: 'layer' },
				{ title: 'Records', width: '1%', style: { textAlign: 'right' }, format: (_layer, index) => this.db.rows(Number(index)).length.toLocaleString() },
			];
		},
		/** @returns {PropertyGridColumn[]} */
		recordColumns() {
			return [
				{ title: 'Kind', slot: 'kind' },
				{ title: 'Section:RVA', slot: 'address' },
				{ title: 'Value / metadata', slot: 'payload' },
				this.db.mode === 'inspect'
					? { title: 'Layer', format: value => this.db.layers[(/** @type {FactsRow} */ (value)).layer].label || 'Unnamed' }
					: { title: 'Actions', width: '1%', slot: 'actions' },
			];
		},
		kinds() { return factKinds; },
		drafting() { return this.db.editorLayer >= 0 || this.db.bulk || this.db.busy; },
		allRows() { return this.db.layers.flatMap((layer, index) => this.db.rows(index)); },
		visibleRows() { return this.allRows.filter(row => this.db.layers[row.layer].visible); },
		/** @returns {{ min: number, max: number, error: string }} */
		range() {
			try {
				const min = this.db.from.trim() ? this.parseRva(this.db.from) : 0;
				const max = this.db.to.trim() ? this.parseRva(this.db.to) : 0xffffffff;
				if (min > max) throw new Error('Start RVA must be at or before end RVA.');
				return { min, max, error: '' };
			} catch (error) { return { min: 0, max: 0, error: String(error) }; }
		},
		filtered() {
			if (this.db.mode === 'layers') return this.db.rows(this.db.selected);
			if (this.range.error) return [];
			const query = this.db.query.toLowerCase().trim();
			const section = this.db.headers.SectionHeaders[Number(this.db.section)];
			return this.allRows.filter(row =>
				this.db.layers[row.layer].visible &&
				(!this.db.kind || row.kind === this.db.kind) &&
				(!query || `${row.text} ${this.hex(row.rva)} ${this.db.layers[row.layer].label}`.toLowerCase().includes(query)) &&
				row.rva >= this.range.min && row.rva <= this.range.max &&
				(this.db.section === '' || (row.rva >= section.VirtualAddress && row.rva < section.VirtualAddress + Math.max(section.VirtualSize, section.SizeOfRawData)))
			).sort((a, b) => a.rva - b.rva || a.layer - b.layer || a.index - b.index);
		},
		pageCount() { return Math.max(1, Math.ceil(this.filtered.length / 100)); },
		pageIndex() { return Math.min(this.db.page, this.pageCount - 1); },
		pageRows() { return this.filtered.slice(this.pageIndex * 100, (this.pageIndex + 1) * 100); },
		imageSize() { return Math.max(1, this.db.headers.NtHeaders.OptionalHeader.SizeOfImage); },
		/** @returns {{ start: number, end: number, count: number, kinds: string }[]} */
		bins() {
			const bins = Array.from({ length: 96 }, (_, index) => ({ start: Math.floor(index * this.imageSize / 96), end: Math.ceil((index + 1) * this.imageSize / 96) - 1, count: 0, kinds: '' }));
			for (const row of this.visibleRows) {
				if (row.rva >= this.imageSize) continue;
				const bin = bins[Math.min(95, Math.floor(row.rva * 96 / this.imageSize))];
				bin.count++; if (!bin.kinds.includes(row.kind)) bin.kinds += row.kind;
			}
			return bins;
		},
		maxBin() { return Math.max(1, ...this.bins.map(bin => bin.count)); },
		outOfImage() { return this.visibleRows.filter(row => row.rva >= this.imageSize).length; },
	},
	methods: {
		/** @param {FactsRow} row */
		recordKey(row) { return `${row.layer}:${row.index}`; },
		/** @param {number} rva */
		hex(rva) { return `0x${rva.toString(16).padStart(8, '0')}`; },
		/** @param {string} text */
		parseRva(text) {
			if (!/^(?:0x)?[\da-f]{1,8}$/i.test(text.trim())) throw new Error('Enter an RVA as up to 8 hexadecimal digits (optional 0x).');
			return parseInt(text.trim().replace(/^0x/i, ''), 16);
		},
		/** @param {string} kind */
		kindName(kind) { return factKinds.find(item => item.id === kind)?.name ?? kind; },
		/** @param {number} rva */
		sectionName(rva) {
			return this.db.headers.SectionHeaders.find(section => rva >= section.VirtualAddress && rva < section.VirtualAddress + Math.max(section.VirtualSize, section.SizeOfRawData))?.Name ?? (rva < this.db.headers.NtHeaders.OptionalHeader.SizeOfHeaders ? 'Headers' : '—');
		},
		/** @param {FactsRow} row */
		description(row) {
			if (row.kind === 'C') { try { return JSON.parse(row.payload); } catch {} }
			return row.payload;
		},
		/** @param {() => void} operation */
		run(operation) {
			try { operation(); } catch (error) { this.db.error = error instanceof Error ? error.message : String(error); }
		},
		newLayer() { this.db.mutate(() => this.db.append(`Layer ${this.db.layers.length + 1}`, '#factmap\n'), 'Layer created.'); },
		duplicate() { this.db.mutate(() => this.db.append(`${this.db.current.label} copy`, this.db.current.text), 'Layer duplicated.'); },
		renameLayer() {
			this.db.mutate(() => { factsResult(this.db.native.setLayerLabel(this.db.selected, this.db.rename)); this.db.current.label = this.db.rename; });
		},
		/** @param {number} index */
		toggleLayer(index) { this.db.mutate(() => { this.db.layers[index].visible = !this.db.layers[index].visible; }); },
		/** @param {string} kind */
		newFact(kind = 'C') {
			this.db.resetEditor();
			this.db.editorLayer = this.db.selected;
			this.db.editor = factKinds.find(item => item.id === kind)?.example ?? '';
			if (kind === 'D' && this.db.pointerWidth === 32) this.db.editor = this.db.editor.replace('x86_64', 'x86');
		},
		/** @param {FactsRow} row */
		edit(row) { this.db.resetEditor(); this.db.editorLayer = row.layer; this.db.editIndex = row.index; this.db.editor = row.text; },
		saveFact() {
			this.db.mutate(() => {
				const index = this.db.editorLayer;
				if (this.db.editIndex < 0) {
					factsResult(this.db.native.addFact(index, this.db.editor));
					this.db.layers[index].text = factsResult(this.db.native.getLayer(index));
				} else {
					// Validate a single record before placing it back in the complete map.
					const check = new this.db.Facts(this.db.pointerWidth);
					let record;
					try { factsResult(check.addLayer()); factsResult(check.addFact(0, this.db.editor)); record = factsResult(check.getLayer(0)).split('\n')[1]; }
					finally { check.dispose(); }
					const records = this.db.rows(index).map(row => row.text); records[this.db.editIndex] = record;
					this.db.replace(index, '#factmap\n' + records.join('\n') + '\n');
				}
				this.db.resetEditor();
			}, 'Fact saved.');
		},
		/** @param {FactsRow} row */
		removeFact(row) {
			if (!window.confirm(`Remove this ${this.kindName(row.kind).toLowerCase()} at ${this.hex(row.rva)}?`)) return;
			this.db.mutate(() => this.db.replace(row.layer, '#factmap\n' + this.db.rows(row.layer).filter(item => item.index !== row.index).map(item => item.text).join('\n') + '\n'), 'Fact removed. Undo to restore it.');
		},
		removeLayer() {
			if (!window.confirm(`Delete layer "${this.db.current.label || 'Unnamed layer'}" and all its facts?`)) return;
			this.db.removeLayer(this.db.selected);
		},
		bulkEdit() { this.db.resetEditor(); this.db.bulk = true; this.db.bulkLayer = this.db.selected; this.db.bulkText = this.db.current.text; },
		saveBulk() { this.db.mutate(() => { this.db.replace(this.db.bulkLayer, this.db.bulkText); this.db.resetEditor(); }, 'Layer updated.'); },
		/** @param {number} start @param {number} end */
		zoom(start, end) { this.db.from = this.hex(start); this.db.to = this.hex(end); this.db.page = 0; },
		resetFilters() { this.db.query = ''; this.db.kind = ''; this.db.section = ''; this.db.from = ''; this.db.to = ''; this.db.page = 0; },
		exportLayer() { this.run(() => downloadFacts(`${this.db.current.label.replace(/[^\w.-]/g, '_') || 'layer'}.factmap`, this.db.current.text, 'text/plain')); },
		/** @param {Event} event */
		async importFiles(event) {
			const input = /** @type {HTMLInputElement} */ (event.target);
			const files = Array.from(input.files ?? []); input.value = '';
			if (!files.length || this.drafting) return;
			this.db.busy = true;
			try {
				const loaded = await Promise.all(files.map(async file => ({ file, text: (await file.text()).replace(/^\uFEFF/, '') })));
				if (this.db.disposed) return;
				// Validate the entire batch before adding any layers.
				const check = new this.db.Facts(this.db.pointerWidth);
				try { for (const item of loaded) { const result = check.addLayer(item.text); if (result instanceof Error) throw new Error(`${item.file.name}: ${result.message}`); } }
				finally { check.dispose(); }
				this.db.mutate(() => { for (const item of loaded) this.db.append(item.file.name.replace(/\.(?:factmap|symtext|txt)$/i, ''), item.text); }, `${loaded.length} factmap layer(s) imported.`);
			} catch (error) { this.db.error = error instanceof Error ? error.message : String(error); }
			finally { this.db.busy = false; }
		},

	},
});
</script>

<template id="view-facts">
	<section class="view-facts">
		<nav class="view-facts__navigation" aria-label="Facts views">
			<button :aria-pressed="db.mode === 'inspect'" @click="db.mode = 'inspect'; db.page = 0">Inspect facts</button>
			<button :aria-pressed="db.mode === 'layers'" @click="db.mode = 'layers'; db.page = 0">Manage layers</button>
		</nav>
		<p v-if="db.error" class="view-facts__error" role="alert">{{ db.error }}</p>
		<p v-else-if="db.notice && db.mode === 'layers'" class="view-facts__notice" role="status">{{ db.notice }}</p>
		<section v-if="db.mode === 'inspect'" aria-label="Combined facts inspection">
			<div class="view-facts__map" aria-label="Fact address distribution">
				<div class="view-facts__subhead"><strong>Image address map</strong><span class="view-facts__muted">Visible layers · click a bin to filter</span></div>
				<div class="view-facts__bins">
					<button v-for="(bin, index) in bins" :key="index" :title="`${hex(bin.start)}–${hex(bin.end)}: ${bin.count} facts (${bin.kinds})`" :aria-label="`${hex(bin.start)} through ${hex(bin.end)}, ${bin.count} facts`" @click="zoom(bin.start, bin.end)"><span :style="{ height: `${bin.count ? 12 + 88 * bin.count / maxBin : 0}%` }"></span></button>
				</div>
				<div class="view-facts__section-map"><button v-for="(section, index) in db.headers.SectionHeaders" :key="index" :style="{ left: `${100 * section.VirtualAddress / imageSize}%`, width: `${100 * Math.max(0, Math.min(Math.max(section.VirtualSize, section.SizeOfRawData), imageSize - section.VirtualAddress)) / imageSize}%` }" :title="`${section.Name} · ${hex(section.VirtualAddress)}`" @click="db.section = String(index); db.page = 0">{{ section.Name }}</button></div>
				<div class="view-facts__axis"><span>{{ hex(0) }}</span><span>{{ hex(imageSize - 1) }}</span></div>
				<p v-if="outOfImage" class="view-facts__muted">{{ outOfImage }} facts outside the image are retained in the record list.</p>
			</div>

			<div class="view-facts__inspection-layers" aria-label="Layers included in inspection">
				<span>Layers</span>
				<label v-for="(layer, index) in db.layers" :key="index"><input type="checkbox" :checked="layer.visible" :disabled="drafting" @change="toggleLayer(index)">{{ layer.label || 'Unnamed layer' }}</label>
				<span v-if="!db.layers.length" class="view-facts__muted">Import or create a layer in Manage layers.</span>
			</div>
			<div class="view-facts__filters" @input="db.page = 0" @change="db.page = 0">
				<label>Search<input v-model="db.query" type="search" placeholder="Name, text, RVA…" spellcheck="false"></label>
				<label>Kind<select v-model="db.kind"><option value="">All kinds</option><option v-for="kind in kinds" :key="kind.id" :value="kind.id">{{ kind.name }}</option></select></label>
				<label>Section<select v-model="db.section"><option value="">All sections</option><option v-for="(section, index) in db.headers.SectionHeaders" :key="index" :value="String(index)">{{ section.Name }}</option></select></label>
				<label>From RVA (hex)<input v-model="db.from" placeholder="0x00000000" spellcheck="false"></label>
				<label>To RVA (inclusive)<input v-model="db.to" placeholder="0xffffffff" spellcheck="false"></label>
				<button @click="resetFilters">Reset</button>
			</div>
			<p v-if="range.error" class="view-facts__error" role="alert">{{ range.error }}</p>

			<div class="view-facts__subhead"><strong>{{ filtered.length.toLocaleString() }} matching records</strong><span class="view-facts__muted">Combined visible layers · right-click an address to navigate</span></div>
		</section>
		<section v-else aria-label="Layer management">
			<div class="view-facts__subhead">
				<h2>Layers</h2>
				<div class="view-facts__actions">
					<button :disabled="!db.past.length || drafting" @click="db.undo()">Undo</button>
					<button :disabled="!db.future.length || drafting" @click="db.undo(true)">Redo</button>
					<button :disabled="drafting" @click="$refs.importer.click()">Import…</button>
					<input ref="importer" hidden type="file" multiple accept=".factmap,.symtext,.txt" @change="importFiles">
					<button :disabled="drafting" @click="newLayer">+ New</button>
				</div>
			</div>
			<property-grid class="view-facts__table-wrap view-facts__layers-table" :list="db.layers" :interpretations="layerColumns" label="Fact layers" auto-layout>
				<template #inspect="{ value: layer, index }">
					<input type="checkbox" :checked="layer.visible" :disabled="drafting" :aria-label="`Include ${layer.label || 'unnamed layer'} in inspection`" @change="toggleLayer(index)">
				</template>
				<template #layer="{ value: layer, index }">
					<button class="view-facts__layer-select" :disabled="drafting" :aria-pressed="db.selected === index" @click="db.select(index)">{{ layer.label || 'Unnamed layer' }}</button>
				</template>
				<template #empty><div class="view-facts__empty">Create a layer or import a native factmap to get started.</div></template>
			</property-grid>
			<p class="view-facts__help">Layers are ordered from earlier to later. Import factmaps as new layers; export individual layers to keep your work.</p>
			<div v-if="db.current" class="view-facts__layer-toolbar">
				<form @submit.prevent="renameLayer"><label>Layer name <input v-model="db.rename" :disabled="drafting" aria-label="Layer name"></label><button :disabled="drafting || db.rename === db.current.label">Rename</button></form>
				<button :disabled="drafting || db.selected <= 0" @click="db.move(-1)">↑ Earlier</button>
				<button :disabled="drafting || db.selected >= db.layers.length - 1" @click="db.move(1)">↓ Later</button>
				<button :disabled="drafting" @click="duplicate">Duplicate</button>
				<button :disabled="drafting || db.selected === 0" @click="db.mergeDown()" title="Append selected records to the preceding layer, then remove this layer">Merge into earlier</button>
				<button :disabled="drafting" @click="exportLayer">Export factmap</button>
				<button :disabled="drafting" @click="removeLayer">Delete layer</button>
			</div>
			<div v-if="db.current" class="view-facts__editor-heading view-facts__subhead">
				<h2>Editing {{ db.current.label || 'Unnamed layer' }}</h2>
				<div class="view-facts__actions"><button :disabled="drafting" @click="newFact()">+ Add fact</button><button :disabled="drafting" @click="bulkEdit">Edit layer text</button></div>
			</div>
			<form v-if="db.editorLayer >= 0" class="view-facts__editor" @submit.prevent="saveFact">
				<strong>{{ db.editIndex < 0 ? 'Add fact' : 'Edit fact' }} · {{ db.layers[db.editorLayer]?.label || 'Unnamed layer' }}</strong>
				<div v-if="db.editIndex < 0" class="view-facts__actions"><button v-for="kind in kinds" :key="kind.id" type="button" @click="newFact(kind.id)">{{ kind.name }}</button></div>
				<label>Fact record<textarea v-model="db.editor" rows="3" spellcheck="false" required aria-label="Fact record"></textarea></label>
				<p class="view-facts__help">RVA uses x-prefixed hex. Quote names and comments as JSON strings. Types follow binfact syntax. Function metadata is opaque text; alignment is a power-of-two exponent. Validation errors preserve your draft.</p>
				<details><summary>Record syntax</summary><code v-for="kind in kinds" :key="kind.id">{{ kind.example }}</code></details>
				<div class="view-facts__actions"><button class="view-facts__primary">Save fact</button><button type="button" @click="db.resetEditor()">Cancel</button></div>
			</form>
			<form v-if="db.bulk" class="view-facts__editor" @submit.prevent="saveBulk">
				<label>Layer factmap · {{ db.layers[db.bulkLayer]?.label }}<textarea v-model="db.bulkText" rows="14" spellcheck="false" required aria-label="Layer factmap"></textarea></label>
				<p class="view-facts__help">Include #factmap on the first line. Saving validates the complete layer before replacing it. Record order and duplicates are preserved; file comments and formatting are discarded.</p>
				<div class="view-facts__actions"><button class="view-facts__primary">Save layer</button><button type="button" @click="db.resetEditor()">Cancel</button></div>
			</form>

		</section>
		<div v-if="db.mode === 'inspect' || db.current">
			<property-grid class="view-facts__table-wrap" :list="pageRows" :interpretations="recordColumns" :row-key="recordKey" label="Fact records" auto-layout>
				<template #kind="{ value: row }">
					<span class="view-facts__badge" :data-fact-kind="row.kind">{{ kindName(row.kind) }}</span>
				</template>
				<template #address="{ value: row }">
					<span class="view-facts__address"><span class="view-facts__muted">{{ sectionName(row.rva) }}:</span><span data-kind="rva">{{ hex(row.rva) }}</span></span>
				</template>
				<template #payload="{ value: row }">
					<div class="view-facts__payload" :title="row.text">
						<span v-if="row.kind === 'R'" data-kind="rva">{{ row.payload }}</span>
						<template v-else>{{ description(row) }}</template>
					</div>
				</template>
				<template #actions="{ value: row }">
					<div class="view-facts__row-actions">
						<button :disabled="drafting" @click="edit(row)" aria-label="Edit fact" title="Edit fact"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5M4 15 15 4a2.1 2.1 0 0 1 3 0l2 2a2.1 2.1 0 0 1 0 3L9 20l-6 1 1-6Z"/></svg></button>
						<button :disabled="drafting" @click="removeFact(row)" aria-label="Remove fact" title="Remove fact"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button>
					</div>
				</template>
				<template #empty>
					<div class="view-facts__empty">{{ db.mode === 'layers' ? 'This layer is empty. Add a fact or edit its text.' : 'No matching facts. Adjust the filters or import a factmap in Manage layers.' }}</div>
				</template>
			</property-grid>
			<div class="view-facts__pagination"><span>Page {{ pageIndex + 1 }} of {{ pageCount }} · 100 records per page · {{ db.mode === 'inspect' ? 'sorted by RVA' : 'stored record order' }}</span><button :disabled="pageIndex === 0" @click="db.page = pageIndex - 1">Previous</button><button :disabled="pageIndex + 1 >= pageCount" @click="db.page = pageIndex + 1">Next</button></div>
		</div>
	</section>
</template>

<style>
.view-facts { padding: 0 var(--workspace-gutter) 24px; font-size: 12px; }
.view-facts button, .view-facts input, .view-facts select, .view-facts textarea { border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-background); color: var(--color-text); padding: 7px 9px; font: inherit; min-width: 0; }
.view-facts button { cursor: pointer; white-space: nowrap; }
.view-facts button:hover:enabled { background: var(--color-surface); border-color: var(--color-accent); }
.view-facts button:disabled { opacity: .45; cursor: default; }
.view-facts :is(button, input, select, textarea, summary):focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.view-facts button.view-facts__primary { background: var(--color-accent); color: var(--color-on-accent); border-color: var(--color-accent); }
.view-facts button.view-facts__primary:hover:enabled { background: var(--color-accent-hover); }
.view-facts label { display: flex; flex-direction: column; gap: 6px; }
.view-facts__help { color: var(--color-muted); line-height: 1.6; margin: 12px 0 20px; max-width: 110ch; }
.view-facts__muted { color: var(--color-muted); font-size: 11px; }
.view-facts__error, .view-facts__notice { padding: 12px; background: var(--color-surface); overflow-wrap: anywhere; border-left: 3px solid currentColor; }
.view-facts__error { color: var(--color-danger); }
.view-facts__notice { color: var(--color-secondary); }
.view-facts__subhead { justify-content: space-between; margin-bottom: 12px; }
.view-facts__map { border: 1px solid var(--color-border); border-radius: 5px; padding: 14px; margin-bottom: 18px; }
.view-facts__bins { height: 74px; display: grid; grid-template-columns: repeat(96, minmax(0, 1fr)); gap: 1px; border-bottom: 1px solid var(--color-border); }
.view-facts__bins button { border: 0; padding: 0; border-radius: 0; display: flex; align-items: end; background: var(--color-surface); }
.view-facts__bins button span { display: block; width: 100%; background: var(--color-secondary); min-height: 1px; }
.view-facts__bins button:hover { outline: 1px solid var(--color-accent); }
.view-facts__section-map { position: relative; height: 26px; margin-top: 4px; overflow: hidden; }
.view-facts__section-map button { position: absolute; overflow: hidden; padding: 3px 1px; border-radius: 1px; font-size: 10px; text-overflow: clip; height: 23px; }
.view-facts__axis { display: flex; justify-content: space-between; color: var(--color-muted); font: 10px ui-monospace, monospace; margin-top: 6px; }
.view-facts__layer-toolbar { margin-bottom: 18px; }
.view-facts__layer-toolbar form { margin-right: auto; }
.view-facts__layer-toolbar label { flex-direction: row; align-items: center; }
.view-facts__layer-toolbar input { max-width: 180px; }
.view-facts__filters { display: grid; grid-template-columns: minmax(180px, 2fr) repeat(4, minmax(110px, 1fr)) auto; gap: 10px; margin-bottom: 18px; align-items: end; }
.view-facts__filters > button { justify-self: start; }
.view-facts__editor { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 5px; padding: 16px; margin: 12px 0; display: flex; flex-direction: column; gap: 12px; }
.view-facts__editor textarea { width: 100%; resize: vertical; font: 12px/1.7 ui-monospace, SFMono-Regular, Consolas, monospace; tab-size: 4; }
.view-facts__editor .view-facts__help { margin: 0; }
.view-facts__editor code { display: block; margin: 6px 0; }
.view-facts__editor summary { cursor: pointer; }
.view-facts__table-wrap { border: 1px solid var(--color-border); border-radius: 4px; }
.view-facts__table-wrap .property-grid__table :is(th, td) { padding: 3px 8px; border: 0; vertical-align: middle; line-height: 18px; }
.view-facts__table-wrap .property-grid__table th { padding-top: 6px; padding-bottom: 6px; white-space: nowrap; }
.view-facts__table-wrap .property-grid__table td { font-family: inherit; white-space: normal; }
.view-facts__table-wrap .property-grid__table :is(th, td):last-child { white-space: nowrap; }
.view-facts__table-wrap tbody tr:nth-child(even) { background: color-mix(in srgb, var(--color-surface) 55%, var(--color-background)); }
.view-facts__address { font: 12px ui-monospace, monospace; white-space: nowrap; }
.view-facts__address .view-facts__muted { font-size: inherit; }
.view-facts__row-actions { display: flex; flex-wrap: nowrap; gap: 2px; }
.view-facts__row-actions button { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 3px; border-color: transparent; background: transparent; color: var(--color-muted); }
.view-facts__row-actions button:hover:enabled { color: var(--color-text); }
.view-facts__row-actions button:last-child:hover:enabled { color: var(--color-danger); }
.view-facts__row-actions svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.view-facts__payload { font-family: ui-monospace, monospace; min-width: 180px; max-width: 480px; white-space: pre-wrap; overflow-wrap: anywhere; }
.view-facts__badge { font-size: 10px; border-left: 2px solid var(--color-accent); padding-left: 5px; }
.view-facts__badge[data-fact-kind="C"] { border-color: var(--color-secondary); }
.view-facts__badge[data-fact-kind="R"] { border-color: var(--color-warning); }
.view-facts__empty { text-align: center; color: var(--color-muted); padding: 29px 24px; white-space: normal; }
.view-facts__pagination { margin-top: 12px; color: var(--color-muted); }
.view-facts__pagination span { margin-right: auto; }
.view-facts__subhead, .view-facts__actions, .view-facts__layer-toolbar, .view-facts__layer-toolbar form, .view-facts__pagination { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.view-facts h2 { margin: 0; font-size: 13px; font-weight: 600; }
.view-facts__navigation { display: flex; gap: 4px; border-bottom: 1px solid var(--color-border); margin-bottom: 22px; }
.view-facts__navigation button { border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent; padding: 9px 16px; color: var(--color-muted); }
.view-facts__navigation button[aria-pressed="true"] { color: var(--color-accent); border-bottom-color: var(--color-accent); }
.view-facts__inspection-layers { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; margin: 18px 0; }
.view-facts__inspection-layers > span { color: var(--color-muted); }
.view-facts__inspection-layers label { flex-direction: row; align-items: center; gap: 6px; }
.view-facts input[type="checkbox"] { accent-color: var(--color-accent); }
.view-facts__layers-table .property-grid__table td { padding-top: 5px; padding-bottom: 5px; }
.view-facts__layers-table tbody tr:has(.view-facts__layer-select[aria-pressed="true"]) { background: color-mix(in srgb, var(--color-accent) 9%, var(--color-background)); }
.view-facts button.view-facts__layer-select { border: 0; padding: 3px 0; background: transparent; text-align: left; }
.view-facts__layer-select[aria-pressed="true"] { color: var(--color-accent); font-weight: 600; }
.view-facts__editor-heading { padding-top: 20px; border-top: 1px solid var(--color-border); margin-top: 24px; }
@media (max-width: 1100px) { .view-facts__filters { grid-template-columns: repeat(3, minmax(100px, 1fr)); } }
@media (max-width: 700px) { .view-facts__filters { grid-template-columns: repeat(2, minmax(90px, 1fr)); } }
</style>

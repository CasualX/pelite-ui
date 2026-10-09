
<script>
/** @typedef {{ headers: import('./deps/pelite.js').PeSectionHeader[], characteristics: string[][], entropy: import('./deps/pelite.js').SectionEntropy[] }} SectionHeadersViewData */

/** @param {ViewContext} context @param {import('./deps/pelite.js').PeHeaders} [existingHeaders] @returns {ViewContent} */
function prepareSectionHeadersView(context, existingHeaders) {
	const headers = existingHeaders ?? context.peFile.headers();
	if (headers instanceof Error) throw headers;
	const entropy = context.peFile.sectionEntropy();
	if (entropy instanceof Error) throw entropy;
	return { component: 'view-section-headers', data: {
		headers: headers.SectionHeaders,
		characteristics: headers.details['SectionHeaders.Characteristics'],
		entropy,
	} };
}

const ViewSectionHeaders = Vue.defineComponent({
	template: '#view-section-headers',
	props: { data: { type: Object, required: true } },
	computed: {
		sectionData() { return /** @type {SectionHeadersViewData} */ (/** @type {unknown} */ (this.data)); },
		fields() { return /** @type {(keyof import('./deps/pelite.js').PeSectionHeader)[]} */ (Object.keys(this.sectionData.headers[0] ?? {})); },
	},
	methods: {
		/** @param {string | number} value @returns {string} */
		formatValue(value) { return typeof value === 'number' && value !== 0 ? `0x${value.toString(16)}` : String(value); },
		/** @param {number} flags @returns {string} */
		permissions(flags) { return [[0x40000000, 'R'], [0x80000000, 'W'], [0x20000000, 'X']].map(([flag, letter]) => flags & Number(flag) ? letter : '—').join(''); },
	},
});
</script>

<template id="view-section-headers">
	<section class="view-section-headers">
		<div v-if="sectionData.headers.length" class="view-section-headers__table-wrap">
			<table aria-label="Section headers">
				<thead><tr>
					<th scope="col">#</th>
					<th v-for="field in fields" :key="field" scope="col" :class="{ 'view-section-headers__name': field === 'Name' }">{{ field }}</th>
					<th scope="col">Permissions</th><th scope="col">Entropy</th><th scope="col">Distribution</th><th scope="col" class="view-section-headers__interpretation">Characteristics interpretation</th>
				</tr></thead>
				<tbody><tr v-for="(header, index) in sectionData.headers" :key="index">
					<td>{{ index + 1 }}</td>
					<td v-for="field in fields" :key="field" :class="{ 'view-section-headers__name': field === 'Name' }"
						:data-kind="field === 'VirtualAddress' ? 'rva' : field === 'PointerToRawData' ? 'fo' : undefined">{{ formatValue(header[field]) }}</td>
					<td>{{ permissions(header.Characteristics) }}</td>
					<td>{{ sectionData.entropy[index].entropy?.toFixed(2) ?? '—' }}</td>
					<td><div class="view-section-headers__entropy" aria-label="Entropy distribution, scale 0 to 8"><span v-for="(entropy, sample) in sectionData.entropy[index].samples" :key="sample" :style="{ height: (entropy / 8 * 100) + '%' }" :title="entropy.toFixed(2)"></span></div></td>
					<td class="view-section-headers__interpretation">{{ sectionData.characteristics[index].join('\n') }}</td>
				</tr></tbody>
			</table>
		</div>
		<p v-else class="view-section-headers__empty">No section headers.</p>
	</section>
</template>

<style>
.view-section-headers__empty { margin: 0; color: var(--color-muted); font-size: 13px; }
.view-section-headers__table-wrap { max-width: 100%; overflow-x: auto; }
.view-section-headers table { width: max-content; border: 1px solid var(--color-border); border-collapse: collapse; font-size: 12px; }
.view-section-headers th { padding: 9px 14px; background: var(--color-surface); color: var(--color-muted); font-weight: 600; white-space: nowrap; }
.view-section-headers td { padding: 9px 14px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; white-space: nowrap; }
.view-section-headers th, .view-section-headers td { border-bottom: 1px solid var(--color-border); text-align: right; vertical-align: top; }
.view-section-headers .view-section-headers__name, .view-section-headers .view-section-headers__interpretation { text-align: left; }
.view-section-headers td.view-section-headers__interpretation { white-space: pre-wrap; }
.view-section-headers tbody tr:hover { background: var(--color-surface); }
.view-section-headers__entropy { display: flex; align-items: flex-end; gap: 2px; width: 96px; height: 20px; border-bottom: 1px solid var(--color-border); }
.view-section-headers__entropy span { flex: 1; min-height: 1px; background: var(--color-secondary); }
</style>

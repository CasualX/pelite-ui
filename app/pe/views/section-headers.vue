<link rel="component" href="../../components/property-grid.vue">
<link rel="component" href="section-entropy.vue">

<script>
/** @typedef {{ headers: PeLite.PeSectionHeader[], characteristics: string[][], entropy: PeLite.SectionEntropy[] }} SectionHeadersViewData */

/** @param {PeDocument} context @param {PeLite.PeHeaders} [existingHeaders] @returns {ViewContent} */
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
	components: { SectionEntropy },
	props: { data: { type: Object, required: true } },
	computed: {
		sectionData() { return /** @type {SectionHeadersViewData} */ (/** @type {unknown} */ (this.data)); },
		/** @returns {PropertyGridColumn[]} */
		columns() {
			const order = /** @type {(keyof PeLite.PeSectionHeader)[]} */ (['Name', 'VirtualAddress', 'VirtualSize', 'PointerToRawData', 'SizeOfRawData']);
			const fields = /** @type {typeof order} */ (Object.keys(this.sectionData.headers[0] ?? {}));
			const orderedFields = [...order.filter(field => fields.includes(field)), ...fields.filter(field => !order.includes(field))];
			const numericStyle = { textAlign: 'right' };
			return [
				{ title: '#', width: '1%', style: numericStyle, format: (_header, index) => String(Number(index) + 1) },
				...orderedFields.map(/** @returns {PropertyGridColumn} */ field => ({
					title: field,
					width: '1%',
					style: field === 'Name' ? undefined : numericStyle,
					kind: field === 'VirtualAddress' ? 'rva' : field === 'PointerToRawData' ? value =>
						(/** @type {PeLite.PeSectionHeader} */ (value)).PointerToRawData !== 0 ? 'fo' : undefined : undefined,
					slot: field === 'Characteristics' ? 'characteristics' : undefined,
					format: value => this.formatValue((/** @type {PeLite.PeSectionHeader} */ (value))[field]),
				})),
				{ title: 'Perms', label: 'Permissions', width: '1%', style: numericStyle,
					format: value => this.permissions((/** @type {PeLite.PeSectionHeader} */ (value)).Characteristics) },
				{ title: 'Entropy', width: '1%', style: numericStyle,
					format: (_header, index) => this.sectionData.entropy[Number(index)].entropy?.toFixed(2) ?? '—' },
				{ title: 'Distribution', slot: 'distribution' },
			];
		},
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
		<property-grid v-if="sectionData.headers.length" class="view-section-headers__grid" :list="sectionData.headers" :interpretations="columns" label="Section headers" auto-layout>
			<template #characteristics="{ value, index }">
				<span :title="sectionData.characteristics[index].join('\n')">{{ formatValue(value.Characteristics) }}</span>
			</template>
			<template #distribution="{ index }">
				<section-entropy :samples="sectionData.entropy[index].samples"></section-entropy>
			</template>
		</property-grid>
		<p v-else class="view-section-headers__empty">No section headers.</p>
	</section>
</template>

<style>
.view-section-headers__empty { margin: 0; color: var(--color-muted); font-size: 13px; }
.view-section-headers__grid :is(th, td) { white-space: nowrap; }
</style>

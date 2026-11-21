<link rel="component" href="../../components/property-grid.vue">
<link rel="component" href="section-entropy.vue">

<script>
/** @typedef {keyof PeLite.PeSectionHeader} SectionHeaderField */

const sectionHeaderOrder = /** @type {SectionHeaderField[]} */ (['Name', 'VirtualAddress', 'VirtualSize', 'PointerToRawData', 'SizeOfRawData']);

const SectionHeadersTable = Vue.defineComponent({
	template: '#section-headers-table',
	components: { SectionEntropy },
	props: {
		headers: { type: Array, required: true },
		characteristics: { type: Array, required: true },
		entropy: { type: Array, required: true },
	},
	computed: {
		sectionEntropy() { return /** @type {PeLite.SectionEntropy[]} */ (this.entropy); },
		/** @returns {PropertyGridColumn[]} */
		columns() {
			const fields = /** @type {SectionHeaderField[]} */ (Object.keys(this.headers[0] ?? {}));
			const orderedFields = [...sectionHeaderOrder.filter(field => fields.includes(field)), ...fields.filter(field => !sectionHeaderOrder.includes(field))];
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
					format: value => formatPropertyGridHex((/** @type {PeLite.PeSectionHeader} */ (value))[field]),
				})),
				{ title: 'Perms', label: 'Permissions', width: '1%', style: numericStyle,
					format: value => this.permissions((/** @type {PeLite.PeSectionHeader} */ (value)).Characteristics) },
				{ title: 'Entropy', width: '1%', style: numericStyle,
					format: (_header, index) => this.sectionEntropy[Number(index)].entropy?.toFixed(2) ?? '—' },
				{ title: 'Distribution', slot: 'distribution' },
			];
		},
	},
	methods: {
		formatPropertyGridHex,
		/** @param {number} flags @returns {string} */
		permissions(flags) { return [[0x40000000, 'R'], [0x80000000, 'W'], [0x20000000, 'X']].map(([flag, letter]) => flags & Number(flag) ? letter : '—').join(''); },
	},
});
</script>

<template id="section-headers-table">
	<property-grid v-if="headers.length" class="section-headers-table" :list="headers" :interpretations="columns" label="Section headers" auto-layout>
		<template #characteristics="{ value, index }">
			<span :title="characteristics[index].join('\n')">{{ formatPropertyGridHex(value.Characteristics) }}</span>
		</template>
		<template #distribution="{ index }">
			<section-entropy :samples="sectionEntropy[index].samples"></section-entropy>
		</template>
	</property-grid>
	<p v-else class="section-headers-table__empty">No section headers.</p>
</template>

<style>
.section-headers-table :is(th, td) { white-space: nowrap; }
.section-headers-table__empty { margin: 0; color: var(--color-muted); font-size: 13px; }
</style>

<link rel="component" href="../../components/property-grid.vue">

<script>

/** @param {ViewContext} context @returns {boolean} */
function isRichStructureAvailable(context) {
	return !(context.peFile.richStructure() instanceof Error);
}

/** @param {ViewContext} context @returns {ViewContent} */
function prepareRichStructureView(context) {
	const rich = context.peFile.richStructure();
	if (rich instanceof Error) throw rich;
	return { component: 'view-rich-structure', data: { rich } };
}

const ViewRichStructure = Vue.defineComponent({
	template: '#view-rich-structure',
	props: { data: { type: Object, required: true } },
	data() {
		return {
			recordInterpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: '#', style: { textAlign: 'right' }, format: (value, index) => String(Number(index) + 1) },
				{ title: 'Product', style: { minWidth: '100px', textAlign: 'right' }, format: value => {
					const product = (/** @type {import('./deps/pelite.js').PeRichRecord} */ (value)).product;
					return product === 0 ? '0' : `0x${product.toString(16)}`;
				} },
				{ title: 'Build', style: { minWidth: '100px', textAlign: 'right' }, format: value => String((/** @type {import('./deps/pelite.js').PeRichRecord} */ (value)).build) },
				{ title: 'Count', style: { minWidth: '100px', textAlign: 'right' }, format: value => String((/** @type {import('./deps/pelite.js').PeRichRecord} */ (value)).count) },
			]),
		};
	},
	computed: {
		/** @returns {PropertyGridColumn[]} */
		summaryInterpretations() {
			const rich = /** @type {import('./deps/pelite.js').PeRichStructure} */ (/** @type {unknown} */ (this.data.rich));
			return [
				{ title: 'Field', style: { minWidth: '160px' }, format: (value, name) => name === 'xor_key' ? 'XOR key' : 'Checksum' },
				{ title: 'Value', style: { minWidth: '140px', textAlign: 'right' }, format: value => value === 0 ? '0' : `0x${Number(value).toString(16)}` },
				{ title: 'Interpretation', style: { minWidth: '240px' }, format: (value, name) =>
					name === 'checksum' ? (rich.checksum === rich.xor_key ? 'Matches XOR key' : 'Does not match XOR key') : '' },
			];
		},
	},
});
</script>

<template id="view-rich-structure">
	<section class="view-rich-structure">
		<p class="view-rich-structure__description">Decoded product identifiers, build numbers, and object counts recorded by the toolchain.</p>
		<property-grid :list="{ xor_key: data.rich.xor_key, checksum: data.rich.checksum }" :interpretations="summaryInterpretations" label="Rich structure summary"></property-grid>
		<h2 class="view-rich-structure__section-title">Records</h2>
		<property-grid v-if="data.rich.records.length" :list="data.rich.records" :interpretations="recordInterpretations" label="Rich records"></property-grid>
		<p v-else class="view-rich-structure__description">No Rich records.</p>
	</section>
</template>

<style>
.view-rich-structure__description { margin: 0 0 26px; color: var(--color-muted); font-size: 13px; }
.view-rich-structure__section-title { margin: 26px 0 12px; font-size: 14px; font-weight: 600; }
</style>

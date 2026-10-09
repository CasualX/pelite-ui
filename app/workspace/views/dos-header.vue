<link rel="component" href="../../components/property-grid.vue">

<script>
/** @param {ViewContext} context @returns {ViewContent} */
function prepareDosHeaderView(context) {
	const header = context.peFile.dosHeader();
	if (header instanceof Error) throw header;
	const fields = Object.fromEntries(Object.entries(header).filter(([name]) =>
		name !== 'e_res' && name !== 'e_res2'
	));

	return { component: 'view-dos-header', data: { header: fields } };
}

const ViewDosHeader = Vue.defineComponent({
	template: '#view-dos-header',
	props: { data: { type: Object, required: true } },
	data() {
		return {
			interpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', format: (value, name) => String(name) },
				{ title: 'Value', style: { textAlign: 'right' }, format: value => typeof value === 'number' && value !== 0 ? `0x${value.toString(16)}` : String(value) },
			]),
		};
	},
});
</script>

<template id="view-dos-header">
	<section class="view-dos-header">
		<p class="view-dos-header__description">IMAGE_DOS_HEADER</p>
		<property-grid :list="data.header" :interpretations="interpretations" label="DOS header fields"></property-grid>
	</section>
</template>

<style>
.view-dos-header { max-width: 1100px; }
.view-dos-header__description { margin: 0 0 26px; color: var(--color-muted); font-size: 13px; }
</style>

<link rel="component" href="../../components/property-grid.vue">

<script>
/** @param {PeDocument} context @returns {ViewContent} */
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
				{ title: 'Field', width: '9rem', format: (value, name) => String(name) },
				{ title: 'Value', width: '8rem', kind: (value, field) => value && (field === 'e_lfarlc' || field === 'e_lfanew') ? 'fo' : undefined,
					style: { textAlign: 'right' }, format: formatPropertyGridHex },
			]),
		};
	},
});
</script>

<template id="view-dos-header">
	<section class="view-dos-header">
		<p class="view-dos-header__description">IMAGE_DOS_HEADER</p>
		<property-grid :list="data.header" :interpretations="interpretations" label="DOS header fields" spacer></property-grid>
	</section>
</template>

<style>
.view-dos-header__description { margin: 0 0 26px; color: var(--color-muted); font-size: 13px; }
</style>

<link rel="component" href="section-headers-table.vue">

<script>
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
	components: { SectionHeadersTable },
	props: { data: { type: Object, required: true } },
});
</script>

<template id="view-section-headers">
	<section>
		<section-headers-table :headers="data.headers" :characteristics="data.characteristics" :entropy="data.entropy"></section-headers-table>
	</section>
</template>

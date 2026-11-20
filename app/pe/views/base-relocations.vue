<script>
/** @param {PeDocument} context @returns {ViewContent} */
function prepareBaseRelocationsView(context) {
	const relocations = context.peFile.baseRelocations();
	if (relocations instanceof Error) throw relocations;
	if (relocations === null) throw new Error('The directory is unavailable.');
	return { component: 'view-base-relocations', data: { count: relocations.rvas.length } };
}

const ViewBaseRelocations = Vue.defineComponent({
	template: '#view-base-relocations',
	props: { data: { type: Object, required: true } },
});
</script>

<template id="view-base-relocations">
	<p>{{ data.count.toLocaleString() }} base relocation {{ data.count === 1 ? 'record' : 'records' }}</p>
</template>

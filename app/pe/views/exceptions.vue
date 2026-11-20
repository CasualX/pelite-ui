<link rel="component" href="x64-exceptions.vue" dynamic>

<script>
/** @param {PeDocument} context @returns {ViewContent} */
function prepareExceptionsView(context) {
	const header = context.peFile.fileHeader();
	if (header instanceof Error) throw header;
	if (header.Machine === 0x8664) return prepareX64ExceptionsView(context);
	return { component: 'view-exceptions', data: { machine: `0x${header.Machine.toString(16).padStart(4, '0')}` } };
}

const ViewExceptions = Vue.defineComponent({
	template: '#view-exceptions',
	props: { data: { type: Object, required: true } },
});
</script>

<template id="view-exceptions">
	<p>Exception entries for machine type {{ data.machine }} are unsupported.</p>
</template>

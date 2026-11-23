<script>
/** @param {PeDocument} context @returns {ViewContent} */
function prepareX64ExceptionsView(context) {
	const functions = context.peFile.exceptionsX64();
	if (functions instanceof Error) throw functions;
	if (functions === null) throw new Error('The directory is unavailable.');
	return { component: 'view-x64-exceptions', data: { count: functions.length } };
}

const ViewX64Exceptions = Vue.defineComponent({
	template: '#view-x64-exceptions',
	props: { data: { type: Object, required: true } },
});
</script>

<template id="view-x64-exceptions">
	<p class="view-x64-exceptions">{{ data.count.toLocaleString() }} runtime {{ data.count === 1 ? 'function' : 'functions' }}</p>
</template>

<style>
.view-x64-exceptions { margin-left: var(--workspace-gutter); margin-right: var(--workspace-gutter); }
</style>

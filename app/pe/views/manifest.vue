<script>
/** @param {PeDocument} context @returns {boolean} */
function isManifestAvailable(context) {
	const manifest = context.peFile.resourcesManifest();
	return manifest !== null && !(manifest instanceof Error);
}

/** @param {PeDocument} context @returns {ViewContent} */
function prepareManifestView(context) {
	const manifest = context.peFile.resourcesManifest();
	if (manifest instanceof Error) throw manifest;
	if (manifest === null) throw new Error('No manifest resource was found.');
	return { component: 'view-manifest', data: { manifest } };
}

const ViewManifest = Vue.defineComponent({
	template: '#view-manifest',
	props: { data: { type: Object, required: true } },
});
</script>

<template id="view-manifest">
	<textarea class="view-manifest" aria-label="Manifest XML" :value="data.manifest" readonly spellcheck="false"></textarea>
</template>

<style>
.view-manifest {
	display: block;
	width: 100%;
	height: 100%;
	margin: 0;
	padding: 12px;
	border: 0;
	border-radius: 0;
	background: transparent;
	color: inherit;
	font: 12px/1.7 ui-monospace, SFMono-Regular, Consolas, monospace;
	tab-size: 4;
	overflow-wrap: anywhere;
	resize: none;
}
.view-manifest:focus { outline: none; }
</style>

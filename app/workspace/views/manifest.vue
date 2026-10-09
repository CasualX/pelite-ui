<script>
/** @param {ViewContext} context @returns {boolean} */
function isManifestAvailable(context) {
	const manifest = context.peFile.resourcesManifest();
	return manifest !== null && !(manifest instanceof Error);
}

/** @param {ViewContext} context @returns {ViewContent} */
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
	<section class="view-manifest">
		<pre class="view-manifest__source" aria-label="Manifest XML"><code>{{ data.manifest }}</code></pre>
	</section>
</template>

<style>
.view-manifest { min-width: 0; }
.view-manifest__source { margin: 0; padding: 16px 20px; overflow-x: auto; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; line-height: 1.7; tab-size: 4; }
.view-manifest__source code { font: inherit; }
</style>

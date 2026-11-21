<link rel="component" href="../../components/property-grid.vue">

<script>
/** @param {PeDocument} context @returns {ViewContent} */
function prepareTlsView(context) {
	const directory = context.peFile.tls();
	if (directory instanceof Error) throw directory;
	if (directory === null) throw new Error('The directory is unavailable.');
	return { component: 'view-tls', data: { directory, fields: { ...directory.image, 'TLS slot': directory.slot } } };
}

const ViewTls = Vue.defineComponent({
	template: '#view-tls',
	props: { data: { type: Object, required: true } },
	data() {
		const addresses = ['StartAddressOfRawData', 'EndAddressOfRawData', 'AddressOfIndex', 'AddressOfCallBacks'];
		return {
			headerColumns: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', width: 'clamp(11rem, 26.5cqi, 16rem)', format: (value, field) => String(field) },
				{ title: 'Value', width: '10rem', kind: (value, field) => value && addresses.includes(String(field)) ? 'va' : undefined,
					style: { textAlign: 'right' }, format: formatPropertyGridHex },
			]),
			callbackColumns: /** @type {PropertyGridColumn[]} */ ([{ title: 'Callback VA', width: '11rem', kind: 'va', style: { textAlign: 'right' }, format: formatPropertyGridHex }]),
		};
	},
});
</script>

<template id="view-tls">
	<section>
		<property-grid :list="data.fields" :interpretations="headerColumns" label="TLS directory header" spacer></property-grid>
		<h2 class="view-tls__title">TLS callbacks</h2>
		<property-grid v-if="data.directory.callbacks?.length" :list="data.directory.callbacks" :interpretations="callbackColumns" label="TLS callbacks" spacer></property-grid>
		<p v-else class="view-tls__note">{{ data.directory.callbacks === null && data.directory.image.AddressOfCallBacks ? 'Callback table unavailable.' : 'No TLS callbacks.' }}</p>
		<h2 class="view-tls__title">Initialized TLS data (Base64)</h2>
		<textarea v-if="data.directory.raw_data" class="view-tls__payload" aria-label="Initialized TLS data (Base64)"
			readonly spellcheck="false" :value="data.directory.raw_data"></textarea>
		<p v-else class="view-tls__note">{{ data.directory.raw_data === null && data.directory.image.StartAddressOfRawData !== data.directory.image.EndAddressOfRawData
			? 'Initialized TLS data unavailable.' : 'No initialized TLS data.' }}</p>
	</section>
</template>

<style>
.view-tls__title { margin: 24px 0 12px; font-size: 14px; font-weight: 600; }
.view-tls__note { margin: 0 0 12px; color: var(--color-muted); font-size: 13px; }
.view-tls__payload { display: block; width: min(100%, 560px); min-height: 90px; padding: 8px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); color: var(--color-text); font: 12px ui-monospace, SFMono-Regular, Consolas, monospace; resize: vertical; }
</style>

<link rel="component" href="../../components/property-grid.vue">

<script>
/** @param {PeDocument} context @returns {ViewContent} */
function prepareTlsView(context) {
	const directory = context.peFile.tls();
	if (directory instanceof Error) throw directory;
	if (directory === null) throw new Error('The directory is unavailable.');
	return { component: 'view-tls', data: { directory, fields: { ...directory.image, 'TLS slot RVA': directory.slot } } };
}

const ViewTls = Vue.defineComponent({
	template: '#view-tls',
	props: { data: { type: Object, required: true } },
	data() {
		const addresses = ['StartAddressOfRawData', 'EndAddressOfRawData', 'AddressOfIndex', 'AddressOfCallBacks'];
		return {
			headerColumns: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', width: 'clamp(11rem, 26.5cqi, 16rem)', format: (value, field) => String(field) },
				{ title: 'Value', width: '10rem', style: { textAlign: 'right' }, format: formatPropertyGridHex,
					kind: (value, field) => {
						if (field === 'TLS slot RVA') return typeof value === 'number' ? 'rva' : undefined;
						return value && addresses.includes(String(field)) ? 'va' : undefined;
					},
				},
			]),
			callbackColumns: /** @type {PropertyGridColumn[]} */ ([{ title: 'Callback VA', width: '11rem', kind: 'va', style: { textAlign: 'right' }, format: formatPropertyGridHex }]),
		};
	},
});
</script>

<template id="view-tls">
	<section class="view-tls">
		<property-grid :list="data.fields" :interpretations="headerColumns" label="TLS directory header" spacer></property-grid>
		<property-grid v-if="data.directory.callbacks?.length" :list="data.directory.callbacks" :interpretations="callbackColumns" label="TLS callbacks" spacer></property-grid>
		<p v-else class="view-tls__note">{{ data.directory.callbacks === null && data.directory.image.AddressOfCallBacks ? 'Callback table unavailable.' : 'No TLS callbacks.' }}</p>
	</section>
</template>

<style>
.view-tls { padding-bottom: 24px; }
.view-tls__note { margin: 12px var(--workspace-gutter) 0; color: var(--color-muted); font-size: 13px; }
</style>

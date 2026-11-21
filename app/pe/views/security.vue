<link rel="component" href="../../components/property-grid.vue">
<link rel="component" href="security-certificate.vue">

<script>
/** @param {PeDocument} context @returns {ViewContent} */
function prepareSecurityView(context) {
	const certificates = context.peFile.security();
	if (certificates instanceof Error) throw certificates;
	if (certificates === null) throw new Error('The directory is unavailable.');
	const headers = context.peFile.headers();
	if (headers instanceof Error) throw headers;
	const directory = headers.DataDirectory[4];
	return { component: 'view-security', data: {
		fields: { 'File offset': directory.VirtualAddress, 'Table size': directory.Size },
		certificates,
	} };
}

const ViewSecurity = Vue.defineComponent({
	template: '#view-security',
	components: { SecurityCertificate },
	props: { data: { type: Object, required: true } },
	data() {
		return { columns: /** @type {PropertyGridColumn[]} */ ([
			{ title: 'Field', width: '10rem', format: (value, field) => String(field) },
			{ title: 'Value', width: '8rem', kind: (value, field) => field === 'File offset' ? 'fo' : undefined,
				style: { textAlign: 'right' }, format: formatPropertyGridHex },
		]) };
	},
});
</script>

<template id="view-security">
	<section>
		<property-grid :list="data.fields" :interpretations="columns" label="Certificate table" spacer></property-grid>
		<ol v-if="data.certificates.length" class="view-security__certificates" role="list" aria-label="Certificates">
			<li v-for="(certificate, index) in data.certificates" :key="index">
				<h2 class="view-security__title">Certificate {{ index + 1 }}</h2>
				<p v-if="'$error' in certificate" class="view-security__note">Unable to read certificate entry ({{ certificate.$error }}).</p>
				<security-certificate v-else :certificate="certificate" :entry-number="index + 1"></security-certificate>
			</li>
		</ol>
		<p v-else class="view-security__note view-security__empty">No certificates.</p>
	</section>
</template>

<style>
.view-security__certificates { margin: 0; padding: 0; list-style: none; }
.view-security__certificates > li + li { margin-top: 24px; border-top: 1px solid var(--color-border); }
.view-security__title { margin: 24px 0 12px; font-size: 14px; font-weight: 600; }
.view-security__note { margin: 0 0 12px; color: var(--color-muted); font-size: 13px; }
.view-security__empty { margin-top: 12px; }
</style>

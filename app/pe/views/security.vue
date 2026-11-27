<link rel="component" href="../../components/property-grid.vue">
<link rel="component" href="security-certificate.vue">

<script>
/** @param {unknown} value @param {keyof PeLite.PeCertificateImage} field */
function formatSecurityCertificateField(value, field) {
	const certificate = /** @type {PeLite.PeSecurityDirectory[number]} */ (value);
	return formatPropertyGridHex('$error' in certificate ? undefined : certificate.image[field]);
}

/** @param {PeDocument} context @returns {ViewContent} */
function prepareSecurityView(context) {
	const certificates = context.peFile.security();
	if (certificates instanceof Error) throw certificates;
	if (certificates === null) throw new Error('The directory is unavailable.');
	const headers = context.peFile.headers();
	if (headers instanceof Error) throw headers;
	const directory = headers.DataDirectory[4];
	return { component: 'view-security', data: {
		fields: { 'FileOffset': directory.VirtualAddress, 'Size': directory.Size },
		certificates,
	} };
}

const ViewSecurity = Vue.defineComponent({
	template: '#view-security',
	components: { SecurityCertificate },
	props: { data: { type: Object, required: true } },
	data() {
		return {
			selectedIndex: 0,
			columns: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', width: '10rem', format: (value, field) => String(field) },
				{ title: 'Value', width: '8rem', kind: (value, field) => field === 'FileOffset' ? 'fo' : undefined,
					style: { textAlign: 'right' }, format: formatPropertyGridHex },
			]),
			certificateColumns: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Name', width: 'clamp(9rem, 20cqi, 10rem)', format: (value, index) => `Certificate ${Number(index) + 1}` },
				{ title: 'dwLength', width: '6.25rem', style: { textAlign: 'right' }, format: value => formatSecurityCertificateField(value, 'dwLength') },
				{ title: 'wRevision', width: '5.25rem', style: { textAlign: 'right' }, format: value => formatSecurityCertificateField(value, 'wRevision') },
				{ title: 'wCertificateType', width: 'clamp(8rem, 17cqi, 8.75rem)', style: { textAlign: 'right' }, format: value => formatSecurityCertificateField(value, 'wCertificateType') },
			]),
		};
	},
	computed: {
		certificates() { return /** @type {PeLite.PeSecurityDirectory} */ (this.data.certificates); },
		selectedCertificate() { return this.certificates.at(this.selectedIndex); },
	},
});
</script>

<template id="view-security">
	<section class="view-security">
		<div class="view-security__tables" role="region" aria-label="Certificate headers" tabindex="0">
			<property-grid :list="data.fields" :interpretations="columns" label="Certificate table" spacer></property-grid>
			<property-grid v-if="certificates.length" :list="certificates" :interpretations="certificateColumns"
				v-model:selected-index="selectedIndex" label="Certificates" min-width="28.5rem" selectable spacer></property-grid>
		</div>
		<template v-if="selectedCertificate">
			<p v-if="'$error' in selectedCertificate" class="view-security__note">Unable to read certificate entry ({{ selectedCertificate.$error }}).</p>
			<security-certificate v-else :key="selectedIndex" :certificate="selectedCertificate" :entry-number="selectedIndex + 1"></security-certificate>
		</template>
		<p v-else class="view-security__note">No certificates.</p>
	</section>
</template>

<style>
.view-security { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.view-security__tables { min-height: 0; max-height: 50%; overflow: auto; overscroll-behavior: contain; }
.view-security__tables:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.view-security__note { margin: 12px var(--workspace-gutter); color: var(--color-muted); font-size: 13px; }
</style>

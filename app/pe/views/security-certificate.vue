<link rel="component" href="../../components/property-grid.vue">

<script>
const securityCertificateFormats = /** @type {Partial<Record<number, string>>} */ ({
	0x0001: 'X.509 certificate',
	0x0002: 'Authenticode PKCS#7 SignedData',
});

const SecurityCertificate = Vue.defineComponent({
	template: '#security-certificate',
	props: {
		certificate: { type: Object, required: true },
		entryNumber: { type: Number, required: true },
	},
	data() {
		return {
			columns: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', style: { minWidth: '160px' }, format: (value, field) => String(field) },
				{ title: 'Value', style: { minWidth: '120px' }, format: formatPropertyGridHex },
			]),
			copyStatus: '',
		};
	},
	computed: {
		entry() { return /** @type {import('./deps/pelite.js').PeCertificate} */ (/** @type {unknown} */ (this.certificate)); },
		payloadTitle() {
			const format = securityCertificateFormats[this.entry.image.wCertificateType];
			return format ? `${format} (ASN.1 DER, Base64-encoded)` : 'Certificate payload (Base64-encoded)';
		},
	},
	methods: {
		async copyPayload() {
			this.copyStatus = '';
			try {
				await navigator.clipboard.writeText(this.entry.payload);
				this.copyStatus = 'Copied.';
			} catch {
				const payload = this.$refs.payload;
				if (payload instanceof HTMLTextAreaElement) {
					payload.focus();
					payload.select();
				}
				this.copyStatus = 'Clipboard unavailable. Use your copy shortcut to copy the selected text.';
			}
		},
	},
});
</script>

<template id="security-certificate">
	<div>
		<property-grid :list="entry.image" :interpretations="columns" :label="'Certificate ' + entryNumber + ' header'"></property-grid>
		<div class="security-certificate__payload-header">
			<h3>{{ payloadTitle }}</h3>
			<button v-if="entry.payload" type="button" :aria-label="'Copy text for certificate ' + entryNumber" @click="copyPayload">Copy text</button>
		</div>
		<template v-if="entry.payload">
			<textarea ref="payload" class="security-certificate__payload" :aria-label="'Certificate ' + entryNumber + ' payload (Base64-encoded)'"
				readonly spellcheck="false" :value="entry.payload"></textarea>
			<p class="security-certificate__copy-status" role="status">{{ copyStatus }}</p>
		</template>
		<p v-else class="security-certificate__note">The certificate payload is empty.</p>
	</div>
</template>

<style>
.security-certificate__payload-header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 16px 0 8px; }
.security-certificate__payload-header h3 { margin: 0; font-size: 13px; font-weight: 600; }
.security-certificate__payload-header button { padding: 5px 9px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); color: var(--color-text); font-size: 12px; cursor: pointer; }
.security-certificate__payload-header button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.security-certificate__payload { display: block; width: min(100%, 560px); min-height: 90px; padding: 8px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); color: var(--color-text); font: 12px ui-monospace, SFMono-Regular, Consolas, monospace; resize: vertical; }
.security-certificate__note { margin: 0 0 12px; color: var(--color-muted); font-size: 13px; }
.security-certificate__copy-status { margin: 8px 0 0; color: var(--color-muted); font-size: 13px; }
.security-certificate__copy-status:empty { margin: 0; }
</style>

<link rel="component" href="../../components/property-grid.vue">

<script>
/** @typedef {import('./deps/asn1js/asn1.js').ASN1} CertificateNode */

const securityCertificateFormats = /** @type {Partial<Record<number, { title: string, extension: string, schema: string }>>} */ ({
	0x0001: { title: 'X.509 certificate', extension: 'cer', schema: 'Certificate' },
	0x0002: { title: 'Authenticode PKCS#7 SignedData', extension: 'p7b', schema: 'ContentInfo' },
});

/** @param {CertificateNode | undefined} parent @param {string} id */
function certificateField(parent, id) {
	return parent?.sub?.find(node => !node.def?.mismatch && node.def?.id?.split(' ')[0] === id);
}

/** @param {CertificateNode | undefined} node */
function formatCertificateValue(node) {
	const value = node?.content(96)?.trim() ?? '';
	if (node?.typeName() === 'OBJECT_IDENTIFIER') {
		const [oid, name] = value.split('\n');
		return name ? `${name} (${oid})` : oid;
	}
	const text = value.replaceAll('\n', ' ');
	return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

/** @param {CertificateNode | undefined} node */
function formatCertificateName(node) {
	const abbreviations = /** @type {Partial<Record<string, string>>} */ ({
		commonName: 'CN', organizationName: 'O', organizationalUnitName: 'OU',
		countryName: 'C', stateOrProvinceName: 'ST', localityName: 'L',
	});
	const attributes = node?.sub?.flatMap(set => set.sub ?? []) ?? [];
	return attributes.flatMap(attribute => {
		const [type, value] = attribute.sub ?? [];
		if (!type || !value) return [];
		const [oid, name = oid] = type.content(96)?.split('\n') ?? [];
		return oid ? [`${abbreviations[name] ?? name}=${formatCertificateValue(value)}`] : [];
	}).join(', ');
}

/** @param {CertificateNode} certificate */
function certificateSummary(certificate) {
	const fields = certificateField(certificate, 'tbsCertificate');
	if (!fields) return [];
	const validity = certificateField(fields, 'validity');
	const algorithm = certificateField(certificateField(certificate, 'signatureAlgorithm'), 'algorithm');
	return [
		['Subject', formatCertificateName(certificateField(fields, 'subject'))],
		['Issuer', formatCertificateName(certificateField(fields, 'issuer'))],
		['Valid from', formatCertificateValue(certificateField(validity, 'notBefore'))],
		['Valid until', formatCertificateValue(certificateField(validity, 'notAfter'))],
		['Signature algorithm', formatCertificateValue(algorithm)],
	].flatMap(([label, value]) => value ? [`${label}: ${value}`] : []);
}

/** @param {CertificateNode} root */
function signedDataSummary(root) {
	const signedData = certificateField(root, 'content')?.sub?.find(node => node.def?.name === 'SignedData');
	if (!signedData) return [];
	const digests = certificateField(signedData, 'digestAlgorithms')?.sub ?? [];
	const algorithms = digests.map(node => formatCertificateValue(certificateField(node, 'algorithm'))).filter(Boolean);
	const signers = certificateField(signedData, 'signerInfos')?.sub;
	const certificates = signedData.sub?.find(node => node.def?.name === 'CertificateSet')?.sub ?? [];
	const summaries = certificates.map(certificateSummary).filter(lines => lines.length);
	const lines = [];
	if (algorithms.length) lines.push(`Digest algorithms: ${algorithms.join(', ')}`);
	if (signers) lines.push(`Signer entries: ${signers.length}`);
	lines.push(`Embedded X.509 certificates: ${summaries.length}`);
	for (const [index, summary] of summaries.entries()) lines.push('', `Certificate ${index + 1}`, ...summary.map(line => `  ${line}`));
	return lines;
}

/** @param {CertificateNode} node @param {string[]} lines @param {string} indent */
function appendCertificateDetails(node, lines, indent = '') {
	const definition = node.def?.mismatch ? undefined : node.def;
	const name = definition?.id?.split(' ')[0] || definition?.name || node.typeName();
	const label = name.replaceAll('_', ' ').replace(/([a-z\d])([A-Z])/g, '$1 $2');
	const value = node.sub === null ? formatCertificateValue(node) : '';
	lines.push(`${indent}${label[0].toUpperCase()}${label.slice(1)}${value ? `: ${value}` : ''}`);
	for (const child of node.sub ?? []) appendCertificateDetails(child, lines, indent + '  ');
}

/** @param {Uint8Array} bytes @returns {string} */
function certificateHexPreview(bytes) {
	const preview = bytes.subarray(0, 4096);
	const lines = [];
	for (let offset = 0; offset < preview.length; offset += 16) {
		const hex = Array.from(preview.subarray(offset, offset + 16), byte => byte.toString(16).padStart(2, '0')).join(' ');
		lines.push(`${offset.toString(16).padStart(4, '0')}  ${hex}`);
	}
	if (preview.length < bytes.length) lines.push(`… ${bytes.length - preview.length} more bytes`);
	return lines.join('\n');
}

const SecurityCertificate = Vue.defineComponent({
	template: '#security-certificate',
	props: {
		certificate: { type: Object, required: true },
		entryNumber: { type: Number, required: true },
	},
	data() {
		return {
			columns: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', width: 'clamp(9rem, 26cqi, 11.25rem)', format: (value, field) => String(field) },
				{ title: 'Value', format: formatPropertyGridHex },
			]),
			presentation: '',
			copyStatus: '',
		};
	},
	computed: {
		entry() { return /** @type {PeLite.PeCertificate} */ (/** @type {unknown} */ (this.certificate)); },
		format() { return securityCertificateFormats[this.entry.image.wCertificateType]; },
		bytes() { return Uint8Array.from(atob(this.entry.payload), char => char.charCodeAt(0)); },
	},
	async mounted() {
		const bytes = this.bytes;
		if (!bytes.length) return;
		if (!this.format) {
			this.presentation = `Unsupported certificate type. Hex preview:\n\n${certificateHexPreview(bytes)}`;
			return;
		}
		try {
			// Load the vendored @lapo/asn1js 2.1.3 when the certificate view needs it.
			const [{ ASN1 }, { Defs }] = await Promise.all([import('./deps/asn1js/asn1.js'), import('./deps/asn1js/defs.js')]);
			const root = ASN1.decode(bytes);
			if (root.typeName() !== 'SEQUENCE') throw new Error('Expected an ASN.1 SEQUENCE.');
			try {
				Defs.match(root, Defs.searchType(this.format.schema));
			} catch { /* The decoded tree can still be displayed with its ASN.1 types. */ }
			const lines = this.format.schema === 'Certificate' ? certificateSummary(root) : signedDataSummary(root);
			if (lines.length) lines.push('', 'ASN.1 details', '');
			appendCertificateDetails(root, lines);
			this.presentation = lines.join('\n');
			const trailing = bytes.subarray(root.posEnd());
			if (trailing.length) {
				this.presentation += trailing.length <= 7 && trailing.every(byte => byte === 0)
					? `\n\nTrailing zero padding: ${trailing.length} byte(s).`
					: `\n\nTrailing bytes at offset 0x${root.posEnd().toString(16)}:\n${certificateHexPreview(trailing)}`;
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.presentation = `Unable to decode ASN.1: ${message}\n\nHex preview:\n${certificateHexPreview(bytes)}`;
		}
	},
	methods: {
		async copyPayload() {
			const payload = this.$refs.payload;
			if (!(payload instanceof HTMLTextAreaElement)) return;
			this.copyStatus = '';
			try {
				await navigator.clipboard.writeText(payload.value);
				this.copyStatus = 'Copied.';
			} catch {
				payload.focus();
				payload.select();
				this.copyStatus = 'Clipboard unavailable. Use your copy shortcut to copy the selected text.';
			}
		},
		saveCertificate() {
			const url = URL.createObjectURL(new Blob([this.bytes], { type: 'application/octet-stream' }));
			const link = document.createElement('a');
			link.href = url;
			link.download = `certificate-${this.entryNumber}.${this.format?.extension ?? 'bin'}`;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		},
	},
});
</script>

<template id="security-certificate">
	<div>
		<property-grid :list="entry.image" :interpretations="columns" :label="'Certificate ' + entryNumber + ' WIN_CERTIFICATE header'"></property-grid>
		<div class="security-certificate__body">
			<div class="security-certificate__payload-header">
				<h3>{{ format?.title ?? 'Certificate payload' }} <span v-if="format" class="security-certificate__encoding">ASN.1</span></h3>
				<div class="security-certificate__actions">
					<button type="button" :aria-label="'Copy text for certificate ' + entryNumber" :disabled="!presentation" @click="copyPayload">Copy text</button>
					<button type="button" :aria-label="'Save certificate ' + entryNumber" :disabled="!entry.payload" @click="saveCertificate">Save certificate</button>
				</div>
			</div>
			<template v-if="presentation">
				<textarea ref="payload" class="security-certificate__payload" :aria-label="'Certificate ' + entryNumber + ' text'"
					readonly spellcheck="false" :value="presentation"></textarea>
				<p class="security-certificate__copy-status" role="status">{{ copyStatus }}</p>
			</template>
			<p v-else-if="entry.payload" class="security-certificate__note" role="status">Decoding certificate…</p>
			<p v-else class="security-certificate__note">The certificate payload is empty.</p>
		</div>
	</div>
</template>

<style>
.security-certificate__body { padding: 12px var(--certificate-inline-padding, 12px); }
.security-certificate__payload-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; margin-bottom: 8px; }
.security-certificate__payload-header h3 { margin: 0; font-size: 13px; font-weight: 600; }
.security-certificate__encoding { display: inline-block; margin-inline-start: 4px; padding: 0 5px; border: 1px solid color-mix(in srgb, var(--color-accent) 55%, var(--color-border)); border-radius: 3px; color: var(--color-accent); font: 11px ui-monospace, SFMono-Regular, Consolas, monospace; }
.security-certificate__actions { display: flex; flex-wrap: wrap; gap: 4px; }
.security-certificate__actions button { padding: 4px 8px; border: 0; border-radius: 4px; background: transparent; color: var(--color-muted); font-size: 12px; }
.security-certificate__actions button:hover:enabled { background: var(--color-surface); color: var(--color-text); cursor: pointer; }
.security-certificate__actions button:disabled { opacity: 0.55; }
.security-certificate__actions button:focus-visible, .security-certificate__payload:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.security-certificate__payload { display: block; inline-size: 100%; height: min(38dvh, 20rem); min-height: 12rem; padding: 12px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-background); color: var(--color-text); font: 12px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; resize: vertical; }
.security-certificate__note { margin: 0; color: var(--color-muted); font-size: 13px; }
.security-certificate__copy-status { margin: 8px 0 0; color: var(--color-muted); font-size: 13px; }
.security-certificate__copy-status:empty { margin: 0; }
</style>

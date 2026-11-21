<link rel="component" href="../../components/property-grid.vue">
<link rel="component" href="section-headers.vue">

<script>
/** @param {unknown} value @returns {string} */
function formatNtHeaderValue(value) {
	if (value == null) return '';
	if (typeof value === 'number') return value === 0 ? '0' : `0x${value.toString(16)}`;
	if (Array.isArray(value)) return value.map(formatNtHeaderValue).join('\n');
	return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** @param {string} table @param {Record<string, unknown>} details @returns {PropertyGridColumn[]} */
function ntHeaderInterpretations(table, details) {
	const addresses = /** @type {Partial<Record<string, string>>} */ (table === 'OptionalHeader'
		? { ImageBase: 'va', AddressOfEntryPoint: 'rva', BaseOfCode: 'rva', BaseOfData: 'rva' }
		: table === 'FileHeader' ? { PointerToSymbolTable: 'fo' } : {});
	return [
		{ title: 'Field', width: '13.5rem', format: (value, name) => String(name) },
		{ title: 'Value', kind: (value, field) => value !== 0 || field === 'ImageBase' ? addresses[field] : undefined,
			width: '10rem', style: { textAlign: 'right' }, format: formatNtHeaderValue },
		{ title: 'Interpretation', format: (value, name) => {
			if (table === 'FileHeader' && name === 'TimeDateStamp') {
				const timestamp = Number(value);
				if (timestamp === 0 || timestamp === 0xffffffff) return 'Unspecified';
				return new Date(timestamp * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
			}
			return formatNtHeaderValue(details[`${table}.${name}`]);
		} },
	];
}

/** @param {PeDocument} context @returns {ViewContent} */
function prepareNtHeadersView(context) {
	const result = context.peFile.headers();
	if (result instanceof Error) throw result;
	const headers = result;
	return {
		component: 'view-nt-headers',
		data: {
			header: headers.NtHeaders,
			dataDirectory: headers.DataDirectory,
			directoryNames: headers.details['DataDirectory.Names'],
			details: headers.details,
			sections: prepareSectionHeadersView(context, headers).data,
		},
	};
}

const ViewNtHeaders = Vue.defineComponent({
	template: '#view-nt-headers',
	props: { data: { type: Object, required: true } },
	computed: {
		signatureInterpretations() {
			return ntHeaderInterpretations('NtHeaders', /** @type {Record<string, unknown>} */ (this.data.details));
		},
		fileInterpretations() {
			return ntHeaderInterpretations('FileHeader', /** @type {Record<string, unknown>} */ (this.data.details));
		},
		optionalInterpretations() {
			return ntHeaderInterpretations('OptionalHeader', /** @type {Record<string, unknown>} */ (this.data.details));
		},
		/** @returns {PropertyGridColumn[]} */
		directoryInterpretations() {
			const names = /** @type {(string | null)[]} */ (this.data.directoryNames);
			return [
				{ title: '#', width: '3.75rem', style: { textAlign: 'right' }, format: (value, index) => String(index) },
				{ title: 'Directory', width: 'clamp(6.5rem, 100cqi - 17.75rem, 22rem)', format: (value, index) => names[Number(index)] ?? '—' },
				{ title: 'VirtualAddress', width: '8rem', kind: (value, index) => {
					const directory = /** @type {PeLite.PeDataDirectory} */ (value);
					const slot = Number(index);
					if (directory.VirtualAddress === 0 || slot === 7 || slot >= 15) return undefined;
					return slot === 4 ? 'fo' : 'rva';
				}, style: { textAlign: 'right' }, format: value => formatNtHeaderValue((/** @type {PeLite.PeDataDirectory} */ (value)).VirtualAddress) },
				{ title: 'Size', width: '6rem', style: { textAlign: 'right' }, format: value => formatNtHeaderValue((/** @type {PeLite.PeDataDirectory} */ (value)).Size) },
			];
		},
	},
});
</script>

<template id="view-nt-headers">
	<section class="view-nt-headers">
		<p class="view-nt-headers__description">IMAGE_NT_HEADERS</p>
		<property-grid :list="{ Signature: data.header.Signature }" :interpretations="signatureInterpretations" min-width="31rem" label="NT signature"></property-grid>
		<h2 class="view-nt-headers__section-title">File header</h2>
		<property-grid :list="data.header.FileHeader" :interpretations="fileInterpretations" min-width="31rem" label="NT file header"></property-grid>
		<h2 class="view-nt-headers__section-title">Optional header</h2>
		<property-grid :list="data.header.OptionalHeader" :interpretations="optionalInterpretations" min-width="31rem" label="NT optional header"></property-grid>
		<h2 class="view-nt-headers__section-title">Data directory</h2>
		<property-grid v-if="data.dataDirectory.length" :list="data.dataDirectory" :interpretations="directoryInterpretations" min-width="24.25rem" label="Data directory" spacer></property-grid>
		<p v-else class="view-nt-headers__description">No data directories.</p>
		<h2 class="view-nt-headers__section-title">Section headers</h2>
		<view-section-headers :data="data.sections"></view-section-headers>
	</section>
</template>

<style>
.view-nt-headers__description { margin: 0 0 26px; color: var(--color-muted); font-size: 13px; }
.view-nt-headers__section-title { margin: 26px 0 12px; font-size: 14px; font-weight: 600; }
</style>

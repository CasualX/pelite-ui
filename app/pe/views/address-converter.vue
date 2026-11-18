<link rel="component" href="../address.vue.js">

<script>
/** @typedef {WorkspaceAddressValue['kind']} AddressConverterKind */
/** @typedef {{ document: PeDocument, imageSize: number }} AddressConverterData */
/** @typedef {{ values: Record<AddressConverterKind, string>, invalid: boolean }} AddressConversion */

/** @param {PeDocument} document @returns {ViewContent} */
function prepareAddressConverterView(document) {
	const header = document.peFile.optionalHeader();
	if (header instanceof Error) throw header;
	return { component: 'view-address-converter', data: { document, imageSize: header.SizeOfImage } };
}

const addressConverterFields = /** @type {{ kind: AddressConverterKind, label: string }[]} */ ([
	{ kind: 'rva', label: 'RVA' },
	{ kind: 'va', label: 'VA' },
	{ kind: 'fo', label: 'File Offset' },
]);

const ViewAddressConverter = Vue.defineComponent({
	template: '#view-address-converter',
	props: { data: { type: Object, required: true } },
	data() {
		return {
			fields: addressConverterFields,
			source: /** @type {AddressConverterKind} */ ('rva'),
			input: '',
		};
	},
	computed: {
		converterData() { return /** @type {AddressConverterData} */ (/** @type {unknown} */ (this.data)); },
		/** @returns {AddressConversion} */
		conversion() {
			const { source, input } = this;
			const values = { rva: '', va: '', fo: '', [source]: input };
			const text = input.trim();
			if (!text) return { values, invalid: false };

			const invalid = { values, invalid: true };
			const { document, imageSize } = this.converterData;
			try {
				if (!/^(?:0x[\da-f]+|\d+)$/i.test(text)) return invalid;
				const value = BigInt(text);
				if (value > (source === 'va' ? 0xffffffffffffffffn : 0xffffffffn)) return invalid;
				if (source === 'fo' && value >= BigInt(document.file.size)) return invalid;

				const peFile = document.peFile;
				// Pelite treats VA zero as a null pointer, even for an image based at zero.
				const rva = source === 'va' && value === 0n && peFile.rvaToVa(0) === 0n
					? 0 : workspaceAddressToRva(document, { kind: source, value });
				if (rva >= imageSize) return invalid;

				const va = source === 'va' ? value : peFile.rvaToVa(rva);
				const fo = source === 'fo' ? Number(value) : peFile.rvaToFileOffset(rva);
				if (source !== 'rva') values.rva = `0x${rva.toString(16)}`;
				if (source !== 'va' && !(va instanceof Error)) values.va = `0x${va.toString(16)}`;
				if (source !== 'fo' && !(fo instanceof Error) && fo < document.file.size) values.fo = `0x${fo.toString(16)}`;
				return { values, invalid: false };
			} catch {
				return invalid;
			}
		},
	},
	methods: {
		/** @param {AddressConverterKind} kind @param {Event} event */
		edit(kind, event) {
			const field = /** @type {HTMLInputElement} */ (event.target);
			this.source = kind;
			this.input = field.value;
		},
	},
});
</script>

<template id="view-address-converter">
	<section class="view-address-converter" aria-label="Address Converter">
		<label v-for="field in fields" :key="field.kind" class="view-address-converter__field">
			<span>{{ field.label }}</span>
			<input type="text" :value="conversion.values[field.kind]"
				:aria-invalid="source === field.kind && conversion.invalid ? 'true' : undefined"
				autocomplete="off" autocapitalize="off" spellcheck="false" @input="edit(field.kind, $event)">
		</label>
	</section>
</template>

<style>
.view-address-converter { display: grid; gap: 6px; max-inline-size: 19rem; }
.view-address-converter__field { display: grid; grid-template-columns: 4rem minmax(0, 1fr); align-items: center; gap: 8px; font-size: 12px; }
.view-address-converter__field input { width: 100%; min-width: 0; height: 30px; padding: 5px 8px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); color: var(--color-text); font: 12px ui-monospace, SFMono-Regular, Consolas, monospace; }
.view-address-converter__field input:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
.view-address-converter__field input[aria-invalid="true"] { border-color: var(--color-danger); }
</style>

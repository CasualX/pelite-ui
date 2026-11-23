<link rel="component" href="../address.vue.js">

<script>
/** @typedef {WorkspaceAddressValue['kind']} AddressConverterKind */
/** @typedef {{ kind: AddressConverterKind, text: string }} AddressConverterInput */
/** @typedef {{ document: PeDocument, imageSize: number, input: AddressConverterInput }} AddressConverterData */
/** @typedef {{ values: Record<AddressConverterKind, string>, invalid: boolean }} AddressConversion */

/** @param {PeDocument} document @param {unknown} [data] @returns {ViewContent} */
function prepareAddressConverterView(document, data) {
	const header = document.peFile.optionalHeader();
	if (header instanceof Error) throw header;
	const address = /** @type {AddressConverterInput | undefined} */ (data);
	const input = { kind: address?.kind ?? 'rva', text: address?.text ?? '' };
	return {
		component: 'view-address-converter',
		data: { document, imageSize: header.SizeOfImage, input },
		preferredWindowSize: { width: 260, height: 171 },
	};
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
		};
	},
	computed: {
		converterData() { return /** @type {AddressConverterData} */ (/** @type {unknown} */ (this.data)); },
		/** @returns {AddressConversion} */
		conversion() {
			const { document, imageSize, input } = this.converterData;
			const { kind: source, text: inputText } = input;
			const values = { rva: '', va: '', fo: '', [source]: inputText };
			const text = inputText.trim();
			if (!text) return { values, invalid: false };

			const invalid = { values, invalid: true };
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
			this.converterData.input = { kind, text: field.value };
		},
	},
});
</script>

<template id="view-address-converter">
	<section class="view-address-converter" aria-label="Address Converter">
		<label v-for="field in fields" :key="field.kind" class="view-address-converter__field">
			<span>{{ field.label }}</span>
			<input type="text" :value="conversion.values[field.kind]"
				:data-kind="!conversion.invalid && conversion.values[field.kind] ? field.kind : undefined"
				:aria-invalid="converterData.input.kind === field.kind && conversion.invalid ? 'true' : undefined"
				autocomplete="off" autocapitalize="off" spellcheck="false" @input="edit(field.kind, $event)">
		</label>
	</section>
</template>

<style>
.view-address-converter { display: grid; gap: 6px; max-width: 19rem; padding: 16px; }
.view-address-converter__field { display: grid; grid-template-columns: 4rem minmax(0, 1fr); align-items: center; gap: 8px; font-size: 12px; }
.view-address-converter__field input { width: 100%; min-width: 0; height: 30px; padding: 5px 8px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); color: var(--color-text); font: 12px ui-monospace, SFMono-Regular, Consolas, monospace; }
.view-address-converter__field input:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
.view-address-converter__field input[aria-invalid="true"] { border-color: var(--color-danger); }
</style>

<link rel="component" href="../address.vue.js">

<script>
/** @typedef {{ rva: number, section: string, bytes: string, instruction: string }} DisasmRow */
/** @typedef {{ document: PeDocument, headers: import('./deps/pelite.js').PeHeaders, state: { rows: DisasmRow[], requestedRva: number, cursor: number, address: string, error: string | undefined } }} DisasmViewData */

/** @param {PeDocument} context @returns {boolean} */
function isDisasmAvailable(context) {
	const header = context.peFile.fileHeader();
	return !(header instanceof Error) && [0x14c, 0x8664].includes(header.Machine);
}

/** @param {PeDocument} openedDocument @param {import('./deps/pelite.js').PeHeaders} headers @param {number} rva @returns {DisasmRow[]} */
function readDisasmWindow(openedDocument, headers, rva) {
	const imageSize = headers.NtHeaders.OptionalHeader.SizeOfImage;
	if (!Number.isInteger(rva) || rva < 0 || rva >= imageSize) throw new Error('RVA must be inside the virtual image.');
	const bytes = openedDocument.peFile.sliceBytes(rva);
	if (bytes instanceof Error) throw bytes;
	// Start exactly at the requested instruction: x86 has no fixed alignment,
	// so decoding from an arbitrary earlier byte can change all boundaries.
	const end = Math.min(rva + 0x1000, rva + bytes.length, imageSize);
	const instructions = openedDocument.peFile.disasm(rva, end);
	if (instructions instanceof Error) throw instructions;
	let address = rva;
	return instructions.map(instruction => {
		const rva = address;
		address += instruction.bytes.length;
		const section = headers.SectionHeaders.find(section => rva >= section.VirtualAddress && rva < section.VirtualAddress + section.VirtualSize);
		return { rva, section: section?.Name ?? (rva < headers.NtHeaders.OptionalHeader.SizeOfHeaders ? 'Headers' : '—'), bytes: instruction.bytes.map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' '), instruction: instruction.instruction };
	});
}

/** @param {PeDocument} context @param {unknown} [data] @returns {ViewContent} */
function prepareDisasmView(context, data) {
	const headers = context.peFile.headers();
	if (headers instanceof Error) throw headers;
	const options = /** @type {{ rva?: number, address?: WorkspaceAddressValue } | undefined} */ (data);
	const rva = options?.address ? workspaceAddressToRva(context, options.address) : options?.rva ?? headers.NtHeaders.OptionalHeader.AddressOfEntryPoint;
	const rows = readDisasmWindow(context, headers, rva);
	const state = { rows, requestedRva: rva, cursor: rva, address: `0x${rva.toString(16)}`, error: /** @type {string | undefined} */ (undefined) };
	return { component: 'view-disasm', data: { document: context, headers, state },
		get titleSuffix() { const data = /** @type {DisasmViewData} */ (/** @type {unknown} */ (this.data)); return `0x${data.state.requestedRva.toString(16)}`; },
		get duplicateData() { return { rva: state.requestedRva }; },
	};
}

const ViewDisasm = Vue.defineComponent({
	template: '#view-disasm',
	props: { data: { type: Object, required: true } },
	computed: {
		disasmData() { return /** @type {DisasmViewData} */ (/** @type {unknown} */ (this.data)); },
		state() { return this.disasmData.state; },
	},
	methods: {
		/** @param {number} rva */
		hex(rva) { return `0x${rva.toString(16).padStart(8, '0')}`; },
		go() {
			const text = this.state.address.trim();
			if (!/^(?:0x[\da-f]+|\d+)$/i.test(text)) {
				this.state.error = 'Enter an RVA in decimal or 0xhex.';
				return;
			}
			if (this.loadWindow(Number(text))) this.$nextTick(() => this.scrollToCursor());
		},
		/** @param {number} rva */
		loadWindow(rva) {
			try {
				const rows = readDisasmWindow(this.disasmData.document, this.disasmData.headers, rva);
				this.state.rows = rows;
				this.state.requestedRva = rva;
				this.state.cursor = rva;
				this.state.error = undefined;
				return true;
			} catch (error) {
				this.state.error = error instanceof Error ? error.message : String(error);
				return false;
			}
		},
		selectionChanged() {
			if (!this.$refs.dump.contains(document.activeElement)) return;
			const selection = document.getSelection();
			const node = selection?.focusNode;
			const element = node instanceof Element ? node : node?.parentElement;
			const row = element?.closest('[data-rva]');
			if (!row || !this.$refs.dump.contains(row)) return;
			this.state.cursor = Number(row.getAttribute('data-rva'));
		},
		recenter() {
			const selection = document.getSelection();
			if (!selection) return;
			/** @param {Node | null} node @param {number} offset */
			const capture = (node, offset) => {
				const element = node instanceof Element ? node : node?.parentElement;
				const column = element?.closest('.view-disasm__bytes, .view-disasm__instruction');
				const row = column?.parentElement;
				if (!node || !column || !row || !this.$refs.dump.contains(row)) return;
				const range = document.createRange();
				range.selectNodeContents(column);
				range.setEnd(node, offset);
				return { rva: Number(row.dataset.rva), column: column.className, offset: range.toString().length };
			};
			const anchor = capture(selection.anchorNode, selection.anchorOffset), focus = capture(selection.focusNode, selection.focusOffset);
			if (!focus || !this.loadWindow(focus.rva)) return;
			this.state.address = `0x${focus.rva.toString(16)}`;
			this.$nextTick(() => {
				/** @param {ReturnType<typeof capture>} point @returns {[Node, number] | undefined} */
				const restore = point => {
					if (!point) return;
					const column = this.$refs.dump.querySelector(`[data-rva="${point.rva}"] .${point.column}`);
					const text = column?.firstChild;
					if (text) return [text, Math.min(point.offset, text.textContent?.length ?? 0)];
				};
				const end = restore(focus), start = restore(anchor) ?? end;
				if (start && end) selection.setBaseAndExtent(...start, ...end);
				this.scrollToCursor(focus.column);
			});
		},
		/** @param {string} [column] */
		scrollToCursor(column = 'view-disasm__rva') {
			this.$refs.dump.querySelector(`[data-rva="${this.state.cursor}"] .${column}`)
				?.scrollIntoView({ block: 'start', inline: 'nearest' });
		},
	},
	mounted() { document.addEventListener('selectionchange', this.selectionChanged); },
	beforeUnmount() { document.removeEventListener('selectionchange', this.selectionChanged); },
});
</script>

<template id="view-disasm">
	<section class="view-disasm">
		<div class="view-disasm__body">
			<form class="view-disasm__toolbar" @submit.prevent="go">
				<label>RVA <input v-model="state.address" data-kind="rva" aria-label="Go to RVA" spellcheck="false" autocomplete="off"></label><button type="submit">Go</button>
			</form>
			<p v-if="state.error" class="view-disasm__error" role="alert">{{ state.error }}</p>
			<p class="view-disasm__help">Place the cursor in an instruction and press Enter to start decoding there.</p>
			<div class="view-disasm__grid">
				<div class="view-disasm__columns"><span>Section</span><span>RVA</span><span>Bytes</span><span>Instruction</span></div>
				<div ref="dump" class="view-disasm__dump" contenteditable="true" role="textbox" aria-label="Disassembly" aria-readonly="true" aria-multiline="true" spellcheck="false"
					@keydown.enter.prevent="recenter" @beforeinput.prevent @paste.prevent @drop.prevent>
					<div v-for="row in state.rows" :key="row.rva" :data-rva="row.rva" class="view-disasm__row">
						<span class="view-disasm__section" contenteditable="false" :title="row.section">{{ row.section }}</span>
						<span class="view-disasm__rva" data-kind="rva" contenteditable="false" :class="{ 'view-disasm__cursor': row.rva === state.cursor }">{{ hex(row.rva) }}</span>
						<span class="view-disasm__bytes">{{ row.bytes }}</span>
						<span class="view-disasm__instruction">{{ row.instruction }}</span>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>

<style>
.workspace-area__view:has(> .view-disasm) { --workspace-view-padding: 0; }
.view-disasm { --disasm-toolbar-height: 44px; container-type: inline-size; }
.view-disasm__body { --disasm-gutter: clamp(12px, 4cqi, 32px); min-inline-size: min-content; }
.view-disasm__toolbar { position: sticky; inset-block-start: 0; inset-inline-start: 0; z-index: 2; display: flex; align-items: center; gap: 12px; inline-size: 100cqi; height: var(--disasm-toolbar-height); padding-inline: var(--disasm-gutter); background: var(--color-background); font-size: 12px; }
.view-disasm__toolbar label { display: flex; align-items: center; gap: 8px; min-width: 0; }
.view-disasm__toolbar input { width: 140px; min-width: 0; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: 3px; background: var(--color-surface); color: var(--color-text); font-family: ui-monospace, monospace; }
.view-disasm__toolbar button { padding: 7px 14px; border: 1px solid var(--color-border); border-radius: 3px; background: var(--color-surface); color: var(--color-text); cursor: pointer; }
.view-disasm__toolbar button:hover { background: var(--color-border); }
.view-disasm__toolbar input:focus-visible, .view-disasm__toolbar button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
.view-disasm__help, .view-disasm__error { max-inline-size: calc(100cqi - 2 * var(--disasm-gutter)); margin: 0 var(--disasm-gutter) 12px; font-size: 12px; }
.view-disasm__help { color: var(--color-muted); }
.view-disasm__error { color: var(--color-danger); }
.view-disasm__grid { margin: 0 var(--disasm-gutter) 16px; border: 1px solid var(--color-border); font: 12px/22px ui-monospace, SFMono-Regular, Consolas, monospace; }
.view-disasm__columns, .view-disasm__row { display: grid; grid-template-columns: 8ch 10ch minmax(24ch, 44ch) minmax(30ch, 1fr); gap: 12px; padding-inline: 12px; }
.view-disasm__columns { position: sticky; top: var(--disasm-toolbar-height); z-index: 1; padding-block: 4px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-muted); white-space: pre; }
.view-disasm__row > span { scroll-margin-block-start: calc(var(--disasm-toolbar-height) + 31px); }
.view-disasm__dump:focus { outline: none; }
.view-disasm__dump { white-space: pre; cursor: text; caret-color: var(--color-text); }
.view-disasm__section { overflow: hidden; text-overflow: ellipsis; color: var(--color-muted); }
.view-disasm__rva, .view-disasm__bytes { color: var(--color-muted); }
.view-disasm__bytes, .view-disasm__instruction { white-space: pre-wrap; }
.view-disasm__instruction { overflow-wrap: anywhere; }
.view-disasm__cursor { position: relative; }
.view-disasm__cursor::before { content: ''; position: absolute; left: -3px; top: 4px; width: 1px; height: 14px; background: var(--color-accent); pointer-events: none; }

@container (width < 42rem) {
	.view-disasm__grid { font-size: 11px; }
	.view-disasm__columns, .view-disasm__row { gap: 8px; padding-inline: 8px; }
}
</style>

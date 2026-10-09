<link rel="component" href="../address.vue.js">

<script>
/** @typedef {{ rva: number, section: string, bytes: string, instruction: string }} DisasmRow */
/** @typedef {{ peFile: import('./deps/pelite.js').PeFile, headers: import('./deps/pelite.js').PeHeaders, state: { rows: DisasmRow[], cursor: number, address: string, error: string | undefined } }} DisasmViewData */

/** @param {ViewContext} context @returns {boolean} */
function isDisasmAvailable(context) {
	const header = context.peFile.fileHeader();
	return !(header instanceof Error) && [0x14c, 0x8664].includes(header.Machine);
}

/** @param {import('./deps/pelite.js').PeFile} peFile @param {import('./deps/pelite.js').PeHeaders} headers @param {number} rva @returns {DisasmRow[]} */
function readDisasmWindow(peFile, headers, rva) {
	const imageSize = headers.NtHeaders.OptionalHeader.SizeOfImage;
	if (!Number.isInteger(rva) || rva < 0 || rva >= imageSize) throw new Error('RVA must be inside the virtual image.');
	const bytes = peFile.sliceBytes(rva);
	if (bytes instanceof Error) throw bytes;
	// Start exactly at the requested instruction: x86 has no fixed alignment,
	// so decoding from an arbitrary earlier byte can change all boundaries.
	const end = Math.min(rva + 0x1000, rva + bytes.length, imageSize);
	const instructions = peFile.disasm(rva, end);
	if (instructions instanceof Error) throw instructions;
	let address = rva;
	return instructions.map(instruction => {
		const rva = address;
		address += instruction.bytes.length;
		const section = headers.SectionHeaders.find(section => rva >= section.VirtualAddress && rva < section.VirtualAddress + section.VirtualSize);
		return { rva, section: section?.Name ?? (rva < headers.NtHeaders.OptionalHeader.SizeOfHeaders ? 'Headers' : '—'), bytes: instruction.bytes.map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' '), instruction: instruction.instruction };
	});
}

/** @param {ViewContext} context @param {unknown} [data] @returns {ViewContent} */
function prepareDisasmView(context, data) {
	const headers = context.peFile.headers();
	if (headers instanceof Error) throw headers;
	const options = /** @type {{ rva?: number, address?: WorkspaceAddressValue } | undefined} */ (data);
	const rva = options?.address ? workspaceAddressToRva(context.peFile, options.address) : options?.rva ?? headers.NtHeaders.OptionalHeader.AddressOfEntryPoint;
	const rows = readDisasmWindow(context.peFile, headers, rva);
	const state = { rows, cursor: rva, address: `0x${rva.toString(16)}`, error: /** @type {string | undefined} */ (undefined) };
	return { component: 'view-disasm', data: { peFile: context.peFile, headers, state },
		get titleSuffix() { const data = /** @type {DisasmViewData} */ (/** @type {unknown} */ (this.data)); return `0x${data.state.cursor.toString(16)}`; },
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
			try {
				const text = this.state.address.trim();
				if (!/^(?:0x[\da-f]+|\d+)$/i.test(text)) throw new Error('Enter an RVA in decimal or 0xhex.');
				const rva = Number(text);
				const rows = readDisasmWindow(this.disasmData.peFile, this.disasmData.headers, rva);
				this.state.rows = rows;
				this.state.cursor = rva;
				this.state.error = undefined;
				this.$nextTick(() => { this.$refs.dump.scrollTop = 0; });
			} catch (error) { this.state.error = error instanceof Error ? error.message : String(error); }
		},
		selectionChanged() {
			if (!this.$refs.dump.contains(document.activeElement)) return;
			const selection = document.getSelection();
			const node = selection?.focusNode;
			const element = node instanceof Element ? node : node?.parentElement;
			const row = element?.closest('[data-rva]');
			if (!row || !this.$refs.dump.contains(row)) return;
			this.state.cursor = Number(row.getAttribute('data-rva'));
			this.state.address = `0x${this.state.cursor.toString(16)}`;
		},
		recenter() {
			const selection = document.getSelection();
			if (!selection) return;
			/** @param {Node | null} node @param {number} offset */
			const capture = (node, offset) => {
				const element = node instanceof Element ? node : node?.parentElement;
				const column = element?.closest('.view-disasm__bytes, .view-disasm__instruction');
				if (!node || !column || !this.$refs.dump.contains(column)) return;
				const range = document.createRange();
				range.selectNodeContents(column);
				range.setEnd(node, offset);
				return { rva: column.parentElement?.getAttribute('data-rva'), column: column.className, offset: range.toString().length };
			};
			const anchor = capture(selection.anchorNode, selection.anchorOffset), focus = capture(selection.focusNode, selection.focusOffset);
			if (!focus) return;
			this.selectionChanged();
			this.go();
			this.$nextTick(() => {
				/** @param {ReturnType<typeof capture>} point @returns {[Node, number] | undefined} */
				const restore = point => {
					if (!point) return;
					const column = this.$refs.dump.querySelector(`[data-rva="${point.rva}"] .${point.column}`);
					if (column?.firstChild) return [column.firstChild, point.offset];
				};
				const end = restore(focus), start = restore(anchor) ?? end;
				if (start && end) selection.setBaseAndExtent(...start, ...end);
				this.$refs.dump.scrollTop = 0;
			});
		},
	},
	mounted() { document.addEventListener('selectionchange', this.selectionChanged); },
	beforeUnmount() { document.removeEventListener('selectionchange', this.selectionChanged); },
});
</script>

<template id="view-disasm">
	<section class="view-disasm">
		<form class="view-disasm__toolbar" @submit.prevent="go">
			<label>RVA <input v-model="state.address" aria-label="Go to RVA" spellcheck="false" autocomplete="off"></label><button type="submit">Go</button>
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
	</section>
</template>

<style>
.view-disasm__toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; font-size: 12px; }
.view-disasm__toolbar label { display: flex; align-items: center; gap: 8px; }
.view-disasm__toolbar input { width: 140px; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: 3px; background: var(--color-surface); color: var(--color-text); font-family: ui-monospace, monospace; }
.view-disasm__toolbar button { padding: 7px 14px; border: 1px solid var(--color-border); border-radius: 3px; background: var(--color-surface); color: var(--color-text); cursor: pointer; }
.view-disasm__toolbar button:hover { background: var(--color-border); }
.view-disasm__help { margin: 0 0 20px; color: var(--color-muted); font-size: 12px; }
.view-disasm__error { color: var(--color-danger); font-size: 12px; }
.view-disasm__grid { border: 1px solid var(--color-border); font: 12px/22px ui-monospace, SFMono-Regular, Consolas, monospace; overflow-x: auto; }
.view-disasm__columns, .view-disasm__row { display: grid; grid-template-columns: 10ch 11ch 44ch minmax(50ch, 1fr); gap: 12px; padding: 0 12px; min-width: max-content; }
.view-disasm__columns { padding-top: 6px; padding-bottom: 6px; background: var(--color-surface); color: var(--color-muted); }
.view-disasm__dump:focus { outline: none; }
.view-disasm__dump { height: 704px; overflow-y: auto; cursor: text; white-space: pre; caret-color: var(--color-text); }
.view-disasm__section { overflow: hidden; text-overflow: ellipsis; color: var(--color-muted); }
.view-disasm__rva, .view-disasm__bytes { color: var(--color-muted); }
.view-disasm__cursor { position: relative; }
.view-disasm__cursor::before { content: ''; position: absolute; left: -3px; top: 4px; width: 1px; height: 14px; background: var(--color-accent); pointer-events: none; }
.view-disasm__toolbar input:focus-visible, .view-disasm__toolbar button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
</style>

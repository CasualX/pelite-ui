<link rel="component" href="../address.vue.js">

<script>
/** @typedef {{ start: number, anchor: number, bytes: Uint8Array, mask: Uint8Array }} HexDumpWindow */
/** @typedef {{ peFile: import('./deps/pelite.js').PeFile, headers: import('./deps/pelite.js').PeHeaders, state: { window: HexDumpWindow, cursor: number, address: string, format: 'decimal' | 'hex', error: string | undefined } }} HexDumpViewData */

/** @param {import('./deps/pelite.js').PeFile} peFile @param {number} imageSize @param {number} rva @returns {HexDumpWindow} */
function readHexDumpWindow(peFile, imageSize, rva) {
	if (!Number.isInteger(rva) || rva < 0 || rva >= imageSize) throw new Error('RVA must be inside the virtual image.');
	const anchor = Math.floor(rva / 16) * 16;
	const start = Math.max(0, anchor - 0x1000);
	const end = Math.min(imageSize, anchor + 0x1000);
	const length = end - start;
	const bytes = peFile.hexDumpBytes(start, length);
	if (bytes instanceof Error) throw bytes;
	const mask = peFile.hexDumpMask(start, length);
	if (mask instanceof Error) throw mask;
	return { start, anchor, bytes, mask };
}

/** @param {ViewContext} context @param {unknown} [data] @returns {ViewContent} */
function prepareHexDumpView(context, data) {
	const options = /** @type {{ rva?: number, address?: WorkspaceAddressValue } | undefined} */ (data);
	const rva = options?.address ? workspaceAddressToRva(context.peFile, options.address) : options?.rva ?? 0;
	const headers = context.peFile.headers();
	if (headers instanceof Error) throw headers;
	const window = readHexDumpWindow(context.peFile, headers.NtHeaders.OptionalHeader.SizeOfImage, rva);
	const state = { format: /** @type {'decimal' | 'hex'} */ ('decimal'), window, cursor: rva - window.start, address: `0x${rva.toString(16)}`, error: /** @type {string | undefined} */ (undefined) };
	return { component: 'view-hex-dump', data: { peFile: context.peFile, headers, state },
		get titleSuffix() { const data = /** @type {HexDumpViewData} */ (/** @type {unknown} */ (this.data)); return `0x${(data.state.window.start + data.state.cursor).toString(16)}`; },
	};
}

const ViewHexDump = Vue.defineComponent({
	template: '#view-hex-dump',
	props: { data: { type: Object, required: true } },
	computed: {
		dumpData() { return /** @type {HexDumpViewData} */ (/** @type {unknown} */ (this.data)); },
		state() { return this.dumpData.state; },
		instruction() {
			const offset = this.state.cursor;
			if (!this.backed(offset)) return new Error('No file-backed instruction bytes.');
			const result = this.dumpData.peFile.disasm(this.state.window.start + offset);
			if (result instanceof Error) return result;
			const instruction = result[0];
			if (instruction && (offset + instruction.bytes.length > this.state.window.bytes.length ||
				instruction.bytes.some((_, index) => !this.backed(offset + index)))) {
				return new Error('Instruction crosses zero-fill or the window boundary.');
			}
			return instruction;
		},
		rows() {
			const { start, bytes } = this.state.window;
			return Array.from({ length: Math.ceil(bytes.length / 16) }, (_, index) => {
				const offset = index * 16, rva = start + offset;
				const section = this.dumpData.headers.SectionHeaders.find(header => rva >= header.VirtualAddress && rva < header.VirtualAddress + header.VirtualSize);
				return { offset, rva, section: section?.Name ?? (rva < this.dumpData.headers.NtHeaders.OptionalHeader.SizeOfHeaders ? 'Headers' : '—'), offsets: Array.from({ length: Math.min(16, bytes.length - offset) }, (_, i) => offset + i) };
			});
		},
		interpretations() {
			const bytes = this.state.window.bytes, offset = this.state.cursor;
			const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
			const types = /** @type {[string, number, () => number | bigint][]} */ ([
				['i8', 1, () => view.getInt8(offset)], ['u8', 1, () => view.getUint8(offset)],
				['i16', 2, () => view.getInt16(offset, true)], ['u16', 2, () => view.getUint16(offset, true)],
				['i32', 4, () => view.getInt32(offset, true)], ['u32', 4, () => view.getUint32(offset, true)],
				['i64', 8, () => view.getBigInt64(offset, true)], ['u64', 8, () => view.getBigUint64(offset, true)],
				['f32', 4, () => view.getFloat32(offset, true)], ['f64', 8, () => view.getFloat64(offset, true)],
			]);
			const rows = types.map(([type, size, read]) => {
				const available = offset + size <= bytes.length && Array.from({ length: size }, (_, i) => this.backed(offset + i)).every(Boolean);
				if (!available) return { type, value: '—' };
				const value = read();
				if (this.state.format === 'decimal' || type.startsWith('f')) return { type, value: Object.is(value, -0) ? '-0' : String(value) };
				return { type, value: value < 0 ? `-0x${(-value).toString(16)}` : `0x${value.toString(16)}` };
			});
			const instruction = this.instruction;
			rows.push({ type: 'x86', value: instruction instanceof Error || !instruction || instruction.instruction === '(bad)' ? '-' : instruction.instruction });
			return rows;
		},
	},
	methods: {
		/** @param {number} rva @returns {string} */
		hex(rva) { return `0x${rva.toString(16).padStart(8, '0')}`; },
		/** @param {number} offset @returns {boolean} */
		backed(offset) { const mask = this.state.window.mask; return !!(mask[Math.floor(offset / 8)] & (1 << (offset % 8))); },
		/** @param {number} offset @returns {string} */
		byteText(offset) { return this.backed(offset) ? this.state.window.bytes[offset].toString(16).padStart(2, '0').toUpperCase() : '??'; },
		/** @param {number} offset @returns {string} */
		ascii(offset) { const byte = this.state.window.bytes[offset]; return !this.backed(offset) ? ' ' : byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'; },
		/** @param {number} offset @returns {string} */
		byteColor(offset) {
			if (!this.backed(offset)) return 'var(--color-muted)';
			const byte = this.state.window.bytes[offset];
			// Match pelite-cli's integer interpolation; invert RGB for a light canvas.
			const channels = [50, 62, 75].map(start => start + Math.floor((255 - start) * byte / 255));
			return `light-dark(rgb(${channels.map(value => 255 - value).join(' ')}), rgb(${channels.join(' ')}))`;
		},
		go() {
			try {
				const text = this.state.address.trim();
				if (!/^(?:0x[\da-f]+|\d+)$/i.test(text)) throw new Error('Enter an RVA in decimal or 0xhex.');
				const rva = Number(text);
				const window = readHexDumpWindow(this.dumpData.peFile, this.dumpData.headers.NtHeaders.OptionalHeader.SizeOfImage, rva);
				this.state.window = window;
				this.state.cursor = rva - window.start;
				this.state.error = undefined;
				this.$nextTick(() => this.scrollToCursor());
			} catch (error) { this.state.error = error instanceof Error ? error.message : String(error); }
		},
		recenter() {
			const selection = document.getSelection();
			if (!selection) return;
			// Store positions within the row text: Vue may replace the byte spans
			// when the loaded window shifts, but the RVA and text stay the same.
			/** @param {Node | null} node @param {number} offset */
			const capture = (node, offset) => {
				const element = node instanceof Element ? node : node?.parentElement;
				const column = element?.closest('.view-hex-dump__bytes, .view-hex-dump__ascii');
				if (!node || !column || !this.$refs.dump.contains(column)) return;
				const range = document.createRange();
				range.selectNodeContents(column);
				range.setEnd(node, offset);
				const byte = /** @type {Element} */ (column.querySelector('[data-offset]'));
				return { rva: this.state.window.start + Number(byte.getAttribute('data-offset')), ascii: column.classList.contains('view-hex-dump__ascii'), position: range.toString().length };
			};
			const anchor = capture(selection.anchorNode, selection.anchorOffset);
			const focus = capture(selection.focusNode, selection.focusOffset);
			if (!focus) return;
			this.selectionChanged();
			this.go();
			this.$nextTick(() => {
				/** @param {ReturnType<typeof capture>} point @returns {[Node, number] | undefined} */
				const restore = point => {
					if (!point) return;
					const column = this.$refs.dump.querySelector(`${point.ascii ? '.view-hex-dump__ascii' : '.view-hex-dump__bytes'} [data-offset="${point.rva - this.state.window.start}"]`)?.parentElement;
					if (!column) return;
					const walker = document.createTreeWalker(column, NodeFilter.SHOW_TEXT);
					let remaining = point.position;
					for (let node = walker.nextNode(); node; node = walker.nextNode()) {
						const length = /** @type {Text} */ (node).data.length;
						if (remaining <= length) return [node, remaining];
						remaining -= length;
					}
				};
				const end = restore(focus), start = restore(anchor) ?? end;
				if (start && end) selection.setBaseAndExtent(...start, ...end);
				this.scrollToCursor();
			});
		},
		scrollToCursor() {
			this.$refs.dump.scrollTop = Math.max(0, Math.floor(this.state.cursor / 16) * 22 - this.$refs.dump.clientHeight / 2);
		},
		/** @param {number} offset */
		updateCursor(offset) {
			this.state.cursor = offset;
			this.state.address = `0x${(this.state.window.start + offset).toString(16)}`;
		},
		selectionChanged() {
			if (!this.$refs.dump.contains(document.activeElement)) return;
			const selection = document.getSelection();
			const node = selection?.focusNode;
			if (!node || !selection) return;
			const element = node instanceof Element ? node : node.parentElement;
			const column = element?.closest('.view-hex-dump__bytes, .view-hex-dump__ascii');
			if (!column || !this.$refs.dump.contains(column)) return;
			const range = document.createRange();
			range.selectNodeContents(column);
			range.setEnd(node, selection.focusOffset);
			const position = range.toString().length;
			const bytes = column.querySelectorAll('[data-offset]');
			if (column.classList.contains('view-hex-dump__ascii')) {
				const byte = bytes[Math.min(position, bytes.length - 1)];
				if (byte) this.updateCursor(Number(byte.getAttribute('data-offset')));
				return;
			}
			let start = 0;
			for (const byte of bytes) {
				// The caret at the end of a byte belongs to that byte; after its space,
				// it belongs to the next one. Observe without modifying the Selection.
				if (position <= start + 2 || byte === bytes[bytes.length - 1]) {
					this.updateCursor(Number(byte.getAttribute('data-offset')));
					return;
				}
				start += byte.textContent?.length ?? 0;
			}
		},
	},
	mounted() { document.addEventListener('selectionchange', this.selectionChanged); this.scrollToCursor(); },
	beforeUnmount() { document.removeEventListener('selectionchange', this.selectionChanged); },
});
</script>

<template id="view-hex-dump">
	<section class="view-hex-dump">
		<form class="view-hex-dump__toolbar" @submit.prevent="go">
			<label>RVA <input v-model="state.address" aria-label="Go to RVA" spellcheck="false" autocomplete="off"></label><button type="submit">Go</button>
		</form>
		<p v-if="state.error" class="view-hex-dump__error" role="alert">{{ state.error }}</p>
		<p class="view-hex-dump__help">Place the cursor on a byte to interpret it. <code>??</code> marks zero-fill without file bytes.</p>
		<div class="view-hex-dump__layout">
			<div class="view-hex-dump__grid">
				<div class="view-hex-dump__columns"><span>Section</span><span>RVA</span><span>00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F</span><span>ASCII</span></div>
				<div ref="dump" class="view-hex-dump__dump" contenteditable="true" role="textbox" aria-label="Hex dump" aria-readonly="true" aria-multiline="true" spellcheck="false" @keydown.enter.prevent="recenter" @beforeinput.prevent @paste.prevent @drop.prevent>
					<div v-for="row in rows" :key="row.rva" class="view-hex-dump__row"><span class="view-hex-dump__section" contenteditable="false" :title="row.section">{{ row.section }}</span><span class="view-hex-dump__rva" data-kind="rva" contenteditable="false">{{ hex(row.rva) }}</span><span class="view-hex-dump__bytes"><span v-for="offset in row.offsets" :key="offset" :data-offset="offset" :style="{ '--hex-byte-color': byteColor(offset) }" class="view-hex-dump__value" :class="{ 'view-hex-dump__cursor': offset === state.cursor }">{{ byteText(offset) }}{{ offset === row.offsets[row.offsets.length - 1] ? '' : offset % 16 === 7 ? '  ' : ' ' }}</span></span><span class="view-hex-dump__ascii"><span v-for="offset in row.offsets" :key="offset" :data-offset="offset" :style="{ '--hex-byte-color': byteColor(offset) }" class="view-hex-dump__value">{{ ascii(offset) }}</span></span></div>
				</div>
			</div>
			<aside class="view-hex-dump__inspector" aria-label="Byte interpretations">
				<h2 data-kind="rva">{{ hex(state.window.start + state.cursor) }}</h2>
				<label class="view-hex-dump__format">Format <select v-model="state.format" aria-label="Interpretation format"><option value="decimal">Decimal</option><option value="hex">Hex</option></select></label>
				<dl><div v-for="item in interpretations.filter(item => item.type !== 'x86')" :key="item.type"><dt>{{ item.type }}</dt><dd>{{ item.value }}</dd></div></dl>
				<h2>Instruction</h2>
				<dl class="view-hex-dump__instruction-values"><div v-for="item in interpretations.filter(item => item.type === 'x86')" :key="item.type"><dt>{{ item.type }}</dt><dd>{{ item.value }}</dd></div></dl>
			</aside>
		</div>
	</section>
</template>

<style>
.view-hex-dump__toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; font-size: 12px; }
.view-hex-dump__toolbar label { display: flex; align-items: center; gap: 8px; }
.view-hex-dump__toolbar input { width: 140px; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: 3px; background: var(--color-surface); color: var(--color-text); font-family: ui-monospace, monospace; }
.view-hex-dump__toolbar button { padding: 7px 14px; border: 1px solid var(--color-border); border-radius: 3px; background: var(--color-surface); color: var(--color-text); cursor: pointer; }
.view-hex-dump__toolbar button:hover { background: var(--color-border); }
.view-hex-dump__help { color: var(--color-muted); }
.view-hex-dump__help { margin: 0 0 20px; font-size: 12px; }
.view-hex-dump__error { color: var(--color-danger); font-size: 12px; }
.view-hex-dump__layout { display: flex; align-items: flex-start; gap: 24px; max-width: 100%; overflow-x: auto; }
.view-hex-dump__grid { flex-shrink: 0; min-width: 0; border: 1px solid var(--color-border); font: 12px/22px ui-monospace, SFMono-Regular, Consolas, monospace; }
.view-hex-dump__columns, .view-hex-dump__row { display: grid; grid-template-columns: 10ch 11ch 49ch 16ch; gap: 12px; padding: 0 12px; width: max-content; }
.view-hex-dump__columns { padding-top: 6px; padding-bottom: 6px; background: var(--color-surface); color: var(--color-muted); font-size: 12px; }
.view-hex-dump__dump:focus { outline: none; }
.view-hex-dump__dump { height: 704px; overflow: auto; cursor: text; caret-color: var(--color-text); white-space: nowrap; }
.view-hex-dump__toolbar input:focus-visible, .view-hex-dump__toolbar button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
.view-hex-dump__section { overflow: hidden; text-overflow: ellipsis; color: var(--color-muted); }
.view-hex-dump__rva { color: var(--color-muted); }
.view-hex-dump__bytes, .view-hex-dump__ascii { white-space: pre; }
.view-hex-dump__value { color: var(--hex-byte-color); }
.view-hex-dump__cursor { position: relative; }
.view-hex-dump__cursor::before { content: ''; position: absolute; left: -2px; top: 1px; width: 1px; height: 14px; background: var(--color-accent); pointer-events: none; }
.view-hex-dump__inspector { width: 250px; flex-shrink: 0; font-size: 12px; }
.view-hex-dump__inspector h2 { margin: 0 0 8px; font: 600 13px ui-monospace, monospace; }
.view-hex-dump__inspector p { color: var(--color-muted); line-height: 1.6; }
.view-hex-dump__format { display: flex; align-items: center; gap: 12px; }
.view-hex-dump__format select { padding: 5px 8px; border: 1px solid var(--color-border); border-radius: 3px; background: var(--color-surface); color: var(--color-text); font: inherit; }
.view-hex-dump__format select:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
.view-hex-dump__inspector dl { margin: 16px 0; }
.view-hex-dump__inspector dl div { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--color-border); }
.view-hex-dump__inspector dl.view-hex-dump__instruction-values { margin: 0; }
.view-hex-dump__inspector dl.view-hex-dump__instruction-values div { border-bottom: 0; }
.view-hex-dump__inspector dt { color: var(--color-muted); }
.view-hex-dump__inspector dd { margin: 0; overflow-wrap: anywhere; font-family: ui-monospace, monospace; }
</style>

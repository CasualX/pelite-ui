/** @template T @param {T | Error} result @returns {T} */
function factsResult(result) { if (result instanceof Error) throw result; return result; }
/** @typedef {{ label: string, visible: boolean, text: string }} FactsLayer */
/** @typedef {{ layers: FactsLayer[], selected: number }} FactsSnapshot */
/** @typedef {{ index: number, layer: number, kind: string, rva: number, payload: string, text: string }} FactsRow */

const factKinds = [
	{ id: 'S', name: 'Symbol', example: 'Sx1000 code "entry"' },
	{ id: 'C', name: 'Comment', example: 'Cx1000 "Entry point"' },
	{ id: 'R', name: 'Reference', example: 'Rx1000 0x2000' },
	{ id: 'F', name: 'Function', example: 'Fx1000 {"bytes":32}' },
	{ id: 'D', name: 'Decode', example: 'Dx1000 x86_64 32' },
	{ id: 'A', name: 'Alignment', example: 'Ax100e 4' },
];

/** Owns native storage for one open image. UI caches contain canonical native output only. */
class FactsDatabase {
	/** @param {import('./deps/pelite.js').PeFile} peFile @param {typeof import('./deps/pelite.js').Facts} FactsClass */
	constructor(peFile, FactsClass) {
		this.Facts = Vue.markRaw(FactsClass);
		this.disposed = false;
		this.busy = false;
		this.headers = factsResult(peFile.headers());
		this.pointerWidth = /** @type {32 | 64} */ (this.headers.NtHeaders.OptionalHeader.Magic === 0x20b ? 64 : 32);
		this.native = Vue.markRaw(new this.Facts(this.pointerWidth));
		/** @type {FactsLayer[]} */ this.layers = [];
		this.selected = 0;
		/** @type {FactsSnapshot[]} */ this.past = [];
		/** @type {FactsSnapshot[]} */ this.future = [];
		this.saved = '';
		this.error = '';
		this.notice = '';
		this.query = '';
		this.kind = '';
		this.mode = 'inspect';
		this.section = '';
		this.from = '';
		this.to = '';
		this.page = 0;
		this.editor = '';
		this.editIndex = -1;
		this.editorLayer = -1;
		this.bulk = false;
		this.bulkText = '';
		this.bulkLayer = -1;
		this.rename = '';
		this.mutate(() => this.append('Notes', '#factmap\n'));
		this.past = [];
		this.saved = this.signature();
	}
	dispose() { this.disposed = true; this.native.dispose(); }
	get dirty() { return this.signature() !== this.saved || this.editorLayer >= 0 || this.bulk; }
	get current() { return this.layers[this.selected]; }
	/** @returns {FactsSnapshot} */
	snapshot() { return { selected: this.selected, layers: this.layers.map(layer => ({ ...layer })) }; }
	signature() { return JSON.stringify(this.layers); }
	/** Prepare a separate handle so failed imports/restores never partially mutate live data.
	 * @param {FactsSnapshot} snapshot
	 */
	restore(snapshot) {
		const native = Vue.markRaw(new this.Facts(this.pointerWidth));
		try {
			for (const layer of snapshot.layers) {
				const index = factsResult(native.addLayer(layer.text));
				factsResult(native.setLayerLabel(index, layer.label));
			}
		} catch (error) { native.dispose(); throw error; }
		this.native.dispose();
		this.native = native;
		this.layers = snapshot.layers.map((layer, index) => ({ ...layer, text: factsResult(native.getLayer(index)) }));
		this.selected = Math.max(0, Math.min(snapshot.selected, this.layers.length - 1));
		this.resetEditor();
		this.rename = this.current?.label ?? '';
		this.page = 0;
	}
	/** @param {() => void} operation @param {string} [message] */
	mutate(operation, message = '') {
		const before = this.snapshot();
		try {
			operation();
			if (JSON.stringify(before.layers) !== this.signature()) {
				this.past.push(before);
				if (this.past.length > 40) this.past.shift();
				this.future = [];
			}
			this.error = ''; this.notice = message; this.page = 0;
			this.rename = this.current?.label ?? '';
		} catch (error) { this.error = error instanceof Error ? error.message : String(error); }
	}
	/** @param {boolean} redo */
	undo(redo = false) {
		const source = redo ? this.future : this.past, target = redo ? this.past : this.future;
		const snapshot = source.at(-1);
		if (!snapshot) return;
		const current = this.snapshot();
		try { this.restore(snapshot); source.pop(); target.push(current); this.error = ''; this.notice = redo ? 'Redone.' : 'Undone.'; }
		catch (error) { this.error = String(error); }
	}
	/** @param {string} label @param {string} text */
	append(label, text) {
		const index = factsResult(this.native.addLayer(text));
		factsResult(this.native.setLayerLabel(index, label));
		this.layers.push({ label, visible: true, text: factsResult(this.native.getLayer(index)) });
		this.selected = index;
	}
	/** Stage a validated layer before replacing the original at the same index.
	 * @param {number} index @param {string} text
	 */
	replace(index, text) {
		const layer = this.layers[index];
		if (!Number.isInteger(index) || !layer) throw new Error('Layer index out of bounds.');
		const label = factsResult(this.native.getLayerLabel(index));
		const replacement = factsResult(this.native.addLayer(text));
		let moved = false;
		let canonical;
		try {
			factsResult(this.native.setLayerLabel(replacement, label));
			canonical = factsResult(this.native.getLayer(replacement));
			factsResult(this.native.shiftLayer(replacement, index));
			moved = true;
			// Moving the replacement before the original shifts the original by one.
			factsResult(this.native.deleteLayer(index + 1));
		} catch (error) {
			// Remove the staged layer if preparation or the swap fails.
			factsResult(this.native.deleteLayer(moved ? index : replacement));
			throw error;
		}
		layer.text = canonical;
	}
	/** Canonical records have one line each, even with escaped newlines inside strings.
	 * Parsing here is presentation only; WASM validates all incoming data.
	 * @param {number} layer @returns {FactsRow[]}
	 */
	rows(layer) {
		return (this.layers[layer]?.text.split('\n').slice(1).filter(Boolean) ?? []).map((text, index) => {
			const match = /^([SCFRDA])x([\da-f]+)\s+(.*)$/i.exec(text);
			if (!match) throw new Error('Unsupported canonical fact record.');
			return { index, layer, kind: match[1], rva: parseInt(match[2], 16), payload: match[3], text };
		});
	}
	resetEditor() { this.editor = ''; this.editIndex = -1; this.editorLayer = -1; this.bulk = false; this.bulkText = ''; this.bulkLayer = -1; }
	/** @param {number} index */
	select(index) { this.selected = index; this.rename = this.current?.label ?? ''; this.page = 0; }
	/** @param {number} delta */
	move(delta) {
		this.mutate(() => {
			const from = this.selected, to = from + delta;
			factsResult(this.native.shiftLayer(from, to));
			const [layer] = this.layers.splice(from, 1); this.layers.splice(to, 0, layer); this.selected = to;
		}, 'Layer moved.');
	}
	/** @param {number} index */
	removeLayer(index) {
		this.mutate(() => {
			factsResult(this.native.deleteLayer(index)); this.layers.splice(index, 1);
			this.selected = Math.max(0, Math.min(index, this.layers.length - 1));
		}, 'Layer deleted. Undo to restore it.');
	}
	mergeDown() {
		this.mutate(() => {
			const source = this.selected, base = source - 1;
			factsResult(this.native.mergeLayer(base, source));
			this.layers[base].text = factsResult(this.native.getLayer(base));
			this.layers.splice(source, 1); this.selected = base;
		}, 'Records appended to the preceding layer.');
	}

}

/** @param {string} name @param {string} text @param {string} type */
function downloadFacts(name, text, type) {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const link = document.createElement('a'); link.href = url; link.download = name; link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

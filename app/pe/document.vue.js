/** One open binary and its analysis database. Passed through the UI as a unit. */
class PeDocument {
	/** @param {File} file @param {Uint8Array} bytes @param {typeof import('./deps/pelite.js')} pelite */
	constructor(file, bytes, pelite) {
		this.file = file;
		/** @type {import('./deps/pelite.js').PeFile} */
		this.peFile = Vue.markRaw(new pelite.PeFile(bytes));
		/** @private @type {typeof import('./deps/pelite.js').Facts} */ this.FactsClass = Vue.markRaw(pelite.Facts);
		/** @private @type {FactsDatabase | null} */ this.factsDatabase = null;
		this.disposed = false;
	}

	/** Keep initialization lazy so other viewers do not depend on Facts parsing. */
	get facts() {
		if (this.disposed) throw new Error('This document is closed.');
		if (!this.factsDatabase) this.factsDatabase = new FactsDatabase(this.peFile, this.FactsClass);
		return this.factsDatabase;
	}

	get dirty() { return this.factsDatabase?.dirty ?? false; }

	/** Both WASM handles share the document lifetime, independently of open views. */
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.factsDatabase?.dispose();
		this.peFile.dispose();
	}
}

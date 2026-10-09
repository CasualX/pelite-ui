<link rel="component" href="../../components/property-grid.vue">

<script>
/** @typedef {{ matches: import('./deps/pelite.js').ScannerMatch[], limit: number }} ScannerResults */
/** @typedef {{ pattern: string, section: number | undefined, requestedLimit: number | string, error: string | undefined, results: ScannerResults | undefined }} ScannerState */
/** @typedef {{ peFile: import('./deps/pelite.js').PeFile, sections: import('./deps/pelite.js').PeSectionHeader[], state: ScannerState }} ScannerData */

/** @param {ViewContext} context @returns {ViewContent} */
function prepareScannerView(context) {
	const sections = context.peFile.sectionHeaders();
	if (sections instanceof Error) throw sections;
	return {
		component: 'view-scanner',
		get titleSuffix() {
			const data = /** @type {ScannerData} */ (/** @type {unknown} */ (this.data));
			return data.state.pattern.trim();
		},
		data: {
			peFile: context.peFile,
			sections,
			// Owned by this view instance, so switching the component preserves the query.
			state: {
				pattern: '', section: undefined, requestedLimit: 1000,
				error: undefined, results: undefined,
			},
		},
	};
}

const ViewScanner = Vue.defineComponent({
	template: '#view-scanner',
	props: { data: { type: Object, required: true } },
	computed: {
		scannerData() {
			return /** @type {ScannerData} */ (/** @type {unknown} */ (this.data));
		},
		state() {
			return this.scannerData.state;
		},
		/** @returns {PropertyGridColumn[]} */
		interpretations() {
			const columns = /** @type {PropertyGridColumn[]} */ ([
				{ title: '#', style: { textAlign: 'right' }, format: (value, index) => String(Number(index) + 1) },
			]);
			const captureCount = this.state.results?.matches[0]?.save.length ?? 0;
			for (let slot = 0; slot < captureCount; slot++) {
				columns.push({
					title: slot === 0 ? 'Match RVA' : `Save ${slot}`,
					style: { textAlign: 'right' },
					format: value => this.hex((/** @type {import('./deps/pelite.js').ScannerMatch} */ (value)).save[slot]),
				});
			}
			return columns;
		},
	},
	methods: {
		scan() {
			this.state.error = undefined;
			this.state.results = undefined;
			const pattern = this.state.pattern.trim();
			if (!pattern) {
				this.state.error = 'Enter a pattern to scan.';
				return;
			}
			const limit = Number(this.state.requestedLimit);
			if (this.state.requestedLimit === '' || !Number.isSafeInteger(limit) || limit < 0) {
				this.state.error = 'The match limit must be a non-negative whole number.';
				return;
			}
			try {
				const matches = this.scannerData.peFile.scannerMatches(pattern, this.state.section, { limit });
				if (matches instanceof Error) throw matches;
				this.state.results = { matches, limit };
			} catch (error) {
				this.state.error = error instanceof Error ? error.message : String(error);
			}
		},
		/** @param {number} value */
		hex(value) {
			return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
		},
	},
});
</script>

<template id="view-scanner">
	<section class="view-scanner">
		<div class="view-scanner__heading">
			<a href="https://docs.rs/pelite/latest/pelite/pattern/fn.parse.html" target="_blank" rel="noopener noreferrer">Pattern syntax ↗</a>
		</div>
		<p class="view-scanner__description">Find byte patterns and capture values in PE sections.<br>Headers are excluded; a match limit of 0 means unlimited.</p>
		<form class="view-scanner__form" @submit.prevent="scan">
			<label class="view-scanner__pattern">Pattern
				<input v-model="state.pattern" type="text" placeholder="55 8B EC" spellcheck="false" autocomplete="off">
			</label>
			<label>Section
				<select v-model="state.section" aria-label="Section">
					<option :value="undefined">Code sections (default)</option>
					<option v-for="(section, index) in scannerData.sections" :key="index" :value="index">{{ section.Name }}</option>
				</select>
			</label>
			<label>Match limit
				<input v-model.number="state.requestedLimit" type="number" min="0" step="1" required>
			</label>
			<button class="view-scanner__scan" type="submit">Scan</button>
		</form>
		<p v-if="state.error" class="view-scanner__error" role="alert">{{ state.error }}</p>
		<template v-if="state.results">
			<div class="view-scanner__results" role="status" aria-live="polite">
				<strong>{{ state.results.matches.length === 0 ? 'No matches found.' : `${state.results.matches.length.toLocaleString()} matches` }}</strong>
				<span v-if="state.results.limit > 0 && state.results.matches.length >= state.results.limit">Limit reached; more matches may exist.</span>
			</div>
			<property-grid v-if="state.results.matches.length" :list="state.results.matches" :interpretations="interpretations" label="Scanner matches"></property-grid>
		</template>
	</section>
</template>

<style>
.view-scanner__heading { display: flex; align-items: center; gap: 24px; }
.view-scanner__heading a { color: var(--color-accent); font-size: 12px; text-decoration: none; }
.view-scanner__heading a:hover { text-decoration: underline; }
.view-scanner__description { margin: 8px 0 26px; color: var(--color-muted); font-size: 13px; }
.view-scanner__form { display: grid; grid-template-columns: minmax(180px, 1fr) 190px 110px auto; gap: 12px; align-items: end; }
.view-scanner__form label { display: flex; flex-direction: column; gap: 8px; color: var(--color-text); font-size: 12px; }
.view-scanner__form input, .view-scanner__form select { width: 100%; min-width: 0; height: 36px; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); color: var(--color-text); font-size: 12px; }
.view-scanner__form input::placeholder { color: var(--color-muted); }
.view-scanner__pattern input { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.view-scanner__pattern input::placeholder { color: color-mix(in srgb, var(--color-muted) 55%, var(--color-surface)); }
.view-scanner__scan { height: 36px; padding: 7px 18px; border: 1px solid var(--color-accent-hover); border-radius: 4px; background: var(--color-accent); color: var(--color-on-accent); font-size: 12px; cursor: pointer; }
.view-scanner__scan:hover { background: var(--color-accent-hover); }
.view-scanner input:focus-visible, .view-scanner select:focus-visible, .view-scanner button:focus-visible, .view-scanner a:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.view-scanner__error { margin: 24px 0 0; color: var(--color-danger); font-size: 13px; }
.view-scanner__results { display: flex; flex-wrap: wrap; gap: 10px 20px; margin: 28px 0 16px; color: var(--color-muted); font-size: 12px; }
.view-scanner__results strong { color: var(--color-text); font-weight: 600; }
</style>

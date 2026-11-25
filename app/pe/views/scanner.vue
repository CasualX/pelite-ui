<link rel="component" href="../../components/property-grid.vue">

<script>
/** @typedef {{ matches: PeLite.ScannerMatch[], limit: number }} ScannerResults */
/** @typedef {{ pattern: string, section: number | undefined, requestedLimit: number | string, error: string | undefined, results: ScannerResults | undefined }} ScannerState */
/** @typedef {{ document: PeDocument, sections: PeLite.PeSectionHeader[], imageSize: number, state: ScannerState }} ScannerData */

/** @param {PeDocument} context @returns {ViewContent} */
function prepareScannerView(context) {
	const sections = context.peFile.sectionHeaders();
	if (sections instanceof Error) throw sections;
	const optionalHeader = context.peFile.optionalHeader();
	return {
		component: 'view-scanner',
		get titleSuffix() {
			const data = /** @type {ScannerData} */ (/** @type {unknown} */ (this.data));
			return data.state.pattern.trim();
		},
		data: {
			document: context,
			sections,
			imageSize: optionalHeader instanceof Error ? 0 : optionalHeader.SizeOfImage,
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
				{ title: '#', width: 'calc(3.1em + var(--workspace-gutter, 12px) + 12px)', style: { textAlign: 'right' },
					format: (value, index) => String(Number(index) + 1) },
				{ title: 'Match RVA', width: '8rem', style: { textAlign: 'right' },
					kind: value => this.rvaKind((/** @type {PeLite.ScannerMatch} */ (value)).rva),
					format: value => this.hex((/** @type {PeLite.ScannerMatch} */ (value)).rva) },
			]);
			const captureCount = this.state.results?.matches[0]?.save.length ?? 0;
			for (let slot = 1; slot < captureCount; slot++) {
				columns.push({
					title: `Save ${slot}`,
					width: '8rem',
					style: { textAlign: 'right' },
					kind: value => this.rvaKind((/** @type {PeLite.ScannerMatch} */ (value)).save[slot]),
					format: value => this.hex((/** @type {PeLite.ScannerMatch} */ (value)).save[slot]),
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
				const matches = this.scannerData.document.peFile.scannerMatches(pattern, this.state.section, { limit });
				if (matches instanceof Error) throw matches;
				this.state.results = { matches, limit };
			} catch (error) {
				this.state.error = error instanceof Error ? error.message : String(error);
			}
		},
		/** @param {number} value */
		rvaKind(value) {
			return value >= 0 && value < this.scannerData.imageSize ? 'rva' : undefined;
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
		<div class="view-scanner__controls">
			<p class="view-scanner__description">
				Find byte patterns and capture values in PE sections. Headers are excluded.
				<a href="https://docs.rs/pelite/latest/pelite/pattern/fn.parse.html" target="_blank" rel="noopener noreferrer">Pattern syntax <span aria-hidden="true">↗</span></a>
			</p>
			<form class="view-scanner__form" @submit.prevent="scan">
				<label class="view-scanner__pattern">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
						<path d="M3 6V4a1 1 0 0 1 1-1h2m4 0h2a1 1 0 0 1 1 1v2m0 4v2a1 1 0 0 1-1 1h-2m-4 0H4a1 1 0 0 1-1-1v-2m3-2h4" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
					</svg>
					<input v-model="state.pattern" type="text" aria-label="Byte pattern" placeholder="Byte pattern" spellcheck="false" autocomplete="off">
				</label>
				<label class="view-scanner__section">
					<span>Section</span>
					<select v-model="state.section">
						<option :value="undefined">Code sections</option>
						<option v-for="(section, index) in scannerData.sections" :key="index" :value="index">{{ section.Name }}</option>
					</select>
				</label>
				<label class="view-scanner__limit" title="0 means unlimited">
					<span>Limit</span>
					<input v-model.number="state.requestedLimit" type="number" aria-label="Match limit, 0 means unlimited" min="0" step="1" required>
				</label>
				<button class="view-scanner__scan" type="submit" :disabled="!state.pattern.trim()">
					Scan <span aria-hidden="true">↵</span>
				</button>
			</form>
			<p v-if="state.error" class="view-scanner__error" role="alert">{{ state.error }}</p>
			<div v-if="state.results" class="view-scanner__results" role="status" aria-live="polite">
				<strong>{{ state.results.matches.length === 0 ? 'No matches found.' : `${state.results.matches.length.toLocaleString()} ${state.results.matches.length === 1 ? 'match' : 'matches'}` }}</strong>
				<span v-if="state.results.limit > 0 && state.results.matches.length >= state.results.limit" class="view-scanner__warning">
					<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
						<path d="M8 2.5 14 13H2L8 2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
						<path d="M8 6.5v2.5m0 2v.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
					</svg>
					Limit reached · more matches may exist
				</span>
			</div>
		</div>
		<property-grid v-if="state.results?.matches.length" class="view-scanner__matches property-grid--scrollable" tabindex="0"
			:list="state.results.matches" :interpretations="interpretations" label="Scanner matches" spacer></property-grid>
	</section>
</template>

<style>
.view-scanner { container: scanner / inline-size; display: flex; flex-direction: column; height: 100%; overflow: clip; }
.view-scanner__controls { flex: none; padding: 14px var(--workspace-gutter) 12px; border-bottom: 1px solid var(--color-border); }
.view-scanner__matches { flex: 1; min-height: 0; }
.view-scanner__description { margin: 0 0 12px; color: var(--color-muted); font-size: 13px; line-height: 1.5; }
.view-scanner__description a { margin-inline-start: 5px; color: var(--color-accent-hover); text-decoration: none; white-space: nowrap; }
.view-scanner__description a:hover { text-decoration: underline; }
.view-scanner__form {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto auto auto;
	overflow: hidden;
	border: 1px solid var(--color-border);
	border-radius: 6px;
	background: color-mix(in srgb, var(--workspace-background) 96%, black);
}
.view-scanner__form:focus-within { border-color: var(--color-accent); }
.view-scanner__form label { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 40px; padding: 0 11px; color: var(--color-muted); font-size: 11px; white-space: nowrap; }
.view-scanner__pattern svg { flex: none; }
.view-scanner__section, .view-scanner__limit { border-inline-start: 1px solid var(--color-border); }
.view-scanner__form input, .view-scanner__form select {
	min-width: 0;
	min-height: 32px;
	padding: 0 3px;
	border: 0;
	border-radius: 3px;
	background: transparent;
	color: var(--color-text);
	font-size: 12px;
}
.view-scanner__form select { max-width: 100%; }
.view-scanner__form input { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.view-scanner__pattern input { flex: 1; font-size: 14px; }
.view-scanner__pattern input::placeholder { color: var(--color-muted); }
.view-scanner__limit input { width: 7ch; appearance: textfield; }
.view-scanner__limit input::-webkit-inner-spin-button, .view-scanner__limit input::-webkit-outer-spin-button { appearance: none; margin: 0; }
.view-scanner__scan { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 0 16px; border: 0; background: var(--color-accent); color: var(--color-on-accent); font-size: 12px; font-weight: 650; cursor: pointer; }
.view-scanner__scan span { opacity: .7; }
.view-scanner__scan:hover:enabled { background: var(--color-accent-hover); }
.view-scanner__scan:disabled { background: color-mix(in srgb, var(--color-accent) 38%, var(--workspace-background)); color: var(--color-text); cursor: default; }
.view-scanner__form :is(input, select):focus-visible, .view-scanner__description a:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
.view-scanner__form .view-scanner__pattern input:focus-visible { outline: none; }
.view-scanner__pattern:focus-within svg { color: var(--color-accent); }
.view-scanner__scan:focus-visible { outline: 2px solid var(--color-on-accent); outline-offset: -4px; }
.view-scanner__error { margin: 12px 0 0; color: var(--color-danger); font-size: 13px; }
.view-scanner__results { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-top: 12px; font-size: 12px; }
.view-scanner__results strong { color: var(--color-text); font-weight: 600; }
.view-scanner__warning { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border: 1px solid color-mix(in srgb, var(--color-warning) 36%, var(--color-border)); border-radius: 999px; background: color-mix(in srgb, var(--color-warning) 9%, var(--workspace-background)); color: var(--color-warning); }
.view-scanner__warning svg { flex: none; }
@container scanner (width < 45rem) {
	.view-scanner__form { grid-template-columns: minmax(0, 1fr) auto auto; }
	.view-scanner__pattern { grid-column: 1 / -1; border-bottom: 1px solid var(--color-border); }
	.view-scanner__section { border-inline-start: 0; }
}
@container scanner (width < 31rem) {
	.view-scanner__form { grid-template-columns: minmax(0, 1fr) auto; }
	.view-scanner__section { grid-column: 1 / -1; border-bottom: 1px solid var(--color-border); }
	.view-scanner__limit { border-inline-start: 0; }
}
</style>

<link rel="component" href="../../components/property-grid.vue">

<script>
const richprintDatabaseUrl = 'https://raw.githubusercontent.com/dishather/richprint/b0a4f598cc076a8c2ff4b1b90850004bc17da31c/comp_id.txt';
let richprintDatabase = /** @type {Promise<Map<string, string>> | undefined} */ (undefined);

/** @param {string} text @returns {Map<string, string>} */
function parseRichprintDatabase(text) {
	const descriptions = new Map();
	for (const line of text.split('\n')) {
		const entry = /^([\da-f]{8}|[\da-f]{4})\s+(.+)$/i.exec(line.split('#', 1)[0].trim());
		if (entry) descriptions.set(entry[1].toLowerCase(), entry[2]);
	}
	if (!descriptions.size) throw new Error('The richprint database has no readable entries.');
	return descriptions;
}

function loadRichprintDatabase() {
	if (!richprintDatabase) {
		richprintDatabase = fetch(richprintDatabaseUrl, { credentials: 'omit', referrerPolicy: 'no-referrer' })
			.then(response => {
				if (!response.ok) throw new Error(`Unable to download the richprint database (HTTP ${response.status}).`);
				return response.text();
			})
			.then(parseRichprintDatabase)
			.catch(error => {
				richprintDatabase = undefined;
				throw error;
			});
	}
	return richprintDatabase;
}

/** @param {PeDocument} context @returns {boolean} */
function isRichStructureAvailable(context) {
	return !(context.peFile.richStructure() instanceof Error);
}

/** @param {PeDocument} context @returns {ViewContent} */
function prepareRichStructureView(context) {
	const rich = context.peFile.richStructure();
	if (rich instanceof Error) throw rich;
	return { component: 'view-rich-structure', data: { rich } };
}

const ViewRichStructure = Vue.defineComponent({
	template: '#view-rich-structure',
	props: { data: { type: Object, required: true } },
	data() {
		return {
			descriptions: /** @type {Map<string, string> | null} */ (null),
			loadingDescriptions: false,
			descriptionError: '',
			databaseUrl: richprintDatabaseUrl,
			recordInterpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: '#', width: '4.5rem', style: { textAlign: 'right' }, format: (value, index) => String(Number(index) + 1) },
				{ title: 'Product', width: '6rem', style: { textAlign: 'right' }, format: value => {
					const product = (/** @type {import('./deps/pelite.js').PeRichRecord} */ (value)).product;
					return product === 0 ? '0' : `0x${product.toString(16)}`;
				} },
				{ title: 'Build', width: '6rem', style: { textAlign: 'right' }, format: value => String((/** @type {import('./deps/pelite.js').PeRichRecord} */ (value)).build) },
				{ title: 'Count', width: '6rem', style: { textAlign: 'right' }, format: value => String((/** @type {import('./deps/pelite.js').PeRichRecord} */ (value)).count) },
			]),
		};
	},
	computed: {
		/** @returns {PropertyGridColumn[]} */
		recordColumns() {
			const descriptions = this.descriptions;
			if (!descriptions) return this.recordInterpretations;
			return [...this.recordInterpretations, { title: 'Interpretation', format: value => {
				const record = /** @type {import('./deps/pelite.js').PeRichRecord} */ (value);
				const product = record.product.toString(16).padStart(4, '0');
				const build = record.build.toString(16).padStart(4, '0');
				const exact = descriptions.get(product + build);
				if (exact !== undefined) return exact;
				const generic = descriptions.get(product);
				return generic === undefined ? 'Unknown' : `${generic} (product ID only)`;
			} }];
		},
		/** @returns {PropertyGridColumn[]} */
		summaryInterpretations() {
			const rich = /** @type {import('./deps/pelite.js').PeRichStructure} */ (/** @type {unknown} */ (this.data.rich));
			return [
				{ title: 'Field', width: '9rem', format: (value, name) => name === 'xor_key' ? 'XOR key' : 'Checksum' },
				{ title: 'Value', width: '7rem', style: { textAlign: 'right' }, format: value => value === 0 ? '0' : `0x${Number(value).toString(16)}` },
				{ title: 'Interpretation', format: (value, name) =>
					name === 'checksum' ? (rich.checksum === rich.xor_key ? 'Matches XOR key' : 'Does not match XOR key') : '' },
			];
		},
	},
	methods: {
		async loadDescriptions() {
			this.loadingDescriptions = true;
			this.descriptionError = '';
			try {
				this.descriptions = await loadRichprintDatabase();
			} catch {
				this.descriptionError = 'Could not load the richprint database. Try again.';
			} finally {
				this.loadingDescriptions = false;
			}
		},
	},
});
</script>

<template id="view-rich-structure">
	<section class="view-rich-structure">
		<template v-if="data.rich">
			<p class="view-rich-structure__description">Decoded product identifiers, build numbers, and object counts recorded by the toolchain.</p>
			<property-grid :list="{ xor_key: data.rich.xor_key, checksum: data.rich.checksum }" :interpretations="summaryInterpretations" label="Rich structure summary"></property-grid>
			<div class="view-rich-structure__records-header">
				<h2>Records</h2>
				<template v-if="data.rich.records.length">
					<a v-if="descriptions" :href="databaseUrl" target="_blank" rel="noopener noreferrer">richprint database</a>
					<button v-else type="button" :disabled="loadingDescriptions" @click="loadDescriptions">{{ loadingDescriptions ? 'Loading interpretations…' : 'Load interpretations' }}</button>
				</template>
			</div>
			<p v-if="descriptionError" class="view-rich-structure__error" role="alert">{{ descriptionError }}</p>
			<property-grid v-if="data.rich.records.length" :list="data.rich.records" :interpretations="recordColumns" :min-width="descriptions ? '32rem' : undefined" :spacer="!descriptions" label="Rich records"></property-grid>
			<p v-else class="view-rich-structure__description">No Rich records.</p>
		</template>
		<p v-else class="view-rich-structure__description">No Rich structure.</p>
	</section>
</template>

<style>
.view-rich-structure__description { margin: 0 0 26px; color: var(--color-muted); font-size: 13px; }
.view-rich-structure__records-header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 26px 0 12px; }
.view-rich-structure__records-header h2 { margin: 0; font-size: 14px; font-weight: 600; }
.view-rich-structure__records-header button { padding: 5px 9px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); color: var(--color-text); font-size: 12px; cursor: pointer; }
.view-rich-structure__records-header button:disabled { color: var(--color-muted); cursor: wait; }
.view-rich-structure__records-header a { color: var(--color-accent-hover); font-size: 12px; }
.view-rich-structure__records-header button:focus-visible, .view-rich-structure__records-header a:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.view-rich-structure__error { margin: 0 0 12px; color: var(--color-danger); font-size: 13px; }
</style>

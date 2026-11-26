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
			descriptionError: '',
			databaseUrl: richprintDatabaseUrl,
			recordInterpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: '#', width: '4.5rem', style: { textAlign: 'right' }, format: (value, index) => String(Number(index) + 1) },
				{ title: 'Product', width: '6rem', style: { textAlign: 'right' }, format: value => {
					const product = (/** @type {PeLite.PeRichRecord} */ (value)).product;
					return product === 0 ? '0' : `0x${product.toString(16)}`;
				} },
				{ title: 'Build', width: '6rem', style: { textAlign: 'right' }, format: value => String((/** @type {PeLite.PeRichRecord} */ (value)).build) },
				{ title: 'Count', width: '6rem', style: { textAlign: 'right' }, format: value => String((/** @type {PeLite.PeRichRecord} */ (value)).count) },
			]),
		};
	},
	computed: {
		rich() { return /** @type {PeLite.PeRichStructure | null} */ (this.data.rich); },
		/** @returns {PropertyGridColumn[]} */
		recordColumns() {
			const descriptions = this.descriptions;
			if (!descriptions) return this.recordInterpretations;
			return [...this.recordInterpretations, { title: 'Interpretation', format: value => {
				const record = /** @type {PeLite.PeRichRecord} */ (value);
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
			const rich = this.rich;
			return [
				{ title: 'Field', width: '9rem', format: (value, name) => name === 'xor_key' ? 'XOR key' : 'Checksum' },
				{ title: 'Value', width: '7rem', style: { textAlign: 'right' }, format: value => value === 0 ? '0' : `0x${Number(value).toString(16)}` },
				{ title: 'Interpretation', format: (value, name) =>
					name === 'checksum' && rich ? (rich.checksum === rich.xor_key ? 'Matches XOR key' : 'Does not match XOR key') : '' },
			];
		},
	},
	async mounted() {
		if (!this.rich?.records.length) return;
		try {
			this.descriptions = await loadRichprintDatabase();
		} catch {
			this.descriptionError = 'Could not load the richprint database.';
		}
	},
});
</script>

<template id="view-rich-structure">
	<section class="view-rich-structure">
		<template v-if="rich">
			<property-grid :list="{ xor_key: rich.xor_key, checksum: rich.checksum }" :interpretations="summaryInterpretations" label="Rich structure summary"></property-grid>
			<property-grid v-if="rich.records.length" :list="rich.records" :interpretations="recordColumns" :min-width="descriptions ? '32rem' : undefined" :spacer="!descriptions" label="Rich records"></property-grid>
			<p v-else class="view-rich-structure__description">No Rich records.</p>
			<p v-if="descriptionError" class="view-rich-structure__error" role="alert">{{ descriptionError }}</p>
			<p class="view-rich-structure__source"><a :href="databaseUrl" target="_blank" rel="noopener noreferrer">richprint database</a></p>
		</template>
		<p v-else class="view-rich-structure__description">No Rich structure.</p>
	</section>
</template>

<style>
.view-rich-structure { padding-bottom: 24px; }
.view-rich-structure__description, .view-rich-structure__error, .view-rich-structure__source { margin: 12px var(--workspace-gutter) 0; font-size: 13px; }
.view-rich-structure__description { color: var(--color-muted); }
.view-rich-structure__error { color: var(--color-danger); }
.view-rich-structure__source a { color: var(--color-accent-hover); font-size: 12px; }
.view-rich-structure__source a:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
</style>

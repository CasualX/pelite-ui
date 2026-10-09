<link rel="component" href="../../components/property-grid.vue">

<script>

/** @param {ViewContext} context @returns {boolean} */
function isVersionInfoAvailable(context) {
	const version = context.peFile.resourcesVersionInfo();
	return version !== null && !(version instanceof Error);
}

/** @param {ViewContext} context @returns {ViewContent} */
function prepareVersionInfoView(context) {
	const version = context.peFile.resourcesVersionInfo();
	if (version instanceof Error) throw version;
	if (version === null) throw new Error('No version information resource was found.');
	return { component: 'view-version-info', data: { version } };
}

/** Version-language keys contain four hex digits each for language and code page.
 * @param {string} key @returns {string}
 */
function formatVersionLanguage(key) {
	return `0x${key.slice(0, 4).toLowerCase()}`;
}

/** @param {string} key @returns {string} */
function formatVersionCodePage(key) {
	return String(parseInt(key.slice(4), 16));
}

const ViewVersionInfo = Vue.defineComponent({
	template: '#view-version-info',
	props: { data: { type: Object, required: true } },
	data() {
		return {
			stringInterpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', style: { minWidth: '240px' }, format: (value, name) => String(name) },
				{ title: 'Value', style: { minWidth: '360px' }, format: value => String(value) },
			]),
			fixedInterpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', style: { minWidth: '240px' }, format: (value, name) => String(name) },
				{ title: 'Value', style: { minWidth: '180px', textAlign: 'right' }, format: value =>
					typeof value === 'number' && value !== 0 ? `0x${value.toString(16)}` : String(value) },
			]),
			translationInterpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Language ID', style: { minWidth: '140px', textAlign: 'right' }, format: value => formatVersionLanguage(String(value)) },
				{ title: 'Code page', style: { minWidth: '140px', textAlign: 'right' }, format: value => formatVersionCodePage(String(value)) },
			]),
		};
	},
	computed: {
		version() { return /** @type {import('./deps/pelite.js').PeVersionInfo} */ (/** @type {unknown} */ (this.data.version)); },
	},
	methods: { formatVersionLanguage, formatVersionCodePage },
});
</script>

<template id="view-version-info">
	<section class="view-version-info">
		<section v-for="(strings, language) in version.strings" :key="language" class="view-version-info__strings">
			<h2>Language {{ formatVersionLanguage(language) }} · Code page {{ formatVersionCodePage(language) }}</h2>
			<property-grid :list="strings" :interpretations="stringInterpretations" :label="'Version strings ' + language"></property-grid>
		</section>
		<details v-if="version.fixed" class="view-version-info__fixed">
			<summary>Fixed file information</summary>
			<property-grid :list="version.fixed" :interpretations="fixedInterpretations" label="Fixed file information"></property-grid>
		</details>
		<section v-if="version.langs.length" class="view-version-info__translations">
			<h2>Translations</h2>
			<property-grid :list="version.langs" :interpretations="translationInterpretations" label="Version translations"></property-grid>
		</section>
	</section>
</template>

<style>
.view-version-info__strings, .view-version-info__fixed { margin-bottom: 24px; }
.view-version-info h2 { margin: 0 0 12px; font-size: 13px; font-weight: 600; }
.view-version-info__fixed summary { width: max-content; margin-bottom: 12px; font-size: 12px; font-weight: 600; cursor: pointer; user-select: none; }
.view-version-info__fixed summary:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
</style>

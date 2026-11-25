<link rel="component" href="../../components/property-grid.vue">

<script>

/** @param {PeDocument} context @returns {boolean} */
function isVersionInfoAvailable(context) {
	const version = context.peFile.resourcesVersionInfo();
	return version !== null && !(version instanceof Error);
}

/** @param {PeDocument} context @returns {ViewContent} */
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
		const firstColumnWidth = 'max(10.5rem, 26.5cqi)';
		return {
			selectedLanguageIndex: 0,
			stringInterpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', width: firstColumnWidth, format: (value, name) => String(name) },
				{ title: 'Value', format: value => String(value) },
			]),
			fixedInterpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', width: firstColumnWidth, format: (value, name) => String(name) },
				{ title: 'Value', format: formatPropertyGridHex },
			]),
			languageInterpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Language ID', width: firstColumnWidth, format: value => formatVersionLanguage(String(value)) },
				{ title: 'Code page', format: value => formatVersionCodePage(String(value)) },
			]),
		};
	},
	computed: {
		version() { return /** @type {PeLite.PeVersionInfo} */ (/** @type {unknown} */ (this.data.version)); },
		languages() { return [...new Set([...this.version.langs, ...Object.keys(this.version.strings)])]; },
		selectedLanguage() { return this.languages.at(this.selectedLanguageIndex); },
		selectedStrings() { return this.selectedLanguage === undefined ? undefined : this.version.strings[this.selectedLanguage]; },
	},
});
</script>

<template id="view-version-info">
	<section class="view-version-info">
		<property-grid v-if="languages.length" :list="languages" :interpretations="languageInterpretations"
			v-model:selected-index="selectedLanguageIndex" label="Version languages" selectable></property-grid>
		<property-grid v-if="selectedStrings" :list="selectedStrings" :interpretations="stringInterpretations"
			:label="'Version strings ' + selectedLanguage"></property-grid>
		<property-grid v-if="version.fixed" :list="version.fixed" :interpretations="fixedInterpretations" label="Fixed file information"></property-grid>
	</section>
</template>

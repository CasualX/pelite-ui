<link rel="component" href="../../components/property-grid.vue">

<script>
/** @typedef {PeLite.PeDebugDirectoryImage & { type: string, image: PeLite.PeDebugDirectoryImage, payload: ReturnType<typeof debugEntryDetails> }} DebugDirectoryRow */

/** @param {unknown} row @param {string} field @returns {string} */
function formatDebugField(row, field) {
	return formatPropertyGridHex((/** @type {Record<string, unknown>} */ (row))[field]);
}

/** @param {PeLite.PeDebugDirectoryEntry['entry']} entry */
function debugEntryDetails(entry) {
	if (!entry) return null;
	if ('pdb_file_name' in entry) {
		return { fields: { Format: entry.format, ...entry.image, 'PDB path': entry.pdb_file_name } };
	}
	if ('name' in entry) {
		const name = Array.isArray(entry.name) ? entry.name.map(unit => String.fromCharCode(unit)).join('') : entry.name;
		return { fields: { ...entry.image, Name: name } };
	}
	return {
		fields: { 'PGO signature': entry.signature },
		sections: entry.sections.map(section => section.Ok ?? { error: section.Err }),
	};
}

/** @param {PeDocument} context @returns {ViewContent} */
function prepareDebugDirectoryView(context) {
	const entries = context.peFile.debug();
	if (entries instanceof Error) throw entries;
	if (entries === null) throw new Error('The directory is unavailable.');
	const rows = entries.map(({ image, type, entry }) => ({
		...image,
		type: type?.replace(/^IMAGE_DEBUG_TYPE_/, '') ?? formatPropertyGridHex(image.Type),
		image,
		payload: debugEntryDetails(entry),
	}));
	return { component: 'view-debug-directory', data: { rows } };
}

const ViewDebugDirectory = Vue.defineComponent({
	template: '#view-debug-directory',
	props: { data: { type: Object, required: true } },
	data() {
		const firstColumnWidth = 'clamp(9rem, 26.5cqi, 12rem)';
		const payloadColumns = /** @type {PropertyGridColumn[]} */ ([
			{ title: 'Field', width: firstColumnWidth, format: (value, field) => String(field) },
			{ title: 'Value', format: formatPropertyGridHex },
		]);
		return {
			selectedEntryIndex: 0,
			entryColumns: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Type', width: firstColumnWidth, format: row => formatDebugField(row, 'type') },
				{ title: 'Data RVA', width: '7rem', kind: row => (/** @type {PeLite.PeDebugDirectoryImage} */ (row)).AddressOfRawData ? 'rva' : undefined,
					style: { textAlign: 'right' }, format: row => formatDebugField(row, 'AddressOfRawData') },
				{ title: 'File offset', width: '7rem', kind: row => (/** @type {PeLite.PeDebugDirectoryImage} */ (row)).PointerToRawData ? 'fo' : undefined,
					style: { textAlign: 'right' }, format: row => formatDebugField(row, 'PointerToRawData') },
				{ title: 'Size', width: '7rem', style: { textAlign: 'right' }, format: row => formatDebugField(row, 'SizeOfData') },
			]),
			headerColumns: /** @type {PropertyGridColumn[]} */ ([
				payloadColumns[0],
				{ ...payloadColumns[1], kind: (value, field) => {
					if (!value) return undefined;
					return field === 'AddressOfRawData' ? 'rva' : field === 'PointerToRawData' ? 'fo' : undefined;
				} },
			]),
			payloadColumns,
			sectionColumns: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Name', width: firstColumnWidth, format: row => formatDebugField(row, 'name') },
				{ title: 'RVA', width: '7rem', kind: row => typeof (/** @type {PeLite.PePgoSection} */ (row)).rva === 'number' ? 'rva' : undefined,
					style: { textAlign: 'right' }, format: row => formatDebugField(row, 'rva') },
				{ title: 'Size', width: '7rem', style: { textAlign: 'right' }, format: row => formatDebugField(row, 'size') },
				{ title: 'Error', format: row => formatDebugField(row, 'error') },
			]),
		};
	},
	computed: {
		rows() { return /** @type {DebugDirectoryRow[]} */ (this.data.rows); },
		selectedEntry() { return this.rows.at(this.selectedEntryIndex); },
	},
});
</script>

<template id="view-debug-directory">
	<section class="view-debug-directory">
		<property-grid v-if="rows.length" :list="rows" :interpretations="entryColumns" v-model:selected-index="selectedEntryIndex"
			min-width="29rem" label="Debug directory entries" selectable spacer></property-grid>
		<p v-else class="view-debug-directory__note">No debug entries.</p>
		<template v-if="selectedEntry">
			<property-grid :list="selectedEntry.image" :interpretations="headerColumns"
				:label="'Debug entry ' + (selectedEntryIndex + 1) + ' header'"></property-grid>
			<template v-if="selectedEntry.payload">
				<property-grid :list="selectedEntry.payload.fields" :interpretations="payloadColumns"
					:label="'Debug entry ' + (selectedEntryIndex + 1) + ' data'"></property-grid>
				<template v-if="selectedEntry.payload.sections">
					<property-grid v-if="selectedEntry.payload.sections.length" :list="selectedEntry.payload.sections"
						:interpretations="sectionColumns" min-width="24rem" label="PGO sections"></property-grid>
					<p v-else class="view-debug-directory__note">No PGO sections.</p>
				</template>
			</template>
			<p v-else class="view-debug-directory__note">Debug data is unavailable or uses an unsupported format.</p>
		</template>
	</section>
</template>

<style>
.view-debug-directory__note { margin: 12px var(--workspace-gutter) 0; color: var(--color-muted); font-size: 13px; }
</style>

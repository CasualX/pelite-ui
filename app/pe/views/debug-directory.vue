<link rel="component" href="../../components/property-grid.vue">

<script>
/** @param {unknown} row @param {string} field @returns {string} */
function formatDebugField(row, field) {
	return formatPropertyGridHex((/** @type {Record<string, unknown>} */ (row))[field]);
}

/** @param {import('./deps/pelite.js').PeDebugDirectoryEntry['entry']} entry */
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
		const payloadColumns = /** @type {PropertyGridColumn[]} */ ([
			{ title: 'Field', style: { minWidth: '160px' }, format: (value, field) => String(field) },
			{ title: 'Value', style: { minWidth: '120px' }, format: formatPropertyGridHex },
		]);
		return {
			openedEntries: /** @type {Set<number>} */ (new Set()),
			entryColumns: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Type', format: row => formatDebugField(row, 'type') },
				{ title: 'Data RVA', kind: row => (/** @type {import('./deps/pelite.js').PeDebugDirectoryImage} */ (row)).AddressOfRawData ? 'rva' : undefined,
					format: row => formatDebugField(row, 'AddressOfRawData') },
				{ title: 'File offset', kind: row => (/** @type {import('./deps/pelite.js').PeDebugDirectoryImage} */ (row)).PointerToRawData ? 'fo' : undefined,
					format: row => formatDebugField(row, 'PointerToRawData') },
				{ title: 'Size', format: row => formatDebugField(row, 'SizeOfData') },
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
				{ title: 'Name', format: row => formatDebugField(row, 'name') },
				{ title: 'RVA', kind: row => typeof (/** @type {import('./deps/pelite.js').PePgoSection} */ (row)).rva === 'number' ? 'rva' : undefined,
					format: row => formatDebugField(row, 'rva') },
				{ title: 'Size', format: row => formatDebugField(row, 'size') },
				{ title: 'Error', format: row => formatDebugField(row, 'error') },
			]),
		};
	},
	methods: {
		/** @param {number} index @param {Event} event */
		showEntry(index, event) {
			if (event.currentTarget instanceof HTMLDetailsElement && event.currentTarget.open) this.openedEntries.add(index);
		},
	},
});
</script>

<template id="view-debug-directory">
	<section>
		<property-grid v-if="data.rows.length" :list="data.rows" :interpretations="entryColumns" label="Debug directory entries"></property-grid>
		<p v-else class="view-debug-directory__note">No debug entries.</p>
		<div v-if="data.rows.length" class="view-debug-directory__entries">
			<details v-for="(entry, index) in data.rows" :key="index" class="view-debug-directory__entry" @toggle="showEntry(index, $event)">
				<summary>Debug entry {{ index + 1 }} · {{ entry.type }}</summary>
				<div v-if="openedEntries.has(index)" class="view-debug-directory__details">
					<property-grid :list="entry.image" :interpretations="headerColumns" :label="'Debug entry ' + (index + 1) + ' header'"></property-grid>
					<h2 class="view-debug-directory__title">Debug data</h2>
					<template v-if="entry.payload">
						<property-grid :list="entry.payload.fields" :interpretations="payloadColumns" :label="'Debug entry ' + (index + 1) + ' data'"></property-grid>
						<template v-if="entry.payload.sections">
							<h2 class="view-debug-directory__title">PGO sections</h2>
							<property-grid v-if="entry.payload.sections.length" :list="entry.payload.sections" :interpretations="sectionColumns" label="PGO sections"></property-grid>
							<p v-else class="view-debug-directory__note">No PGO sections.</p>
						</template>
					</template>
					<p v-else class="view-debug-directory__note">Debug data is unavailable or uses an unsupported format.</p>
				</div>
			</details>
		</div>
	</section>
</template>

<style>
.view-debug-directory__title { margin: 24px 0 12px; font-size: 14px; font-weight: 600; }
.view-debug-directory__note { margin: 0 0 12px; color: var(--color-muted); font-size: 13px; }
.view-debug-directory__entries { margin-top: 20px; }
.view-debug-directory__entry { border-bottom: 1px solid var(--color-border); }
.view-debug-directory__entry > summary { padding: 10px 0; font-size: 13px; font-weight: 600; cursor: pointer; }
.view-debug-directory__entry > summary:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.view-debug-directory__details { padding-bottom: 12px; }
</style>

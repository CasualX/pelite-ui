/** @typedef {(context: PeDocument, headers: PeLite.PeHeaders | undefined) => boolean} ViewAvailability */
/** @typedef {{ id: string, title: string, icon: string, singleton: boolean, sidebarKey?: string, target?: 'tab' | 'window', isAvailable?: ViewAvailability, prepare?: (context: PeDocument, data?: unknown) => ViewContent }} ViewDefinition */
/** @typedef {{ id: string, title: string | undefined, views: ViewDefinition[] }} ViewGroup */
/** @typedef {ViewDefinition & { available: boolean }} ViewMenuEntry */
/** @typedef {{ id: string, title: string | undefined, views: ViewMenuEntry[] }} ViewMenuGroup */

/** Evaluate once per workspace. Implemented views without a check are available.
 * @param {PeDocument} context @returns {ViewMenuGroup[]}
 */
function createWorkspaceViewGroups(context) {
	const result = context.peFile.headers();
	const headers = result instanceof Error ? undefined : result;
	return workspaceViewGroups.map(group => ({
		...group,
		views: group.views.map(view => ({
			...view,
			available: !!view.prepare && (view.isAvailable?.(context, headers) ?? true),
		})),
	}));
}

const peDirectoryIndex = {
	exports: 0,
	imports: 1,
	resources: 2,
	exceptions: 3,
	security: 4,
	baseRelocations: 5,
	debug: 6,
	tls: 9,
	loadConfig: 10,
};

/** @param {number} index @returns {ViewAvailability} */
function createIsDirectoryAvailable(index) {
	return (_context, headers) => !!headers?.DataDirectory[index]?.VirtualAddress;
}

const workspaceIcons = {
	summary: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
	document: 'M6 3h8l4 4v14H6V3ZM14 3v5h4M9 12h6M9 16h6',
	sections: 'M4 4h16v16H4V4ZM4 9h16M9 9v11M4 14h16',
	imports: 'M4 5h7M4 12h16M4 19h7M16 8l4 4-4 4',
	resources: 'm12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9',
	scanner: 'M8 4H4v4M16 4h4v4M4 16v4h4M20 16v4h-4M8 12h8M12 8v8',
};

/** Singleton views reuse the existing instance of their kind. */

/** Root views available from the PE browser. @type {ViewGroup[]} */
const workspaceViewGroups = [
	{ id: 'general', title: undefined, views: [
		{ id: 'summary', title: 'Summary', singleton: true, icon: workspaceIcons.summary, prepare: prepareSummaryView },
	] },
	{ id: 'headers', title: 'Headers', views: [
		{ id: 'dos', title: 'DOS Header', singleton: true, icon: workspaceIcons.document, prepare: prepareDosHeaderView },
		{ id: 'nt', title: 'NT Headers', singleton: true, icon: workspaceIcons.document, prepare: prepareNtHeadersView },
		{ id: 'sections', title: 'Section Headers', singleton: true, icon: workspaceIcons.sections, prepare: context => prepareSectionHeadersView(context) },
		{ id: 'rich', title: 'Rich Structure', singleton: true, icon: workspaceIcons.document, isAvailable: isRichStructureAvailable, prepare: prepareRichStructureView },
		{ id: 'exports', title: 'Exports', singleton: true, icon: workspaceIcons.imports, isAvailable: createIsDirectoryAvailable(peDirectoryIndex.exports), prepare: prepareExportsView },
		{ id: 'imports', title: 'Imports', singleton: true, icon: workspaceIcons.imports, isAvailable: createIsDirectoryAvailable(peDirectoryIndex.imports), prepare: prepareImportsView },
		{ id: 'exceptions', title: 'Exceptions', singleton: true, icon: workspaceIcons.sections, isAvailable: createIsDirectoryAvailable(peDirectoryIndex.exceptions), prepare: prepareExceptionsView },
		{ id: 'security', title: 'Security Directory', singleton: true, icon: workspaceIcons.document, isAvailable: createIsDirectoryAvailable(peDirectoryIndex.security), prepare: prepareSecurityView },
		{ id: 'relocations', title: 'Base Relocations', singleton: true, icon: workspaceIcons.sections, isAvailable: createIsDirectoryAvailable(peDirectoryIndex.baseRelocations), prepare: prepareBaseRelocationsView },
		{ id: 'debug', title: 'Debug Directory', singleton: true, icon: workspaceIcons.document, isAvailable: createIsDirectoryAvailable(peDirectoryIndex.debug), prepare: prepareDebugDirectoryView },
		{ id: 'tls', title: 'TLS Directory', singleton: true, icon: workspaceIcons.document, isAvailable: createIsDirectoryAvailable(peDirectoryIndex.tls), prepare: prepareTlsView },
		{ id: 'load-config', title: 'Load Configuration', singleton: true, icon: workspaceIcons.document, isAvailable: createIsDirectoryAvailable(peDirectoryIndex.loadConfig), prepare: prepareLoadConfigView },
	] },
	{ id: 'resources', title: 'Resources', views: [
		{ id: 'resources', title: 'Resources', singleton: true, icon: workspaceIcons.resources, isAvailable: createIsDirectoryAvailable(peDirectoryIndex.resources), prepare: prepareResourcesView },
		{ id: 'version', title: 'Version Info', singleton: true, icon: workspaceIcons.document, isAvailable: isVersionInfoAvailable, prepare: prepareVersionInfoView },
		{ id: 'manifest', title: 'Manifest', singleton: true, icon: workspaceIcons.document, isAvailable: isManifestAvailable, prepare: prepareManifestView },
		{ id: 'icons-cursors', title: 'Icons & Cursors', singleton: true, icon: workspaceIcons.resources, isAvailable: isIconsCursorsAvailable, prepare: prepareIconsCursorsView },
	] },
	{ id: 'analysis', title: 'Analysis', views: [
		{ id: 'facts', title: 'Facts', singleton: true, icon: workspaceIcons.resources, prepare: prepareFactsView },
		{ id: 'address-converter', title: 'Address Converter', singleton: true, target: 'window', icon: workspaceIcons.imports, prepare: prepareAddressConverterView },
		{ id: 'hex-dump', title: 'Hex Dump', singleton: false, icon: workspaceIcons.sections, prepare: prepareHexDumpView },
		{ id: 'disasm', title: 'Disassembly', singleton: false, icon: workspaceIcons.document, isAvailable: isDisasmAvailable, prepare: prepareDisasmView },
		{ id: 'scanner', title: 'Scanner', singleton: false, icon: workspaceIcons.scanner, prepare: prepareScannerView },
	] },
];

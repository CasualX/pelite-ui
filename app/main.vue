<link rel="component" href="theme.vue.css">
<link rel="component" href="header.vue">
<link rel="component" href="status.vue">
<link rel="component" href="status.vue.js">
<link rel="component" href="splash.vue" dynamic>
<link rel="component" href="input.vue" dynamic>
<link rel="component" href="workspace.vue" dynamic>
<link rel="component" href="pe/document.vue.js">
<link rel="component" href="pe/facts.vue.js">

<script>
"use strict";

/** @import * as PeLite from './deps/pelite.js' */
/** @typedef {{ id: number, document: PeDocument, status: StatusModel }} OpenBinary */

const compactWorkspaceMedia = window.matchMedia('(max-width: 40rem), (orientation: portrait) and (max-width: 64rem)');

const AppMain = Vue.defineComponent({
	template: '#app-main',
	data() {
		return {
			binaries: /** @type {OpenBinary[]} */ ([]),
			activeBinaryId: /** @type {number | null} */ (null),
			inputOpen: false,
			nextBinaryId: 1,
			pelite: /** @type {typeof PeLite | null} */ (null),
			compactWorkspace: compactWorkspaceMedia.matches,
			sidebarOpen: !compactWorkspaceMedia.matches,
			loadingFile: /** @type {string | null} */ (null),
			openError: '',
			disposed: false,
			status: new StatusModel('var(--color-warning)', 'Loading', 'Initializing pelite…'),
		};
	},
	mounted() {
		compactWorkspaceMedia.addEventListener('change', this.syncWorkspaceMode);
		window.addEventListener('beforeunload', this.beforeUnload);
	},
	beforeUnmount() {
		this.disposed = true;
		compactWorkspaceMedia.removeEventListener('change', this.syncWorkspaceMode);
		window.removeEventListener('beforeunload', this.beforeUnload);
		for (const binary of this.binaries) binary.document.dispose();
	},
	watch: {
		/** @param {string} title */
		pageTitle(title) { document.title = title; },
	},
	computed: {
		activeBinary() { return this.binaries.find(binary => binary.id === this.activeBinaryId); },
		binaryTabs() { return this.binaries.map(({ id, document }) => ({ id, name: document.file.name })); },
		showInput() { return this.inputOpen || !this.activeBinary; },
		pageTitle() {
			const name = this.showInput ? undefined : this.activeBinary?.document.file.name;
			return `pelite — ${name || 'Windows PE inspector'}`;
		},
		displayStatus() {
			if (this.loadingFile !== null) return new StatusModel('var(--color-warning)', 'Loading file', this.loadingFile);
			if (this.openError) return new StatusModel('var(--color-danger)', 'Error', this.openError);
			return this.showInput ? this.status : this.activeBinary?.status ?? this.status;
		},
	},
	methods: {
		/** @param {MediaQueryListEvent} event */
		syncWorkspaceMode(event) { this.compactWorkspace = event.matches; },
		toggleSidebar() { this.sidebarOpen = !this.sidebarOpen; },
		/** @param {typeof PeLite} pelite */
		onReady(pelite) {
			this.pelite = Vue.markRaw(pelite);
			this.status = new StatusModel('var(--color-success)', 'Ready', 'Choose a file to get started.');
		},
		openPicker() {
			this.inputOpen = true;
			this.openError = '';
			this.$nextTick(() => this.$refs.input?.focusPicker());
		},
		chooseFiles() {
			if (this.loadingFile !== null) return;
			const input = this.$refs.fileInput;
			if (input instanceof HTMLInputElement) input.click();
		},
		/** @param {Event} event */
		fileChange(event) {
			const input = event.target;
			if (!(input instanceof HTMLInputElement)) return;
			const files = Array.from(input.files ?? []);
			input.value = '';
			this.openFiles(files);
		},
		/** @param {DragEvent} event */
		dropFiles(event) {
			this.openFiles(Array.from(event.dataTransfer?.files ?? []));
		},
		/** @param {File[]} files */
		async openFiles(files) {
			const pelite = this.pelite;
			if (!pelite || this.loadingFile !== null || !files.length) return;
			this.openError = '';
			const sourceId = this.activeBinaryId;
			const startedOnInput = this.showInput;
			let lastOpenedId = null;
			let failures = 0;
			let firstError = '';
			for (const file of files) {
				this.loadingFile = file.name;
				let error = `Unable to read ${file.name}.`;
				try {
					const bytes = new Uint8Array(await file.arrayBuffer());
					if (this.disposed) return;
					error = `${file.name} is not a supported PE file.`;
					const document = new PeDocument(file, bytes, pelite);
					lastOpenedId = this.nextBinaryId++;
					this.binaries.push({ id: lastOpenedId, document,
						status: new StatusModel('var(--color-success)', 'Ready', file.name) });
				} catch {
					if (this.disposed) return;
					failures++;
					if (failures === 1) firstError = error;
				}
			}
			if (lastOpenedId !== null && (this.activeBinaryId === null || (this.activeBinaryId === sourceId && this.showInput === startedOnInput))) {
				this.selectBinary(lastOpenedId);
			}
			this.openError = failures > 1 ? `${failures} files could not be opened. ${firstError}` : firstError;
			this.loadingFile = null;
		},
		/** @param {number} id */
		selectBinary(id) {
			this.activeBinaryId = id;
			this.inputOpen = false;
			this.openError = '';
		},
		/** @param {number} id */
		closeFile(id) {
			const index = this.binaries.findIndex(binary => binary.id === id);
			const binary = this.binaries[index];
			if (!binary) return;
			if (binary.document.dirty && !window.confirm('Facts have unsaved changes. Close the file and discard them? Export individual factmaps to keep your work.')) return;
			this.binaries.splice(index, 1);
			if (id === this.activeBinaryId) {
				this.activeBinaryId = (this.binaries[index] ?? this.binaries[index - 1])?.id ?? null;
				this.openError = '';
			}
			this.$nextTick(() => {
				binary.document.dispose();
				if (this.showInput) this.$refs.input?.focusPicker();
			});
		},
		/** @param {BeforeUnloadEvent} event */
		beforeUnload(event) {
			if (this.binaries.some(binary => binary.document.dirty)) {
				event.preventDefault();
				event.returnValue = '';
			}
		},
	},
});

const app = Vue.createApp({});
app.component('property-grid', PropertyGrid);
app.component('app-header', AppHeader);
app.component('app-status', AppStatus);
app.component('app-splash', AppSplash);
app.component('app-input', AppInput);
app.component('app-workspace', AppWorkspace);
app.component('view-summary', ViewSummary);
app.component('view-headers', ViewHeaders);
app.component('view-section-headers', ViewSectionHeaders);
app.component('view-rich-structure', ViewRichStructure);
app.component('view-exports', ViewExports);
app.component('view-imports', ViewImports);
app.component('view-exceptions', ViewExceptions);
app.component('view-x64-exceptions', ViewX64Exceptions);
app.component('view-security', ViewSecurity);
app.component('view-base-relocations', ViewBaseRelocations);
app.component('view-debug-directory', ViewDebugDirectory);
app.component('view-tls', ViewTls);
app.component('view-load-config', ViewLoadConfig);
app.component('view-manifest', ViewManifest);
app.component('view-version-info', ViewVersionInfo);
app.component('view-resources', ViewResources);
app.component('view-icons-cursors', ViewIconsCursors);
app.component('view-scanner', ViewScanner);
app.component('view-facts', ViewFacts);
app.component('view-address-converter', ViewAddressConverter);
app.component('view-hex-dump', ViewHexDump);
app.component('view-disasm', ViewDisasm);
app.component('app-main', AppMain);
app.mount('#app');
</script>

<template id="app-main">
	<div class="app-main" @dragover.prevent @drop.prevent="dropFiles">
		<app-header :binaries="binaryTabs" :active-id="showInput ? undefined : activeBinaryId" :sidebar-open="sidebarOpen"
			:loading="loadingFile !== null" @select="selectBinary" @open="openPicker" @toggle-sidebar="toggleSidebar" @close="closeFile"></app-header>
		<input v-if="pelite" ref="fileInput" type="file" aria-label="Choose Windows binaries" multiple hidden @change="fileChange">
		<main class="app-main__content">
			<app-splash v-if="!pelite" @ready="onReady" @status="status = $event"></app-splash>
			<app-input v-else-if="showInput" ref="input" :loading="loadingFile !== null" :error="openError"
				@choose="chooseFiles" @files="openFiles" @error="openError = $event"></app-input>
			<app-workspace v-for="binary in binaries" v-show="!showInput && binary.id === activeBinaryId" :key="binary.id"
				:active="!showInput && binary.id === activeBinaryId" :sidebar-id="'pe-view-sidebar-' + binary.id"
				:document="binary.document" :compact="compactWorkspace" :sidebar-open="sidebarOpen"
				@status="binary.status = $event" @show-content="sidebarOpen = false"></app-workspace>
		</main>
		<app-status :model="displayStatus"></app-status>
	</div>
</template>

<style>
* { box-sizing: border-box; scrollbar-width: thin; }
body { margin: 0; background: var(--color-background); color: var(--color-text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
button, input { font: inherit; }
.app-main { --workspace-sidebar-width: 240px; height: 100vh; height: 100dvh; display: flex; flex-direction: column; }
.app-main__content { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: auto; }
</style>

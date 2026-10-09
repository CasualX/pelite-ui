<link rel="component" href="theme.vue.css">
<link rel="component" href="header.vue">
<link rel="component" href="status.vue">
<link rel="component" href="status.vue.js">
<link rel="component" href="splash.vue" dynamic>
<link rel="component" href="input.vue" dynamic>
<link rel="component" href="workspace.vue" dynamic>

<script>
"use strict";

const AppMain = Vue.defineComponent({
	template: '#app-main',
	data() {
		return {
			content: 'app-splash',
			contentKey: 0,
			selectedFile: /** @type {File | null} */ (null),
			peFile: /** @type {import('./deps/pelite.js').PeFile | null} */ (null),
			pelite: /** @type {typeof import('./deps/pelite.js') | null} */ (null),
			status: new StatusModel('var(--color-warning)', 'Loading', 'Initializing pelite…'),
		};
	},
	beforeUnmount() {
		this.peFile?.dispose();
	},
	watch: {
		/** @param {File | null} file */
		selectedFile(file) {
			document.title = `pelite — ${file?.name || 'Windows PE inspector'}`;
		},
	},
	computed: {
		contentProps() {
			if (this.content === 'app-workspace') return { file: this.selectedFile, peFile: this.peFile };
			if (this.content === 'app-input') return { pelite: this.pelite };
			return {};
		},
	},
	methods: {
		/** @param {typeof import('./deps/pelite.js')} pelite */
		onReady(pelite) {
			this.pelite = Vue.markRaw(pelite);
			this.content = 'app-input';
		},
		/** @param {StatusModel} status */
		setStatus(status) {
			this.status = status;
		},
		/** @param {File} file @param {import('./deps/pelite.js').PeFile} peFile */
		launchWorkspace(file, peFile) {
			this.peFile?.dispose();
			this.peFile = Vue.markRaw(peFile);
			this.selectedFile = file;
			this.content = 'app-workspace';
		},
		closeFile() {
			this.peFile?.dispose();
			this.peFile = null;
			this.selectedFile = null;
			this.content = 'app-input';
			this.contentKey++;
			this.status = new StatusModel('var(--color-success)', 'Ready', 'Choose a file to get started.');
			this.$nextTick(() => this.$refs.content?.focusPicker());
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
app.component('workspace-window', WorkspaceWindow);
app.component('workspace-context-menu', WorkspaceContextMenu);
app.component('view-summary', ViewSummary);
app.component('view-dos-header', ViewDosHeader);
app.component('view-nt-headers', ViewNtHeaders);
app.component('view-section-headers', ViewSectionHeaders);
app.component('view-rich-structure', ViewRichStructure);
app.component('view-exports', ViewExports);
app.component('view-imports', ViewImports);
app.component('view-manifest', ViewManifest);
app.component('view-version-info', ViewVersionInfo);
app.component('view-resources', ViewResources);
app.component('view-icons-cursors', ViewIconsCursors);
app.component('view-scanner', ViewScanner);
app.component('view-hex-dump', ViewHexDump);
app.component('view-disasm', ViewDisasm);
app.component('app-sidebar', AppSidebar);
app.component('app-main', AppMain);
app.mount('#app');
</script>

<template id="app-main">
	<div class="app-main" @dragover.prevent @drop.prevent>
		<app-header :filename="selectedFile?.name" @close="closeFile"></app-header>
		<main class="app-main__content">
			<component ref="content" :is="content" :key="contentKey" v-bind="contentProps" @ready="onReady" @status="setStatus" @selected="launchWorkspace"></component>
		</main>
		<app-status :model="status"></app-status>
	</div>
</template>

<style>
* { box-sizing: border-box; }
body { margin: 0; background: var(--color-background); color: var(--color-text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
button, input { font: inherit; }
.app-main { height: 100vh; height: 100dvh; display: flex; flex-direction: column; }
.app-main__content { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: auto; }
</style>

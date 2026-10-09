<link rel="component" href="workspace/sidebar.vue">
<link rel="component" href="workspace/window.vue">
<link rel="component" href="workspace/context-menu.vue">
<link rel="component" href="workspace/views/summary.vue" dynamic>
<link rel="component" href="workspace/views/dos-header.vue" dynamic>
<link rel="component" href="workspace/views/nt-headers.vue" dynamic>
<link rel="component" href="workspace/views/section-headers.vue" dynamic>
<link rel="component" href="workspace/views/rich-structure.vue" dynamic>
<link rel="component" href="workspace/views/exports.vue" dynamic>
<link rel="component" href="workspace/views/imports.vue" dynamic>
<link rel="component" href="workspace/views/manifest.vue" dynamic>
<link rel="component" href="workspace/views/version-info.vue" dynamic>
<link rel="component" href="workspace/views/resources.vue" dynamic>
<link rel="component" href="workspace/views/icons-cursors.vue" dynamic>
<link rel="component" href="workspace/views/scanner.vue" dynamic>
<link rel="component" href="workspace/views/hex-dump.vue" dynamic>
<link rel="component" href="workspace/views/disasm.vue" dynamic>
<link rel="component" href="workspace/browser.vue.js">
<link rel="component" href="workspace/model.vue.js">
<link rel="component" href="status.vue.js">

<script>
const AppWorkspace = Vue.defineComponent({
	template: '#app-workspace',
	props: {
		file: { type: File, required: true },
		peFile: { type: Object, required: true },
	},
	emits: ['status'],
	data() {
		const peFile = /** @type {import('./deps/pelite.js').PeFile} */ (/** @type {unknown} */ (this.peFile));
		return {
			model: new WorkspaceModel(),
			viewGroups: createWorkspaceViewGroups({ file: this.file, peFile }),
			viewError: '',
		};
	},
	computed: {
		activeView() {
			return this.model.views.find(view => view.id === this.model.activeViewId);
		},
	},
	methods: {
		/** @param {string} kind @param {unknown} [data] */
		openView(kind, data) {
			const definition = this.viewGroups.flatMap(group => group.views).find(view => view.id === kind);
			if (!definition?.available) return;
			try {
				const existing = definition.singleton ? this.model.views.find(view => view.kind === kind) : undefined;
				if (existing) {
					this.activateView(existing.id);
					return;
				}
				const peFile = /** @type {import('./deps/pelite.js').PeFile} */ (/** @type {unknown} */ (this.peFile));
				const view = this.model.createView(definition, { file: this.file, peFile }, data);
				this.model.activateView(view.id);
				this.clearViewError();
				// TODO: create and attach a window for view.id.
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.viewError = `Unable to open ${definition.title}: ${message}`;
				this.$emit('status', new StatusModel('var(--color-danger)', 'View failed', this.viewError));
			}
		},
		/** @param {MouseEvent} event */
		addressMenu(event) {
			const peFile = /** @type {import('./deps/pelite.js').PeFile} */ (/** @type {unknown} */ (this.peFile));
			this.$refs.contextMenu.open(event, peFile);
		},
		/** @param {WorkspaceContextAction} request */
		contextAction(request) {
			if (request.action === 'open-view') this.openView(request.viewer, request.data);
		},
		/** @param {number} id */
		activateView(id) {
			if (this.model.activateView(id)) this.clearViewError();
			// TODO: focus the window associated with id.
		},
		/** @param {number} id */
		closeView(id) {
			if (this.model.closeView(id)) this.clearViewError();
			// TODO: close the window associated with id.
		},
		clearViewError() {
			this.viewError = '';
			this.$emit('status', new StatusModel('var(--color-success)', 'Ready', this.file.name));
		},
	},
	mounted() {
		this.openView('summary');
	},
});
</script>

<template id="app-workspace">
	<div class="app-workspace">
		<app-sidebar :open-views="model.views" :view-groups="viewGroups" :active-view-id="model.activeViewId"
			@open-view="openView" @activate-view="activateView" @close-view="closeView"></app-sidebar>
		<div class="app-workspace__windows" aria-label="Workspace" @contextmenu="addressMenu">
			<p v-if="viewError" class="app-workspace__error" role="alert">{{ viewError }}</p>
			<workspace-window v-if="activeView" :title="activeView.displayTitle" @close="closeView(activeView.id)">
				<component :is="activeView.content.component" :key="activeView.id" :data="activeView.content.data" @context-action="contextAction"></component>
			</workspace-window>
			<workspace-context-menu ref="contextMenu" @context-action="contextAction"></workspace-context-menu>
			<!-- TODO: replace the active-view outlet with the window manager. -->
		</div>
	</div>
</template>

<style>
.app-workspace { flex: 1; display: flex; min-width: 0; min-height: 0; }
.app-workspace__windows { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--color-background); }
.app-workspace__error { margin: 0; padding: 12px 20px; border-bottom: 1px solid var(--color-border); color: var(--color-danger); background: var(--color-surface); font-size: 13px; overflow-wrap: anywhere; }
</style>

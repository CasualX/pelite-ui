<link rel="component" href="pe/sidebar.vue">
<link rel="component" href="workspace/area.vue">
<link rel="component" href="pe/context-menu.vue">
<link rel="component" href="pe/views/summary.vue" dynamic>
<link rel="component" href="pe/views/dos-header.vue" dynamic>
<link rel="component" href="pe/views/nt-headers.vue" dynamic>
<link rel="component" href="pe/views/section-headers.vue" dynamic>
<link rel="component" href="pe/views/rich-structure.vue" dynamic>
<link rel="component" href="pe/views/exports.vue" dynamic>
<link rel="component" href="pe/views/imports.vue" dynamic>
<link rel="component" href="pe/views/manifest.vue" dynamic>
<link rel="component" href="pe/views/version-info.vue" dynamic>
<link rel="component" href="pe/views/resources.vue" dynamic>
<link rel="component" href="pe/views/icons-cursors.vue" dynamic>
<link rel="component" href="pe/views/scanner.vue" dynamic>
<link rel="component" href="pe/views/facts.vue" dynamic>
<link rel="component" href="pe/views/hex-dump.vue" dynamic>
<link rel="component" href="pe/views/disasm.vue" dynamic>
<link rel="component" href="pe/browser.vue.js">
<link rel="component" href="pe/model.vue.js">
<link rel="component" href="pe/document.vue.js">
<link rel="component" href="pe/facts.vue.js">
<link rel="component" href="status.vue.js">

<script>
const AppWorkspace = Vue.defineComponent({
	template: '#app-workspace',
	components: { WorkspaceArea, WorkspaceSidebar, PeAddressMenu },
	props: {
		document: { type: Object, required: true },
	},
	emits: ['status'],
	data() {
		const openedDocument = /** @type {PeDocument} */ (/** @type {unknown} */ (this.document));
		return {
			model: new PeWorkspaceModel(),
			viewGroups: createWorkspaceViewGroups(openedDocument),
			viewError: '',
		};
	},
	computed: {
		peDocument() { return /** @type {PeDocument} */ (/** @type {unknown} */ (this.document)); },
		viewTitles() { return this.model.views.map(view => ({ id: view.id, title: view.displayTitle })); },
		viewContent() { return new Map(this.model.views.map(view => [view.id, view.content])); },
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
				this.model.createView(definition, this.peDocument, data);
				this.clearViewError();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.viewError = `Unable to open ${definition.title}: ${message}`;
				this.$emit('status', new StatusModel('var(--color-danger)', 'View failed', this.viewError));
			}
		},
		/** @param {MouseEvent} event */
		addressMenu(event) {
			this.$refs.contextMenu.open(event, this.peDocument);
		},
		/** @param {WorkspaceContextAction} request */
		contextAction(request) {
			if (request.action === 'open-view') this.openView(request.viewer, request.data);
		},
		/** @param {number} id */
		activateView(id) {
			if (this.model.layout.activate(id)) this.clearViewError();
		},
		/** @param {number} id */
		closeView(id) {
			if (this.model.closeView(id)) this.clearViewError();
		},
		canClose() { return !this.peDocument.dirty || window.confirm('Facts have unsaved changes. Close the file and discard them? Export individual factmaps to keep your work.'); },
		/** @param {BeforeUnloadEvent} event */
		beforeUnload(event) { if (this.peDocument.dirty) { event.preventDefault(); event.returnValue = ''; } },
		clearViewError() {
			this.viewError = '';
			this.$emit('status', new StatusModel('var(--color-success)', 'Ready', this.peDocument.file.name));
		},
	},
	mounted() {
		this.openView('summary');
		window.addEventListener('beforeunload', this.beforeUnload);
	},
	beforeUnmount() { window.removeEventListener('beforeunload', this.beforeUnload); },
});
</script>

<template id="app-workspace">
	<div class="app-workspace">
		<workspace-sidebar :open-views="model.views" :view-groups="viewGroups" :active-view-id="model.activeViewId"
			@open-view="openView" @activate-view="activateView" @close-view="closeView"></workspace-sidebar>
		<div class="app-workspace__content">
			<p v-if="viewError" class="app-workspace__error" role="alert">{{ viewError }}</p>
			<workspace-area class="app-workspace__area" :layout="model.layout" :views="viewTitles"
				@close-view="closeView" @contextmenu="addressMenu">
				<template #view="{ id }">
					<component :is="viewContent.get(id).component" :data="viewContent.get(id).data" @context-action="contextAction"></component>
				</template>
			</workspace-area>
			<pe-address-menu ref="contextMenu" @context-action="contextAction"></pe-address-menu>
		</div>
	</div>
</template>

<style>
.app-workspace { flex: 1; display: flex; min-width: 0; min-height: 0; }
.app-workspace__content { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.app-workspace__area {
	--workspace-background: var(--color-background);
	--workspace-surface: var(--color-surface);
	--workspace-text: var(--color-text);
	--workspace-muted: var(--color-muted);
	--workspace-border: var(--color-border);
	--workspace-accent: var(--color-accent);
	--workspace-view-padding: 24px clamp(12px, 4cqi, 32px);
}
.app-workspace__error { margin: 0; padding: 12px 20px; border-bottom: 1px solid var(--color-border); color: var(--color-danger); background: var(--color-surface); font-size: 13px; overflow-wrap: anywhere; }
</style>

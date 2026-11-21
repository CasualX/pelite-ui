<link rel="component" href="pe/sidebar.vue">
<link rel="component" href="workspace/area.vue">
<link rel="component" href="pe/address-menu.vue">
<link rel="component" href="pe/views/summary.vue" dynamic>
<link rel="component" href="pe/views/dos-header.vue" dynamic>
<link rel="component" href="pe/views/nt-headers.vue" dynamic>
<link rel="component" href="pe/views/section-headers.vue" dynamic>
<link rel="component" href="pe/views/rich-structure.vue" dynamic>
<link rel="component" href="pe/views/exports.vue" dynamic>
<link rel="component" href="pe/views/imports.vue" dynamic>
<link rel="component" href="pe/views/exceptions.vue" dynamic>
<link rel="component" href="pe/views/security.vue" dynamic>
<link rel="component" href="pe/views/base-relocations.vue" dynamic>
<link rel="component" href="pe/views/debug-directory.vue" dynamic>
<link rel="component" href="pe/views/tls.vue" dynamic>
<link rel="component" href="pe/views/load-config.vue" dynamic>
<link rel="component" href="pe/views/manifest.vue" dynamic>
<link rel="component" href="pe/views/version-info.vue" dynamic>
<link rel="component" href="pe/views/resources.vue" dynamic>
<link rel="component" href="pe/views/icons-cursors.vue" dynamic>
<link rel="component" href="pe/views/scanner.vue" dynamic>
<link rel="component" href="pe/views/facts.vue" dynamic>
<link rel="component" href="pe/views/address-converter.vue" dynamic>
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
		compact: Boolean,
		sidebarOpen: { type: Boolean, default: true },
	},
	emits: ['status', 'show-content'],
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
		workspaceViews() {
			return this.model.views.map(view => ({
				id: view.id,
				title: view.displayTitle,
				icon: view.icon,
				preferredWindowSize: view.content.preferredWindowSize,
			}));
		},
		viewContent() { return new Map(this.model.views.map(view => [view.id, view.content])); },
	},
	methods: {
		/** @param {string} kind */
		openSidebarView(kind) {
			this.openView(kind);
			this.showWorkspaceContent();
		},
		/** @param {number} id */
		activateSidebarView(id) {
			this.activateView(id);
			this.showWorkspaceContent();
		},
		showWorkspaceContent() {
			if (!this.compact) return;
			this.$emit('show-content');
			this.$refs.area?.focusControl();
		},
		/** @param {string} kind @param {unknown} [data] @param {number} [afterViewId] */
		openView(kind, data, afterViewId) {
			const definition = this.viewGroups.flatMap(group => group.views).find(view => view.id === kind);
			if (!definition?.available) return;
			try {
				const existing = definition.singleton && afterViewId === undefined ? this.model.views.find(view => view.kind === kind) : undefined;
				if (existing) {
					this.activateView(existing.id);
					return;
				}
				this.model.createView(definition, this.peDocument, data, afterViewId);
				this.clearViewError();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.viewError = `Unable to open ${definition.title}: ${message}`;
				this.$emit('status', new StatusModel('var(--color-danger)', 'View failed', this.viewError));
			}
		},
		/** @param {number} id */
		duplicateView(id) {
			const source = this.model.views.find(view => view.id === id);
			if (source) this.openView(source.kind, source.content.duplicateData, source.id);
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
	<div class="app-workspace" :class="{ 'app-workspace--compact': compact, 'app-workspace--sidebar-open': sidebarOpen }">
		<workspace-sidebar id="pe-view-sidebar" :class="{ 'workspace-sidebar--compact': compact }" :inert="!sidebarOpen"
			:open-views="model.views" :view-groups="viewGroups" :active-view-id="model.activeViewId"
			@open-view="openSidebarView" @activate-view="activateSidebarView" @close-view="closeView"></workspace-sidebar>
		<div class="app-workspace__content">
			<p v-if="viewError" class="app-workspace__error" role="alert">{{ viewError }}</p>
			<workspace-area ref="area" class="app-workspace__area" :layout="model.layout" :views="workspaceViews"
				@close-view="closeView" @duplicate-view="duplicateView" @contextmenu="addressMenu">
				<template #view="{ id }">
					<component :is="viewContent.get(id).component" :data="viewContent.get(id).data" @context-action="contextAction"></component>
				</template>
			</workspace-area>
			<pe-address-menu ref="contextMenu" @context-action="contextAction"></pe-address-menu>
		</div>
	</div>
</template>

<style>
@property --workspace-view-inline-padding {
	syntax: '<length>';
	inherits: true;
	initial-value: 0px;
}
.app-workspace { --workspace-sidebar-width: 240px; flex: 1; display: flex; min-width: 0; min-height: 0; overflow: hidden; }
.app-workspace > .workspace-sidebar { flex: 0 0 var(--workspace-sidebar-width); transition: margin-inline-start 180ms ease; }
.app-workspace:not(.app-workspace--sidebar-open) > .workspace-sidebar { margin-inline-start: calc(-1 * var(--workspace-sidebar-width)); }
.app-workspace--compact > .workspace-sidebar { flex-basis: 100%; border-inline-end: 0; transition: none; }
.app-workspace--compact:not(.app-workspace--sidebar-open) > .workspace-sidebar,
.app-workspace--compact.app-workspace--sidebar-open .app-workspace__content { display: none; }
.app-workspace__content { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.app-workspace__area {
	--workspace-background: var(--color-background);
	--workspace-surface: var(--color-surface);
	--workspace-text: var(--color-text);
	--workspace-muted: var(--color-muted);
	--workspace-border: var(--color-border);
	--workspace-accent: var(--color-accent);
}
:where(.app-workspace__area) .workspace-area__view {
	--workspace-view-inline-padding: clamp(12px, 4cqi, 32px);
	--workspace-view-padding: 24px var(--workspace-view-inline-padding);
}
.app-workspace__error { margin: 0; padding: 12px 20px; border-bottom: 1px solid var(--color-border); color: var(--color-danger); background: var(--color-surface); font-size: 13px; overflow-wrap: anywhere; }
@media (prefers-reduced-motion: reduce) {
	.app-workspace > .workspace-sidebar { transition: none; }
}
</style>

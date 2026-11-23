<link rel="component" href="layout.vue.js">
<link rel="component" href="outlet.vue">
<link rel="component" href="pane.vue">
<link rel="component" href="split.vue">
<link rel="component" href="window.vue">

<script>
/** @typedef {{ id: number, title: string, icon?: string, preferredWindowSize?: WorkspaceSize }} WorkspaceViewInfo */
/** @typedef {{ target: string, tab: boolean, visible: boolean }} WorkspaceViewPlacement */

/** Render a reactive WorkspaceLayout with host-provided view info and a `view({ id })` slot.
 * The host handles `close-view` by removing the view and calling `layout.close(id)`.
 * For `duplicate-view`, the host creates a fresh view and calls `layout.open(newId, sourceId)`.
 */
const WorkspaceArea = Vue.defineComponent({
	template: '#workspace-area',
	components: { WorkspaceOutlet, WorkspacePane, WorkspaceSplit, WorkspaceWindow },
	props: {
		layout: { type: WorkspaceLayout, required: true },
		views: { type: /** @type {new () => WorkspaceViewInfo[]} */ (/** @type {unknown} */ (Array)), required: true },
	},
	emits: ['close-view', 'duplicate-view'],
	data() {
		return {
			prefix: `workspace-${Vue.useId()}`,
			outlets: new Map(/** @type {[string, HTMLElement][]} */ ([])),
			mountedViews: new Set(/** @type {number[]} */ ([])),
			renderedLayout: Vue.markRaw(/** @type {{ root?: WorkspaceNode, placements?: Map<number, WorkspaceViewPlacement> }} */ ({})),
			scrollPositions: Vue.markRaw(new Map(/** @type {[number, { left: number, top: number }][]} */ ([]))),
			areaSize: { width: 0, height: 0 },
			resizeObserver: /** @type {ResizeObserver | null} */ (null),
		};
	},
	computed: {
		viewsById() { return new Map(this.views.map(view => [view.id, view])); },
		tabDragType() { return `application/x-workspace-tab-${this.prefix.toLowerCase()}`; },
		placements() {
			const placements = new Map(/** @type {[number, WorkspaceViewPlacement][]} */ ([]));
			for (const pane of this.layout.panes) {
				for (const id of pane.tabs) placements.set(id, { target: `pane-${pane.id}`, tab: true, visible: pane.selected === id });
			}
			for (const { viewId } of this.layout.windows) placements.set(viewId, { target: `window-${viewId}`, tab: false, visible: true });
			return placements;
		},
	},
	mounted() {
		const area = /** @type {HTMLElement} */ (this.$el);
		this.resizeObserver = new ResizeObserver(() => {
			this.areaSize = { width: area.clientWidth, height: area.clientHeight };
		});
		this.resizeObserver.observe(area);
		this.areaSize = { width: area.clientWidth, height: area.clientHeight };
		this.rememberLayout();
	},
	beforeUpdate() {
		// Snapshot before a split or window can detach the current outlet.
		const { root, placements } = this.renderedLayout;
		for (const [id, previous] of placements ?? []) {
			const next = this.placements.get(id);
			if (!previous.visible || !next || this.scrollPositions.has(id)) continue;
			if (root === this.layout.root && previous.target === next.target && next.visible) continue;
			const panel = this.panelFor(id);
			if (panel) this.scrollPositions.set(id, { left: panel.scrollLeft, top: panel.scrollTop });
		}
		this.rememberLayout();
	},
	updated() {
		for (const [id, position] of this.scrollPositions) {
			const placement = this.placements.get(id);
			if (!placement) {
				this.scrollPositions.delete(id);
			} else if (placement.visible) {
				const panel = this.panelFor(id);
				if (panel && panel.parentElement === this.outletFor(id)) {
					panel.scrollLeft = position.left;
					panel.scrollTop = position.top;
					this.scrollPositions.delete(id);
				}
			}
		}
	},
	beforeUnmount() { this.resizeObserver?.disconnect(); },
	methods: {
		rememberLayout() {
			this.renderedLayout.root = this.layout.root;
			this.renderedLayout.placements = this.placements;
		},
		/** @param {number} id @returns {HTMLElement | null} */
		panelFor(id) { return this.$el.ownerDocument.getElementById(`${this.prefix}-panel-${id}`); },
		/** @param {string} key @param {HTMLElement} element */
		registerOutlet(key, element) { this.outlets.set(key, element); },
		/** @param {string} key @param {HTMLElement} element */
		unregisterOutlet(key, element) {
			if (this.outlets.get(key) === element) this.outlets.delete(key);
		},
		/** @param {number} id */
		outletFor(id) { return this.outlets.get(this.placements.get(id)?.target ?? ''); },
		/** @param {WorkspaceBounds} bounds */
		boundWindow(bounds) { return boundWorkspaceWindow(bounds, this.areaSize); },
		/** @param {WorkspaceFloatingWindow} floating @param {WorkspaceBounds} bounds @param {'move' | 'resize'} action */
		updateBounds(floating, bounds, action) {
			if (action === 'resize') {
				bounds.width = Math.min(bounds.width, this.areaSize.width - bounds.x);
				bounds.height = Math.min(bounds.height, this.areaSize.height - bounds.y);
			}
			floating.bounds = this.boundWindow(bounds);
		},
		focusControl() {
			this.$nextTick(() => {
				const { focused, activeViewId } = this.layout;
				const key = focused.type === 'window' ? `window-${focused.id}`
					: activeViewId === undefined ? `pane-${focused.id}` : `tab-${activeViewId}`;
				this.$el.ownerDocument.getElementById(`${this.prefix}-${key}`)?.focus({ preventScroll: true });
			});
		},
		/** @param {number} paneId @param {number} viewId @param {WorkspaceDirection} direction */
		splitPane(paneId, viewId, direction) { if (this.layout.split(paneId, direction, viewId)) this.focusControl(); },
		/** @param {number} paneId @param {number} viewId @param {number} index */
		moveTab(paneId, viewId, index) { if (this.layout.moveTab(viewId, paneId, index)) this.focusControl(); },
		/** @param {DragEvent} event */
		rejectTabDrop(event) {
			const transfer = event.dataTransfer;
			if (!transfer?.types.includes(this.tabDragType)) return;
			transfer.dropEffect = 'none';
			event.stopPropagation();
		},
		/** @param {number} id */
		floatView(id) {
			const size = this.viewsById.get(id)?.preferredWindowSize;
			if (this.layout.float(id, size)) this.focusControl();
		},
		/** @param {number} id */
		dockView(id) { if (this.layout.dock(id)) this.focusControl(); },
		/** @param {number} id */
		closePane(id) { if (this.layout.closeEmptyPane(id)) this.focusControl(); },
		/** @param {number} id */
		requestDuplicate(id) {
			this.$emit('duplicate-view', id);
			this.focusControl();
		},
		/** @param {number} id */
		requestClose(id) {
			this.$emit('close-view', id);
			this.focusControl();
		},
	},
});
</script>

<template id="workspace-area">
	<section class="workspace-area" aria-label="Workspace" @dragover="rejectTabDrop">
		<div class="workspace-area__docked">
			<workspace-split :node="layout.root" v-slot="{ pane }">
				<workspace-pane :pane="pane" :views-by-id="viewsById" :prefix="prefix" :tab-drag-type="tabDragType" :can-close="layout.root.type === 'split'"
					:focused="layout.focused.type === 'pane' && layout.focused.id === pane.id" @focus-pane="layout.focusPane(pane.id)"
					@select="layout.activate($event)" @close="requestClose" @split="(id, direction) => splitPane(pane.id, id, direction)"
					@move-tab="(id, index) => moveTab(pane.id, id, index)" @duplicate="requestDuplicate"
					@float="floatView" @close-pane="closePane(pane.id)">
					<workspace-outlet :key="pane.id" :target="'pane-' + pane.id" @register="registerOutlet" @unregister="unregisterOutlet"></workspace-outlet>
				</workspace-pane>
			</workspace-split>
		</div>
		<workspace-window v-for="floating in layout.windows" :key="floating.viewId" :id="prefix + '-window-' + floating.viewId"
			:title="viewsById.get(floating.viewId)?.title ?? ''" :layer="floating.layer" :bounds="boundWindow(floating.bounds)"
			:focused="layout.focused.type === 'window' && layout.focused.id === floating.viewId"
			@focus-window="layout.focusWindow(floating)" @bounds="(bounds, action) => updateBounds(floating, bounds, action)"
			@dock="dockView(floating.viewId)" @close="requestClose(floating.viewId)">
			<workspace-outlet :target="'window-' + floating.viewId" @register="registerOutlet" @unregister="unregisterOutlet"></workspace-outlet>
		</workspace-window>
		<div hidden>
			<!-- Mount each slot when first shown and keep it mounted as its placement changes. -->
			<teleport v-for="view in views" :key="view.id" :to="outletFor(view.id)" :disabled="!outletFor(view.id)">
				<div v-if="mountedViews.has(view.id) || (outletFor(view.id) && placements.get(view.id)?.visible)"
					v-show="placements.get(view.id)?.visible" class="workspace-area__view" :id="prefix + '-panel-' + view.id"
					:role="placements.get(view.id)?.tab ? 'tabpanel' : undefined" :tabindex="placements.get(view.id)?.tab ? 0 : undefined"
					:aria-labelledby="placements.get(view.id)?.tab ? prefix + '-tab-' + view.id : undefined"
					@vue:mounted="mountedViews.add(view.id)" @vue:unmounted="mountedViews.delete(view.id)">
					<slot name="view" :id="view.id"></slot>
				</div>
			</teleport>
		</div>
	</section>
</template>

<style>
:where(.workspace-area) {
	--workspace-background: Canvas;
	--workspace-surface: ButtonFace;
	--workspace-text: CanvasText;
	--workspace-muted: GrayText;
	--workspace-border: color-mix(in srgb, CanvasText 24%, Canvas);
	--workspace-accent: Highlight;
}
.workspace-area { position: relative; isolation: isolate; display: flex; flex: 1; min-width: 0; min-height: 0; overflow: hidden; background: var(--workspace-background); color: var(--workspace-text); }
.workspace-area__docked { position: relative; z-index: 0; display: flex; flex: 1; min-width: 0; min-height: 0; }
.workspace-area__outlet { container-type: inline-size; display: flex; flex: 1; flex-direction: column; min-width: 0; min-height: 0; }
.workspace-area__view { flex: 1; min-width: 0; min-height: 0; overflow: auto; }
.workspace-area__view:focus-visible, .workspace-control:focus-visible { outline: 2px solid var(--workspace-accent); outline-offset: -2px; }
.workspace-control { min-width: 24px; height: 24px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--workspace-muted); font: 17px/1 system-ui, sans-serif; cursor: pointer; }
.workspace-control:hover { background: var(--workspace-border); color: var(--workspace-text); }
</style>

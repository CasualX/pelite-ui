<link rel="component" href="layout.vue.js">
<link rel="component" href="tab-bar.vue">

<script>
const WorkspacePane = Vue.defineComponent({
	template: '#workspace-pane',
	components: { WorkspaceTabBar },
	props: {
		pane: { type: /** @type {new () => WorkspacePaneNode} */ (/** @type {unknown} */ (Object)), required: true },
		titles: { type: /** @type {new () => ReadonlyMap<number, string>} */ (/** @type {unknown} */ (Object)), required: true },
		prefix: { type: String, required: true },
		tabDragType: { type: String, required: true },
		focused: Boolean,
		canClose: Boolean,
	},
	emits: ['focus-pane', 'select', 'close', 'split', 'float', 'close-pane', 'move-tab'],
	computed: {
		paneId() { return `${this.prefix}-pane-${this.pane.id}`; },
	},
});
</script>

<template id="workspace-pane">
	<section :id="paneId" class="workspace-pane" :class="{ 'workspace-pane--focused': focused }" aria-label="Pane"
		:tabindex="pane.tabs.length ? -1 : 0" @pointerdown.capture="$emit('focus-pane')" @focusin="$emit('focus-pane')">
		<div v-if="pane.tabs.length" class="workspace-pane__bar">
			<workspace-tab-bar :tabs="pane.tabs" :selected="pane.selected" :titles="titles" :prefix="prefix" :tab-drag-type="tabDragType"
				@select="$emit('select', $event)" @close="$emit('close', $event)"
				@move-tab="(id, index) => $emit('move-tab', id, index)"
				@split="(id, direction) => $emit('split', id, direction)" @float="$emit('float', $event)"></workspace-tab-bar>
		</div>
		<template v-else>
			<p class="workspace-pane__empty">No views open</p>
			<button v-if="canClose" class="workspace-control workspace-pane__close" type="button" aria-label="Close empty pane" title="Close empty pane"
				@click="$emit('close-pane')">×</button>
		</template>
		<slot></slot>
	</section>
</template>

<style>
.workspace-pane { display: flex; flex: 1; flex-direction: column; position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.workspace-pane:focus-visible { outline: 2px solid var(--workspace-accent); outline-offset: -2px; }
.workspace-pane__bar { display: flex; flex: 0 0 36px; min-width: 0; border-bottom: 1px solid var(--workspace-border); background: var(--workspace-surface); color: var(--workspace-muted); font-size: 12px; user-select: none; }
.workspace-pane__empty { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; color: var(--workspace-muted); text-align: center; font-size: 13px; pointer-events: none; }
.workspace-pane__close { position: absolute; inset-block-start: 6px; inset-inline-end: 4px; }
</style>

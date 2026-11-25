<link rel="component" href="layout.vue.js">
<link rel="component" href="pointer.vue.js">

<script>
const WorkspaceWindow = Vue.defineComponent({
	template: '#workspace-window',
	props: {
		title: { type: String, required: true },
		bounds: { type: /** @type {new () => WorkspaceBounds} */ (/** @type {unknown} */ (Object)), required: true },
		layer: { type: Number, required: true },
		focused: Boolean,
	},
	emits: ['focus-window', 'bounds', 'dock', 'close'],
	data() {
		return { resizeEdges: /** @type {WorkspaceResizeEdge[]} */ (['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']) };
	},
	computed: {
		position() {
			const { x, y, width, height } = this.bounds;
			return { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`, zIndex: this.layer };
		},
	},
	methods: {
		/** @param {PointerEvent} event @param {WorkspaceWindowAction} action */
		drag(event, action) {
			if (action === 'move' && event.target instanceof Element && event.target.closest('button')) return;
			if (event.button !== 0 || !event.isPrimary) return;
			(action === 'move' ? this.$el : this.$refs.resize).focus({ preventScroll: true });
			const start = this.bounds;
			trackWorkspacePointer(event, (dx, dy) => this.$emit('bounds', start, action, dx, dy));
		},
		/** @param {KeyboardEvent} event @param {WorkspaceWindowAction} action */
		keyMove(event, action) {
			const step = event.shiftKey ? 1 : 10;
			let dx = 0, dy = 0;
			switch (event.key) {
				case 'ArrowLeft': dx = -step; break;
				case 'ArrowRight': dx = step; break;
				case 'ArrowUp': dy = -step; break;
				case 'ArrowDown': dy = step; break;
				default: return;
			}
			event.preventDefault();
			this.$emit('bounds', this.bounds, action, dx, dy);
		},
	},
});
</script>

<template id="workspace-window">
	<section class="workspace-window" :class="{ 'workspace-window--focused': focused }" :style="position"
		role="dialog" :aria-label="title" tabindex="0" @pointerdown.capture="$emit('focus-window')" @focusin="$emit('focus-window')"
		@keydown.self="keyMove($event, 'move')">
		<div class="workspace-window__frame">
			<header class="workspace-window__header" @pointerdown="drag($event, 'move')">
				<h2 class="workspace-window__title" :title="title">{{ title }}</h2>
				<button class="workspace-control workspace-window__dock" type="button" :aria-label="'Dock ' + title" @click="$emit('dock')">Dock</button>
				<button class="workspace-control workspace-window__close" type="button" :aria-label="'Close ' + title" @click="$emit('close')"></button>
			</header>
			<slot></slot>
		</div>
		<div ref="resize" class="workspace-window__resize" role="group" tabindex="0" aria-label="Resize window with arrow keys"
			@keydown.self="keyMove($event, 'se')">
			<div v-for="edge in resizeEdges" :key="edge" :data-edge="edge" :style="{ gridArea: edge }" @pointerdown="drag($event, edge)"></div>
		</div>
	</section>
</template>

<style>
.workspace-window { position: absolute; box-shadow: 0 0 6px #0004, 0 4px 12px #0006; }
.workspace-window__frame { box-sizing: border-box; display: flex; flex-direction: column; height: 100%; overflow: hidden; border: 1px solid var(--workspace-border); background: var(--workspace-background); }
.workspace-window--focused > .workspace-window__frame { border-color: var(--workspace-accent); }
.workspace-window:focus-visible { outline: 2px solid var(--workspace-accent); outline-offset: -2px; }
.workspace-window__header { display: flex; align-items: center; gap: 4px; flex: 0 0 35px; min-width: 0; padding: 0 4px 0 12px; border-bottom: 1px solid var(--workspace-border); background: var(--workspace-surface); cursor: move; touch-action: none; user-select: none; }
.workspace-window__title { flex: 1; min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; }
.workspace-window__dock { padding-left: 6px; padding-right: 6px; font-size: 12px; }
.workspace-window__close { display: grid; place-items: center; }
.workspace-window__close::before, .workspace-window__close::after { content: ''; grid-area: 1 / 1; width: 9px; border-top: 1px solid currentColor; translate: 0 -1px; }
.workspace-window__close::before { transform: rotate(45deg); }
.workspace-window__close::after { transform: rotate(-45deg); }
.workspace-window__resize {
	--resize-strip: 6px;
	position: absolute;
	inset: calc(1px - var(--resize-strip));
	display: grid;
	grid-template: 'nw n ne' 14px 'w . e' minmax(0, 1fr) 'sw s se' 14px / 14px minmax(0, 1fr) 14px;
	pointer-events: none;
}
.workspace-window__resize > div { pointer-events: auto; touch-action: none; }
.workspace-window__resize > :is([data-edge="n"], [data-edge="s"]) { height: var(--resize-strip); cursor: ns-resize; }
.workspace-window__resize > :is([data-edge="w"], [data-edge="e"]) { width: var(--resize-strip); cursor: ew-resize; }
.workspace-window__resize > [data-edge="s"] { align-self: end; }
.workspace-window__resize > [data-edge="e"] { justify-self: end; }
/* Extend corner targets along both borders while leaving the interior clear. */
.workspace-window__resize > :is([data-edge="nw"], [data-edge="ne"], [data-edge="se"], [data-edge="sw"]) {
	clip-path: polygon(0 0, 100% 0, 100% var(--resize-strip), var(--resize-strip) var(--resize-strip), var(--resize-strip) 100%, 0 100%);
}
.workspace-window__resize > :is([data-edge="nw"], [data-edge="se"]) { cursor: nwse-resize; }
.workspace-window__resize > :is([data-edge="ne"], [data-edge="sw"]) { cursor: nesw-resize; }
.workspace-window__resize > [data-edge="ne"] { rotate: 90deg; }
.workspace-window__resize > [data-edge="se"] { rotate: 180deg; }
.workspace-window__resize > [data-edge="sw"] { rotate: 270deg; }
.workspace-window:has(> .workspace-window__resize:focus-visible) { outline: 2px dashed var(--workspace-accent); outline-offset: -2px; }
</style>

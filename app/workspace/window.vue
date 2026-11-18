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
	computed: {
		position() {
			const { x, y, width, height } = this.bounds;
			return { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`, zIndex: this.layer };
		},
	},
	methods: {
		/** @param {PointerEvent} event @param {'move' | 'resize'} action */
		drag(event, action) {
			if (action === 'move' && event.target instanceof Element && event.target.closest('button')) return;
			if (event.button !== 0 || !event.isPrimary) return;
			(action === 'move' ? this.$el : this.$refs.resize).focus({ preventScroll: true });
			const { x, y, width, height } = this.bounds;
			trackWorkspacePointer(event, (dx, dy) => {
				this.$emit('bounds', action === 'move'
					? { x: x + dx, y: y + dy, width, height }
					: { x, y, width: width + dx, height: height + dy }, action);
			});
		},
		/** @param {KeyboardEvent} event @param {'move' | 'resize'} action */
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
			const { x, y, width, height } = this.bounds;
			this.$emit('bounds', action === 'move'
				? { x: x + dx, y: y + dy, width, height }
				: { x, y, width: width + dx, height: height + dy }, action);
		},
	},
});
</script>

<template id="workspace-window">
	<section class="workspace-window" :class="{ 'workspace-window--focused': focused }" :style="position"
		role="dialog" :aria-label="title" tabindex="0" @pointerdown.capture="$emit('focus-window')" @focusin="$emit('focus-window')"
		@keydown.self="keyMove($event, 'move')">
		<header class="workspace-window__header" @pointerdown="drag($event, 'move')">
			<h2 class="workspace-window__title" :title="title">{{ title }}</h2>
			<button class="workspace-control workspace-window__dock" type="button" :aria-label="'Dock ' + title" @click="$emit('dock')">Dock</button>
			<button class="workspace-control workspace-window__close" type="button" :aria-label="'Close ' + title" @click="$emit('close')"></button>
		</header>
		<slot></slot>
		<div ref="resize" class="workspace-window__resize" role="group" tabindex="0" aria-label="Resize window with arrow keys"
			@pointerdown="drag($event, 'resize')" @keydown="keyMove($event, 'resize')"></div>
	</section>
</template>

<style>
.workspace-window { box-sizing: border-box; position: absolute; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--workspace-border); background: var(--workspace-background); box-shadow: 0 0 6px #0004, 0 4px 12px #0006; }
.workspace-window--focused { border-color: var(--workspace-accent); }
.workspace-window:focus-visible { outline: 2px solid var(--workspace-accent); outline-offset: -2px; }
.workspace-window__header { display: flex; align-items: center; gap: 4px; flex: 0 0 35px; min-width: 0; padding: 0 4px 0 12px; border-bottom: 1px solid var(--workspace-border); background: var(--workspace-surface); cursor: move; touch-action: none; user-select: none; }
.workspace-window__title { flex: 1; min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; }
.workspace-window__dock { padding-inline: 6px; font-size: 12px; }
.workspace-window__close { display: grid; place-items: center; }
.workspace-window__close::before, .workspace-window__close::after { content: ''; grid-area: 1 / 1; width: 9px; border-top: 1px solid currentColor; translate: 0 -1px; }
.workspace-window__close::before { transform: rotate(45deg); }
.workspace-window__close::after { transform: rotate(-45deg); }
.workspace-window__resize { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; touch-action: none; }
.workspace-window__resize::after { content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px; border-right: 2px solid var(--workspace-muted); border-bottom: 2px solid var(--workspace-muted); pointer-events: none; }
.workspace-window__resize:focus-visible { outline: 2px solid var(--workspace-accent); outline-offset: -2px; }
</style>

<link rel="component" href="layout.vue.js">
<link rel="component" href="pointer.vue.js">

<script>
const WorkspaceSplitter = Vue.defineComponent({
	template: '#workspace-splitter',
	props: {
		direction: { type: String, required: true },
		ratio: { type: Number, required: true },
	},
	emits: ['resize'],
	methods: {
		/** @param {number} ratio */
		resize(ratio) { this.$emit('resize', clampWorkspaceValue(ratio, 0.15, 0.85)); },
		/** @param {PointerEvent} event */
		drag(event) {
			const control = /** @type {HTMLElement} */ (event.currentTarget);
			const parent = control.parentElement;
			if (!parent) return;
			const row = this.direction === 'row';
			const size = row ? parent.clientWidth - control.offsetWidth : parent.clientHeight - control.offsetHeight;
			if (size <= 0) return;
			control.focus();
			const start = this.ratio;
			trackWorkspacePointer(event, (dx, dy) => this.resize(start + (row ? dx : dy) / size));
		},
		/** @param {KeyboardEvent} event */
		keyResize(event) {
			const keys = this.direction === 'row' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
			switch (event.key) {
				case 'Home': this.resize(0.15); break;
				case 'End': this.resize(0.85); break;
				case keys[0]: this.resize(this.ratio - 0.05); break;
				case keys[1]: this.resize(this.ratio + 0.05); break;
				default: return;
			}
			event.preventDefault();
		},
	},
});
</script>

<template id="workspace-splitter">
	<div class="workspace-splitter" role="separator" tabindex="0" aria-label="Resize split"
		:aria-orientation="direction === 'row' ? 'vertical' : 'horizontal'" aria-valuemin="15" aria-valuemax="85"
		:aria-valuenow="Math.round(ratio * 100)" @pointerdown="drag" @keydown="keyResize"></div>
</template>

<style>
.workspace-splitter { background: var(--workspace-border); touch-action: none; }
.workspace-splitter[aria-orientation="vertical"] { cursor: col-resize; }
.workspace-splitter[aria-orientation="horizontal"] { cursor: row-resize; }
.workspace-splitter:hover, .workspace-splitter:focus-visible { outline: none; background: var(--workspace-accent); }
</style>

<script>
// Temporary frame until the workspace has a window manager.
const WorkspaceWindow = Vue.defineComponent({
	template: '#workspace-window',
	props: { title: { type: String, required: true } },
	emits: ['close'],
});
</script>

<template id="workspace-window">
	<section class="workspace-window" :aria-label="title">
		<header class="workspace-window__header">
			<h1 class="workspace-window__title">{{ title }}</h1>
			<button class="workspace-window__close" type="button" :aria-label="`Close ${title}`" @click="$emit('close')">×</button>
		</header>
		<div class="workspace-window__content"><slot></slot></div>
	</section>
</template>

<style>
.workspace-window { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.workspace-window__header { display: flex; align-items: center; gap: 16px; height: 36px; flex-shrink: 0; padding: 0 12px 0 20px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); user-select: none; }
.workspace-window__title { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; }
.workspace-window__close { margin-left: auto; width: 26px; height: 26px; flex-shrink: 0; border: 0; border-radius: 3px; background: transparent; color: var(--color-muted); font-size: 20px; cursor: pointer; }
.workspace-window__close:hover { background: var(--color-background); color: var(--color-text); }
.workspace-window__close:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.workspace-window__content { padding: 28px 32px; flex: 1; min-height: 0; overflow: auto; }
</style>

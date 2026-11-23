<link rel="component" href="status.vue.js">

<script>
const AppStatus = Vue.defineComponent({
	template: '#app-status',
	props: {
		model: { type: StatusModel, required: true },
	},
});
</script>

<template id="app-status">
	<footer class="app-status">
		<div class="app-status__message" role="status" aria-live="polite" aria-atomic="true">
			<span class="app-status__dot" :style="{ backgroundColor: model.color }" aria-hidden="true"></span>
			<span class="app-status__text">{{ model.text }}</span>
			<span v-if="model.message" class="app-status__hint">{{ model.message }}</span>
		</div>
		<a class="app-status__github" href="https://github.com/CasualX/pelite-ui" target="_blank" rel="noopener noreferrer">
			GitHub
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</a>
	</footer>
</template>

<style>
.app-status { display: flex; align-items: center; gap: 9px; min-height: 30px; padding: 7px 20px; border-top: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); font-size: 11px; }
.app-status__message { display: flex; align-items: center; gap: 9px; min-width: 0; }
.app-status__dot { flex-shrink: 0; width: 6px; height: 6px; border-radius: 50%; }
.app-status__text { flex-shrink: 0; }
.app-status__hint { min-width: 0; overflow-wrap: anywhere; margin-left: 5px; padding-left: 14px; border-left: 1px solid var(--color-border); color: var(--color-muted); }
.app-status__github { display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; margin-left: auto; color: var(--color-muted); text-decoration: none; }
.app-status__github:hover { color: var(--color-accent-hover); }
.app-status__github:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; border-radius: 2px; }
@media (max-width: 440px) {
	.app-status { padding: 7px 14px; gap: 7px; }
	.app-status__message { gap: 7px; }
	.app-status__hint { margin-left: 2px; padding-left: 9px; }
}
</style>

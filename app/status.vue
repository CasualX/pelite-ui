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
	<footer class="app-status" role="status" aria-live="polite" aria-atomic="true">
		<span class="app-status__dot" :style="{ backgroundColor: model.color }" aria-hidden="true"></span>
		<span class="app-status__text">{{ model.text }}</span>
		<span v-if="model.message" class="app-status__hint">{{ model.message }}</span>
	</footer>
</template>

<style>
.app-status { display: flex; align-items: center; gap: 9px; min-height: 30px; padding: 7px 20px; border-top: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); font-size: 11px; }
.app-status__dot { flex-shrink: 0; width: 6px; height: 6px; border-radius: 50%; }
.app-status__text { flex-shrink: 0; }
.app-status__hint { min-width: 0; overflow-wrap: anywhere; margin-left: 5px; padding-left: 14px; border-left: 1px solid var(--color-border); color: var(--color-muted); }
@media (max-width: 440px) {
	.app-status { padding: 7px 14px; gap: 7px; }
	.app-status__hint { margin-left: 2px; padding-left: 9px; }
}
</style>

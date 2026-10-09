<link rel="component" href="status.vue.js">

<script>
const AppSplash = Vue.defineComponent({
	template: '#app-splash',
	emits: ['status', 'ready'],
	data() {
		return { error: '' };
	},
	async mounted() {
		this.$emit('status', new StatusModel('var(--color-warning)', 'Loading', 'Initializing pelite…'));
		try {
			const pelite = await import('./deps/pelite.js');
			this.$emit('ready', pelite);
		} catch (error) {
			this.error = 'Unable to load pelite. Reload the page to try again.';
			this.$emit('status', new StatusModel('var(--color-danger)', 'Load failed', this.error));
			console.error('Failed to initialize pelite:', error);
		}
	},
	methods: {
		reload() {
			window.location.reload();
		},
	},
});
</script>

<template id="app-splash">
	<section class="app-splash" :aria-busy="!error" aria-labelledby="splash-title">
		<div v-if="!error" class="app-splash__spinner" aria-hidden="true"></div>
		<h1 id="splash-title">{{ error ? 'Unable to start pelite' : 'Loading pelite…' }}</h1>
		<p>{{ error || 'Preparing the PE inspector.' }}</p>
		<button v-if="error" class="app-splash__reload" type="button" @click="reload">Reload page</button>
	</section>
</template>

<style>
.app-splash { width: min(100%, 760px); margin: auto; padding: 40px 28px; text-align: center; }
.app-splash h1 { margin: 20px 0 12px; color: var(--color-text); font-size: 22px; font-weight: 600; }
.app-splash p { margin: 0; color: var(--color-muted); font-size: 14px; line-height: 1.6; }
.app-splash__spinner { width: 28px; height: 28px; margin: auto; border: 3px solid var(--color-border); border-top-color: var(--color-accent); border-radius: 50%; animation: app-splash-spin .8s linear infinite; }
.app-splash__reload { margin-top: 24px; padding: 10px 20px; border: 1px solid var(--color-accent-hover); border-radius: 6px; background: var(--color-accent); color: var(--color-on-accent); cursor: pointer; }
.app-splash__reload:hover { background: var(--color-accent-hover); }
.app-splash__reload:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 4px; }
@keyframes app-splash-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .app-splash__spinner { animation: none; } }
</style>

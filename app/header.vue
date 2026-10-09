<script>
const AppHeader = Vue.defineComponent({
	template: '#app-header',
	props: {
		filename: { type: String },
	},
	emits: ['close'],
});
</script>

<template id="app-header">
	<header class="app-header">
		<div class="app-header__brand">
			<span class="app-header__logo" aria-hidden="true">PE</span>
			<span class="app-header__name">pelite</span>
		</div>
		<div v-if="filename" class="app-header__file">
			<span class="app-header__filename" :title="filename">{{ filename }}</span>
			<button class="app-header__close" type="button" :aria-label="'Close ' + filename" title="Close file" @click="$emit('close')">
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
			</button>
		</div>
		<span v-else class="app-header__tagline">Windows PE inspector</span>
		<a class="app-header__github" href="https://github.com/CasualX/pelite-ui" target="_blank" rel="noopener noreferrer">
			GitHub
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</a>
	</header>
</template>

<style>
.app-header { display: flex; align-items: center; gap: 18px; min-height: 44px; padding: 8px 20px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); }
.app-header__brand { flex-shrink: 0; display: flex; align-items: center; gap: 9px; user-select: none; }
.app-header__logo { display: grid; place-items: center; width: 24px; height: 26px; border-radius: 3px 6px 3px 3px; background: var(--color-accent); color: var(--color-on-accent); font-size: 11px; font-weight: 700; }
.app-header__name { color: var(--color-text); font-size: 18px; font-weight: 700; letter-spacing: -.6px; }
.app-header__tagline { color: var(--color-muted); font-size: 12px; }
.app-header__github { flex-shrink: 0; display: inline-flex; align-items: center; gap: 7px; margin-left: auto; padding: 4px 0; color: var(--color-muted); font-size: 12px; text-decoration: none; user-select: none; }
.app-header__file { display: flex; align-items: center; gap: 6px; min-width: 0; max-width: 480px; padding-left: 18px; border-left: 1px solid var(--color-border); }
.app-header__filename { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text); font-size: 12px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.app-header__close { display: grid; place-items: center; flex-shrink: 0; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--color-muted); cursor: pointer; }
.app-header__close:hover { background: var(--color-border); color: var(--color-text); }
.app-header__close:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.app-header__github:hover { color: var(--color-accent-hover); }
.app-header__github:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 4px; border-radius: 2px; }
@media (max-width: 440px) {
	.app-header { padding: 8px 14px; gap: 12px; }
	.app-header__tagline { font-size: 11px; }
	.app-header__file { padding-left: 12px; }
}
</style>

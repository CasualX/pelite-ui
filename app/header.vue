<script>
/** @typedef {{ id: number, name: string }} BinaryTab */

const AppHeader = Vue.defineComponent({
	template: '#app-header',
	props: {
		binaries: { type: /** @type {new () => BinaryTab[]} */ (/** @type {unknown} */ (Array)), required: true },
		activeId: Number,
		sidebarOpen: Boolean,
		loading: Boolean,
	},
	emits: ['select', 'open', 'close', 'toggle-sidebar'],
	watch: {
		activeId() {
			this.$nextTick(() => this.$el.querySelector('.app-header__tab--active')
				?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
		},
	},
	methods: {
		/** @param {WheelEvent} event */
		scrollTabs(event) {
			const { deltaMode, deltaX, deltaY, ctrlKey } = event;
			if (ctrlKey || deltaX || !deltaY) return;
			const strip = /** @type {HTMLElement} */ (event.currentTarget);
			if (strip.scrollWidth <= strip.clientWidth) return;
			const start = strip.scrollLeft;
			const unit = deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
				: deltaMode === WheelEvent.DOM_DELTA_PAGE ? strip.clientWidth : 1;
			strip.scrollLeft += deltaY * unit;
			if (strip.scrollLeft !== start) event.preventDefault();
		},
		/** @param {number} id */
		closeBinary(id) {
			this.$emit('close', id);
			this.$nextTick(() => {
				if (!this.binaries.some(binary => binary.id === id)) {
					this.$el.querySelector('.app-header__filename[aria-current="true"]')?.focus({ preventScroll: true });
				}
			});
		},
	},
});
</script>

<template id="app-header">
	<header class="app-header">
		<div class="app-header__identity" :class="{ 'app-header__identity--workspace': binaries.length }">
			<div class="app-header__brand">
				<span class="app-header__logo" aria-hidden="true">PE</span>
				<span class="app-header__name">pelite</span>
			</div>
			<button v-if="binaries.length" class="app-header__views" type="button" :disabled="activeId === undefined"
				:aria-controls="activeId === undefined ? undefined : 'pe-view-sidebar-' + activeId" :aria-expanded="sidebarOpen"
				aria-label="Toggle PE views" title="Toggle PE views" @click="$emit('toggle-sidebar')">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 5h18v14H3zM9 5v14" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>
			</button>
		</div>
		<template v-if="binaries.length">
			<nav class="app-header__binaries" aria-label="Open binaries" @wheel="scrollTabs">
				<div v-for="binary in binaries" :key="binary.id" class="app-header__tab" :class="{ 'app-header__tab--active': binary.id === activeId }">
					<button class="app-header__filename" type="button" :aria-current="binary.id === activeId ? 'true' : undefined"
						:title="binary.name" @click="$emit('select', binary.id)">{{ binary.name }}</button>
					<button class="app-header__close" type="button" :aria-label="'Close ' + binary.name"
						title="Close binary" @click="closeBinary(binary.id)">
						<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
					</button>
				</div>
			</nav>
			<button class="app-header__add" type="button" aria-label="Open more binaries" title="Open more binaries" :disabled="loading" @click="$emit('open')">+</button>
		</template>
		<span v-else class="app-header__tagline">Windows PE inspector</span>
	</header>
</template>

<style>
.app-header { display: flex; flex: none; height: 42px; border-bottom: 1px solid var(--color-border); background: var(--color-background); }
.app-header__identity { display: flex; flex-shrink: 0; align-items: center; gap: 8px; padding: 0 8px 0 14px; }
.app-header__identity--workspace { flex-basis: var(--workspace-sidebar-width); border-right: 1px solid var(--color-border); }
.app-header__brand { display: flex; align-items: center; gap: 8px; user-select: none; }
.app-header__logo { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 4px; background: var(--color-accent); color: var(--color-on-accent); font-size: 10px; font-weight: 700; }
.app-header__name { color: var(--color-text); font-size: 15px; font-weight: 700; }
.app-header__tagline { align-self: center; padding: 0 6px; color: var(--color-muted); font-size: 12px; }
.app-header__binaries { display: flex; min-width: 0; overflow: auto hidden; scrollbar-width: none; }
.app-header__tab { display: flex; flex: 0 0 auto; align-items: center; max-width: 100%; border-right: 1px solid var(--color-border); }
.app-header__tab--active { background: var(--color-surface); }
.app-header :is(.app-header__filename, .app-header__close, .app-header__add, .app-header__views) { border: 0; background: transparent; color: var(--color-muted); cursor: pointer; }
.app-header__filename { align-self: stretch; min-width: 0; padding: 0 5px 0 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 12px ui-monospace, SFMono-Regular, Consolas, monospace; }
.app-header__tab--active .app-header__filename { color: var(--color-text); }
.app-header__close { display: grid; flex-shrink: 0; place-items: center; width: 24px; height: 24px; margin-right: 5px; padding: 0; border-radius: 4px; }
.app-header__tab:not(.app-header__tab--active, :hover, :focus-within) > .app-header__close { visibility: hidden; }
.app-header__add { flex: 0 0 40px; padding: 0; font-size: 18px; }
.app-header__add:disabled { opacity: .5; cursor: wait; }
.app-header__views { display: grid; flex-shrink: 0; place-items: center; width: 28px; height: 28px; margin-left: auto; padding: 0; border-radius: 4px; }
.app-header__views:disabled { visibility: hidden; }
.app-header__filename:hover { color: var(--color-text); }
.app-header__views:hover, .app-header :is(.app-header__close, .app-header__add):hover:enabled { background: var(--color-border); color: var(--color-text); }
.app-header__views[aria-expanded="true"] { background: color-mix(in srgb, var(--color-accent) 16%, var(--color-background)); color: var(--color-accent); }
.app-header__views[aria-expanded="true"]:hover { background: color-mix(in srgb, var(--color-accent) 24%, var(--color-background)); }
.app-header button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
@media (max-width: 720px) {
	.app-header__identity--workspace { flex-basis: auto; }
	.app-header__filename { padding-left: 10px; }
}
@media (pointer: coarse), (max-width: 440px) {
	.app-header__views, .app-header__close { width: 32px; height: 36px; }
}
</style>

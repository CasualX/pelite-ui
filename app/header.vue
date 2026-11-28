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
		/** @param {number} id */
		selectFromList(id) {
			this.$refs.openBinaries.hidePopover();
			this.$emit('select', id);
		},
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
		/** @param {KeyboardEvent} event @param {number} id @param {boolean} [fromList] */
		onFileKeydown(event, id, fromList = false) {
			if (event.key !== 'Delete') return;
			event.preventDefault();
			this.closeBinary(id, fromList);
		},
		/** @param {number} id @param {boolean} [fromList] */
		closeBinary(id, fromList = false) {
			const index = this.binaries.findIndex(binary => binary.id === id);
			this.$emit('close', id);
			this.$nextTick(() => {
				if (this.binaries.some(binary => binary.id === id)) return;
				if (fromList) {
					const filenames = this.$refs.openBinaries?.querySelectorAll('.app-header__filename');
					(filenames?.[index] ?? filenames?.[index - 1])?.focus();
				} else {
					this.$el.querySelector('.app-header__binaries .app-header__filename[aria-current="true"]')?.focus({ preventScroll: true });
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
			<nav class="app-header__binaries" aria-label="File tabs" @wheel="scrollTabs">
				<div v-for="binary in binaries" :key="binary.id" class="app-header__tab" :class="{ 'app-header__tab--active': binary.id === activeId }"
					@mousedown.middle.prevent @auxclick.middle.prevent="closeBinary(binary.id)">
					<button class="app-header__filename" type="button" :aria-current="binary.id === activeId ? 'true' : undefined"
						:title="binary.name" @click="$emit('select', binary.id)" @keydown="onFileKeydown($event, binary.id)">{{ binary.name }}</button>
					<button class="app-header__close" type="button" :aria-label="'Close ' + binary.name"
						title="Close binary" @click="closeBinary(binary.id)"><span aria-hidden="true">×</span></button>
				</div>
			</nav>
			<button class="app-header__add" type="button" aria-label="Open more binaries" title="Open more binaries" :disabled="loading" @click="$emit('open')">+</button>
			<button class="app-header__list-toggle" type="button" popovertarget="app-open-binaries"
				:aria-label="'Open binaries (' + binaries.length + ')'" title="Open binaries">
				<span class="app-header__list-icon" aria-hidden="true"></span>{{ binaries.length }}
			</button>
			<nav id="app-open-binaries" ref="openBinaries" class="app-header__file-list" popover aria-labelledby="app-open-binaries-label">
				<div class="app-header__list-heading">
					<span id="app-open-binaries-label">Open binaries</span><span>{{ binaries.length }}</span>
				</div>
				<ul>
					<li v-for="binary in binaries" :key="binary.id" class="app-header__list-row" :class="{ 'app-header__list-row--active': binary.id === activeId }"
						@mousedown.middle.prevent @auxclick.middle.prevent="closeBinary(binary.id, true)">
						<button class="app-header__filename" type="button" :aria-current="binary.id === activeId ? 'true' : undefined"
							:autofocus="binary.id === activeId" :title="binary.name"
							@click="selectFromList(binary.id)" @keydown="onFileKeydown($event, binary.id, true)">{{ binary.name }}</button>
						<button class="app-header__close" type="button" :aria-label="'Close ' + binary.name"
							title="Close binary" @click="closeBinary(binary.id, true)"><span aria-hidden="true">×</span></button>
					</li>
				</ul>
			</nav>
		</template>
		<span v-else class="app-header__tagline">Windows PE inspector</span>
	</header>
</template>

<style>
.app-header {
	--header-height: 44px;
	--file-selection: color-mix(in srgb, var(--color-accent) 15%, var(--color-background));
	display: flex;
	flex: none;
	height: var(--header-height);
	border-bottom: 1px solid var(--color-border);
	background: var(--color-background);
}
.app-header__identity { display: flex; flex-shrink: 0; align-items: center; gap: 8px; padding: 0 8px 0 14px; }
.app-header__identity--workspace { flex-basis: var(--workspace-sidebar-width); border-right: 1px solid var(--color-border); }
.app-header__brand { display: flex; align-items: center; gap: 8px; user-select: none; }
.app-header__logo { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 2px; background: var(--color-accent); color: var(--color-on-accent); font-size: 10px; font-weight: 700; }
.app-header__name { color: var(--color-text); font-size: 15px; font-weight: 700; }
.app-header__tagline { align-self: center; padding: 0 6px; color: var(--color-muted); font-size: 12px; }
.app-header__binaries { display: flex; align-items: center; gap: 4px; min-width: 0; padding-inline: 6px; overflow: auto hidden; scrollbar-width: none; }
.app-header__tab, .app-header__list-row { display: flex; align-items: center; min-width: 0; min-height: 30px; border: 1px solid transparent; border-radius: 2px; }
.app-header__tab { flex: 0 0 auto; max-width: min(100%, 240px); }
.app-header__tab:hover { background: var(--color-surface); }
.app-header__list-row:hover { background: var(--color-background); }
.app-header__tab--active, .app-header__tab--active:hover, .app-header__list-row--active, .app-header__list-row--active:hover { background: var(--file-selection); }
.app-header__tab--active { border-color: color-mix(in srgb, var(--color-accent) 50%, var(--color-border)); }
.app-header button { border: 0; background: transparent; color: var(--color-muted); cursor: pointer; }
.app-header__filename { flex: 1; align-self: stretch; min-width: 0; padding: 0 4px 0 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; font: 12px ui-monospace, SFMono-Regular, Consolas, monospace; }
.app-header__filename[aria-current="true"], .app-header__filename:hover { color: var(--color-text); }
.app-header__close { display: grid; flex-shrink: 0; place-items: center; width: 24px; height: 24px; margin-right: 2px; padding: 0; border-radius: 2px; }
.app-header__close > span { font-size: 15px; line-height: 1; }
.app-header__add, .app-header__list-toggle, .app-header__views { align-self: center; height: 28px; border-radius: 2px; }
.app-header__add { flex: 0 0 30px; padding: 0; font-size: 18px; }
.app-header__add:disabled { opacity: .5; cursor: wait; }
.app-header__views { display: grid; flex-shrink: 0; place-items: center; width: 28px; margin-left: auto; padding: 0; }
.app-header__views:disabled { visibility: hidden; }
.app-header .app-header__list-toggle { display: flex; flex-shrink: 0; align-items: center; gap: 7px; margin-inline: auto 8px; padding: 0 8px; background: var(--color-surface); color: var(--color-text); font: 12px ui-monospace, SFMono-Regular, Consolas, monospace; }
.app-header__list-icon { width: 10px; height: 7px; border-block: 1px solid; background: linear-gradient(currentColor, currentColor) center / 100% 1px no-repeat; }
.app-header__views:hover, .app-header :is(.app-header__close, .app-header__add, .app-header__list-toggle):hover:enabled { background: var(--color-border); color: var(--color-text); }
:is(.app-header__tab--active, .app-header__list-row--active) > .app-header__close:hover:enabled { background: color-mix(in srgb, var(--color-accent) 24%, var(--color-background)); color: var(--color-accent); }
.app-header__views[aria-expanded="true"], .app-header:has(.app-header__file-list:popover-open) .app-header__list-toggle { background: var(--file-selection); color: var(--color-accent); }
.app-header__views[aria-expanded="true"]:hover { background: color-mix(in srgb, var(--color-accent) 24%, var(--color-background)); }
.app-header__file-list { position: fixed; inset: calc(var(--header-height) + 5px) 8px auto auto; width: min(330px, calc(100vw - 16px)); max-height: calc(100dvh - var(--header-height) - 13px); margin: 0; padding: 5px; overflow: auto; border: 1px solid var(--color-border); border-radius: 2px; background: var(--color-surface); color: var(--color-text); box-shadow: 0 4px 12px #0004; }
.app-header__list-heading { display: flex; justify-content: space-between; gap: 8px; padding: 8px 9px; color: var(--color-muted); font-size: 12px; }
.app-header__file-list ul { margin: 0; padding: 0; list-style: none; }
.app-header button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
@media (max-width: 720px) {
	.app-header__identity--workspace { flex-basis: auto; }
}
@media (hover: hover) and (pointer: fine) and (min-width: 441px) {
	.app-header__tab:not(.app-header__tab--active, :hover, :focus-within) > .app-header__close { visibility: hidden; }
}
@media (pointer: coarse), (max-width: 440px) {
	.app-header__views, .app-header__close, .app-header__add, .app-header__list-toggle { min-width: 32px; height: 36px; }
}
</style>

<script>
const AppSidebar = Vue.defineComponent({
	template: '#app-sidebar',
	props: {
		openViews: { type: Array, required: true },
		viewGroups: { type: Array, required: true },
		activeViewId: { type: Number },
	},
	emits: ['open-view', 'activate-view', 'close-view'],
	data() {
		return { collapsedGroups: /** @type {Set<string>} */ (new Set()) };
	},
	methods: {
		/** @param {string} id */
		toggleGroup(id) {
			if (this.collapsedGroups.has(id)) this.collapsedGroups.delete(id);
			else this.collapsedGroups.add(id);
		},
	},
});
</script>

<template id="app-sidebar">
	<aside class="app-sidebar" aria-label="Workspace views">
		<section class="app-sidebar__section" aria-labelledby="open-views-title">
			<h2 id="open-views-title" class="app-sidebar__heading">Open views <span class="app-sidebar__count">{{ openViews.length }}</span></h2>
			<ul class="app-sidebar__list">
				<li v-for="view in openViews" :key="view.id" class="app-sidebar__open-row" @auxclick.middle.prevent="$emit('close-view', view.id)" @mousedown.middle.prevent>
					<button class="app-sidebar__row app-sidebar__view-button" :class="{ 'app-sidebar__row--active': view.id === activeViewId }"
						type="button" :aria-current="view.id === activeViewId ? 'true' : undefined" @click="$emit('activate-view', view.id)">
						<svg class="app-sidebar__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path :d="view.icon" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
						<span class="app-sidebar__label" :title="view.displayTitle">{{ view.displayTitle }}</span>
					</button>
					<button class="app-sidebar__close" type="button" :aria-label="'Close ' + view.displayTitle" @click="$emit('close-view', view.id)">
						<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
					</button>
				</li>
			</ul>
		</section>

		<section class="app-sidebar__section app-sidebar__section--browser" aria-labelledby="pe-browser-title">
			<h2 id="pe-browser-title" class="app-sidebar__heading">PE browser</h2>
			<div v-for="group in viewGroups" :key="group.id" class="app-sidebar__group">
				<h3 v-if="group.title" class="app-sidebar__group-title">
					<button class="app-sidebar__group-toggle" type="button" :aria-expanded="!collapsedGroups.has(group.id)" :aria-controls="'sidebar-group-' + group.id" @click="toggleGroup(group.id)">
						<svg class="app-sidebar__chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
						{{ group.title }}
					</button>
				</h3>
				<ul :id="'sidebar-group-' + group.id" v-show="!group.title || !collapsedGroups.has(group.id)" class="app-sidebar__list">
					<li v-for="view in group.views" :key="view.id">
						<button class="app-sidebar__row app-sidebar__view-button" :class="{ 'app-sidebar__row--nested': group.title }" type="button" :disabled="!view.available" @click="$emit('open-view', view.id)">
							<svg class="app-sidebar__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path :d="view.icon" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
							<span class="app-sidebar__label">{{ view.title }}</span>
						</button>
					</li>
				</ul>
			</div>
		</section>
	</aside>
</template>

<style>
.app-sidebar { flex: 0 0 240px; min-height: 0; overflow-y: auto; border-right: 1px solid var(--color-border); background: var(--color-surface); font-size: 12px; }
.app-sidebar__section { padding: 0 0 8px; }
.app-sidebar__section--browser { border-top: 1px solid var(--color-border); }
.app-sidebar__heading { display: flex; align-items: center; justify-content: space-between; min-height: 32px; margin: 0 0 6px; padding: 7px 16px; border-bottom: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-border) 35%, var(--color-surface)); color: var(--color-text); font-size: 11px; font-weight: 700; user-select: none; }
.app-sidebar__count { color: var(--color-muted); font-size: 11px; padding: 1px 6px; border-radius: 8px; background: var(--color-surface); font-weight: 500; font-variant-numeric: tabular-nums; }
.app-sidebar__list { list-style: none; margin: 0 8px; padding: 0; }
.app-sidebar__row { display: flex; align-items: center; gap: 9px; min-height: 29px; padding: 5px 8px; border-radius: 4px; color: var(--color-text); cursor: pointer; user-select: none; }
.app-sidebar__view-button { width: 100%; border: 0; background: transparent; font: inherit; text-align: left; }
.app-sidebar__open-row { position: relative; }
.app-sidebar__open-row .app-sidebar__view-button { padding-right: 32px; }
.app-sidebar__close { position: absolute; top: 3px; right: 4px; display: grid; place-items: center; width: 23px; height: 23px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--color-muted); cursor: pointer; }
.app-sidebar__close:hover { background: var(--color-border); color: var(--color-text); }
.app-sidebar__view-button:focus-visible, .app-sidebar__close:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.app-sidebar__view-button:disabled { color: var(--color-muted); opacity: .55; cursor: default; }
.app-sidebar__row:hover:not(:disabled) { background: color-mix(in srgb, var(--color-border) 45%, var(--color-surface)); }
.app-sidebar__row--active { background: color-mix(in srgb, var(--color-accent) 14%, var(--color-surface)); color: var(--color-accent); }
.app-sidebar__row--active:hover:not(:disabled) { background: color-mix(in srgb, var(--color-accent) 20%, var(--color-surface)); }
.app-sidebar__icon { flex-shrink: 0; width: 16px; height: 16px; color: var(--color-muted); }
.app-sidebar__row--active .app-sidebar__icon { color: var(--color-accent); }
.app-sidebar__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.app-sidebar__group { margin: 0 8px; }
.app-sidebar__group .app-sidebar__list { margin: 0; }
.app-sidebar__group + .app-sidebar__group { margin-top: 10px; }
.app-sidebar__group-title { margin: 0; font-size: 12px; font-weight: 600; }
.app-sidebar__group-toggle { display: flex; align-items: center; gap: 7px; width: 100%; min-height: 29px; padding: 5px 8px; border: 0; border-radius: 4px; background: transparent; color: var(--color-text); font-size: inherit; font-weight: inherit; text-align: left; cursor: pointer; user-select: none; }
.app-sidebar__group-toggle:hover { background: color-mix(in srgb, var(--color-border) 45%, var(--color-surface)); }
.app-sidebar__group-toggle:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.app-sidebar__chevron { flex-shrink: 0; color: var(--color-muted); }
.app-sidebar__group-toggle[aria-expanded="false"] .app-sidebar__chevron { transform: rotate(-90deg); }
.app-sidebar__row--nested { padding-left: 27px; }
</style>

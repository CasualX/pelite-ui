<script>
const WorkspaceSidebar = Vue.defineComponent({
	template: '#workspace-sidebar',
	props: {
		openViews: { type: /** @type {new () => ViewModel[]} */ (/** @type {unknown} */ (Array)), required: true },
		viewGroups: { type: /** @type {new () => ViewMenuGroup[]} */ (/** @type {unknown} */ (Array)), required: true },
		activeViewId: { type: Number },
	},
	emits: ['open-view', 'activate-view', 'close-view'],
	data() {
		return { collapsedGroups: /** @type {Set<string>} */ (new Set()) };
	},
	computed: {
		groups() {
			const openByKey = new Map(/** @type {[string, ViewModel[]][]} */ ([]));
			for (const view of this.openViews) {
				const open = openByKey.get(view.sidebarKey);
				if (open) open.push(view);
				else openByKey.set(view.sidebarKey, [view]);
			}
			return this.viewGroups.map(group => ({
				...group,
				views: group.views.map(item => {
					const open = openByKey.get(item.sidebarKey ?? item.id) ?? [];
					const primary = item.singleton ? open.find(view => view.kind === item.id) : undefined;
					return { ...item, primary, children: primary ? open.filter(view => view !== primary) : open };
				}),
			}));
		},
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

<template id="workspace-sidebar">
	<aside class="workspace-sidebar" aria-label="Workspace views">
		<div v-for="group in groups" :key="group.id" class="workspace-sidebar__group">
			<h2 v-if="group.title" class="workspace-sidebar__group-title">
				<button class="workspace-sidebar__group-toggle" type="button" :aria-expanded="!collapsedGroups.has(group.id)" :aria-controls="'sidebar-group-' + group.id" @click="toggleGroup(group.id)">
					<svg class="workspace-sidebar__chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
					{{ group.title }}
				</button>
			</h2>
			<ul :id="'sidebar-group-' + group.id" v-show="!group.title || !collapsedGroups.has(group.id)" class="workspace-sidebar__list">
				<li v-for="item in group.views" :key="item.id">
					<div :class="{ 'workspace-sidebar__open-row': item.primary }">
						<button class="workspace-sidebar__row workspace-sidebar__view-button"
							:class="{ 'workspace-sidebar__row--nested': group.title }"
							type="button" :disabled="!item.available && !item.primary"
							:aria-current="item.primary && item.primary.id === activeViewId ? 'true' : undefined"
							@click="item.primary ? $emit('activate-view', item.primary.id) : $emit('open-view', item.id)"
							@auxclick.middle.prevent="item.primary && $emit('close-view', item.primary.id)" @mousedown.middle.prevent>
							<svg class="workspace-sidebar__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path :d="item.icon" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
							<span class="workspace-sidebar__label">{{ item.title }}</span>
							<span v-if="item.primary" class="workspace-sidebar__dot" role="img" aria-label="Open"></span>
							<span v-if="!item.singleton && item.children.length" class="workspace-sidebar__count" :title="item.children.length + ' open'">{{ item.children.length }}</span>
						</button>
						<button v-if="item.primary" class="workspace-sidebar__close" type="button" :aria-label="'Close ' + item.primary.displayTitle" @click="$emit('close-view', item.primary.id)">
							<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
						</button>
					</div>
					<ul v-if="item.children.length" class="workspace-sidebar__list">
						<li v-for="view in item.children" :key="view.id" class="workspace-sidebar__open-row workspace-sidebar__child-row">
							<button class="workspace-sidebar__row workspace-sidebar__view-button"
								type="button" :aria-current="view.id === activeViewId ? 'true' : undefined" @click="$emit('activate-view', view.id)"
								@auxclick.middle.prevent="$emit('close-view', view.id)" @mousedown.middle.prevent>
								<span class="workspace-sidebar__label" :title="view.displayTitle">{{ view.content.titleSuffix || view.displayTitle }}</span>
							</button>
							<button class="workspace-sidebar__close" type="button" :aria-label="'Close ' + view.displayTitle" @click="$emit('close-view', view.id)">
								<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
							</button>
						</li>
					</ul>
				</li>
			</ul>
		</div>
	</aside>
</template>

<style>
.workspace-sidebar { min-width: 0; min-height: 0; overflow-y: auto; padding-block: 6px 8px; border-right: 1px solid var(--color-border); background: var(--color-surface); font-size: 12px; }
.workspace-sidebar__dot, .workspace-sidebar__count { flex-shrink: 0; margin-inline-start: auto; }
.workspace-sidebar__dot { width: 6px; height: 6px; margin-inline-end: 4px; border-radius: 50%; background: var(--color-accent); }
.workspace-sidebar__count { color: var(--color-muted); font-size: 11px; font-weight: 500; font-variant-numeric: tabular-nums; }
.workspace-sidebar__list { list-style: none; margin: 0; padding: 0; }
.workspace-sidebar__row { display: flex; align-items: center; gap: 9px; min-height: 29px; padding: 5px 8px; border-radius: 4px; color: var(--color-text); cursor: pointer; user-select: none; }
.workspace-sidebar__view-button { width: 100%; border: 0; background: transparent; font: inherit; text-align: left; }
.workspace-sidebar__open-row { position: relative; }
.workspace-sidebar__child-row > .workspace-sidebar__view-button { padding-inline: 54px 32px; }
.workspace-sidebar__close { position: absolute; top: 3px; right: 4px; display: grid; place-items: center; width: 23px; height: 23px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--color-muted); cursor: pointer; opacity: 0; pointer-events: none; }
.workspace-sidebar__open-row:hover > .workspace-sidebar__close, .workspace-sidebar__close:focus-visible { opacity: 1; pointer-events: auto; }
.workspace-sidebar__open-row:is(:hover, :has(> .workspace-sidebar__close:focus-visible)) .workspace-sidebar__dot { opacity: 0; }
.workspace-sidebar__close:hover { background: var(--color-border); color: var(--color-text); }
.workspace-sidebar__view-button:focus-visible, .workspace-sidebar__close:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.workspace-sidebar__view-button:disabled { color: var(--color-muted); opacity: .55; cursor: default; }
.workspace-sidebar__row:hover:not(:disabled) { background: color-mix(in srgb, var(--color-border) 45%, var(--color-surface)); }
.workspace-sidebar__row[aria-current="true"] { background: color-mix(in srgb, var(--color-accent) 14%, var(--color-surface)); color: var(--color-accent); }
.workspace-sidebar__row[aria-current="true"]:hover:not(:disabled) { background: color-mix(in srgb, var(--color-accent) 20%, var(--color-surface)); }
.workspace-sidebar__icon { flex-shrink: 0; width: 16px; height: 16px; color: var(--color-muted); }
.workspace-sidebar__row[aria-current="true"] .workspace-sidebar__icon { color: var(--color-accent); }
.workspace-sidebar__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workspace-sidebar__group { margin: 0 8px; }
.workspace-sidebar__group + .workspace-sidebar__group { margin-top: 10px; }
.workspace-sidebar__group-title { margin: 0; font-size: 12px; font-weight: 600; }
.workspace-sidebar__group-toggle { display: flex; align-items: center; gap: 7px; width: 100%; min-height: 29px; padding: 5px 8px; border: 0; border-radius: 4px; background: transparent; color: var(--color-text); font-size: inherit; font-weight: inherit; text-align: left; cursor: pointer; user-select: none; }
.workspace-sidebar__group-toggle:hover { background: color-mix(in srgb, var(--color-border) 45%, var(--color-surface)); }
.workspace-sidebar__group-toggle:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.workspace-sidebar__chevron { flex-shrink: 0; color: var(--color-muted); }
.workspace-sidebar__group-toggle[aria-expanded="false"] .workspace-sidebar__chevron { transform: rotate(-90deg); }
.workspace-sidebar__row--nested { padding-left: 27px; }
.workspace-sidebar--compact .workspace-sidebar__row, .workspace-sidebar--compact .workspace-sidebar__group-toggle { min-height: 44px; }
.workspace-sidebar--compact .workspace-sidebar__close { top: 4px; width: 36px; height: 36px; }
.workspace-sidebar--compact .workspace-sidebar__child-row > .workspace-sidebar__view-button { padding-inline-end: 46px; }
@media (hover: none) {
	.workspace-sidebar__child-row > .workspace-sidebar__close { opacity: 1; pointer-events: auto; }
}
</style>

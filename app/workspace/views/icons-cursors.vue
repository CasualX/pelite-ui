<script>
/** @typedef {{ kind: 'icons' | 'cursors', name: string | number, bytes: Uint8Array }} IconCursorData */
/** @typedef {{ entries: IconCursorData[] }} IconsCursorsViewData */

/** @param {ViewContext} context @returns {boolean} */
function isIconsCursorsAvailable(context) {
	return [context.peFile.resourcesListIcons(), context.peFile.resourcesListCursors()]
		.some(names => names !== null && !(names instanceof Error) && names.length > 0);
}

/** @param {ViewContext} context @returns {ViewContent} */
function prepareIconsCursorsView(context) {
	/** @type {IconCursorData[]} */
	const entries = [];
	for (const kind of /** @type {const} */ (['icons', 'cursors'])) {
		const names = kind === 'icons' ? context.peFile.resourcesListIcons() : context.peFile.resourcesListCursors();
		if (names instanceof Error) {
			console.error(`Unable to list ${kind}:`, names);
			continue;
		}
		for (const name of names ?? []) {
			const bytes = kind === 'icons' ? context.peFile.resourcesGetIcon(name) : context.peFile.resourcesGetCursor(name);
			if (bytes instanceof Error || bytes === null) {
				console.error(`Unable to load ${kind === 'icons' ? 'icon' : 'cursor'} ${name}:`, bytes ?? 'Resource not found.');
				continue;
			}
			entries.push({ kind, name, bytes });
		}
	}
	return { component: 'view-icons-cursors', data: { entries } };
}

const ViewIconsCursors = Vue.defineComponent({
	template: '#view-icons-cursors',
	props: { data: { type: Object, required: true } },
	data() {
		const data = /** @type {IconsCursorsViewData} */ (/** @type {unknown} */ (this.data));
		return {
			previews: data.entries.map(entry => {
				const name = typeof entry.name === 'number' ? `#${entry.name}` : entry.name;
				const label = `${entry.kind === 'icons' ? 'Icon' : 'Cursor'} ${name}`;
				const fileName = String(entry.name).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
				const filename = entry.kind === 'icons' ? `icon-${fileName}.ico` : `cursor-${fileName}.cur`;
				return { kind: entry.kind, label, filename, url: URL.createObjectURL(new Blob([entry.bytes.slice().buffer], { type: 'image/x-icon' })), failed: false };
			}),
		};
	},
	computed: {
		groups() {
			return [
				{ title: 'Icons', previews: this.previews.filter(preview => preview.kind === 'icons') },
				{ title: 'Cursors', previews: this.previews.filter(preview => preview.kind === 'cursors') },
			];
		},
	},
	beforeUnmount() {
		for (const preview of this.previews) URL.revokeObjectURL(preview.url);
	},
});
</script>

<template id="view-icons-cursors">
	<section class="view-icons-cursors">
		<p class="view-icons-cursors__intro">Browse the icons and cursors embedded in this file.<br>Click a preview to download its .ico or .cur file.</p>
		<section v-for="group in groups" :key="group.title" class="view-icons-cursors__group">
			<h2>{{ group.title }}</h2>
			<ul v-if="group.previews.length" class="view-icons-cursors__list" :aria-label="group.title">
				<li v-for="(preview, index) in group.previews" :key="index" class="view-icons-cursors__row">
					<a class="view-icons-cursors__preview" :href="preview.url" :download="preview.filename" :aria-label="'Download ' + preview.label" :title="'Download ' + preview.filename">
						<img v-if="!preview.failed" :src="preview.url" :alt="preview.label" @error="preview.failed = true">
						<span v-else class="view-icons-cursors__failed">Preview unavailable</span>
					</a>
					<span class="view-icons-cursors__name">{{ preview.label }}</span>
				</li>
			</ul>
			<p v-else class="view-icons-cursors__empty">{{ group.title === 'Icons' ? 'No icons.' : 'No cursors.' }}</p>
		</section>
	</section>
</template>

<style>
.view-icons-cursors__intro { margin: 0 0 24px; color: var(--color-muted); font-size: 13px; line-height: 1.6; }
.view-icons-cursors__group + .view-icons-cursors__group { margin-top: 28px; }
.view-icons-cursors__group h2 { margin: 0 0 16px; padding-bottom: 10px; border-bottom: 1px solid var(--color-border); font-size: 13px; font-weight: 600; }
.view-icons-cursors__list { display: flex; flex-wrap: wrap; gap: 12px; margin: 0; padding: 0; list-style: none; }
.view-icons-cursors__row { display: flex; flex: 0 0 112px; min-width: 0; flex-direction: column; align-items: center; gap: 8px; padding: 0 8px; }
.view-icons-cursors__preview { display: grid; place-items: center; width: 80px; height: 80px; flex-shrink: 0; border: 1px solid var(--color-border); background-color: var(--color-background); background-image: conic-gradient(var(--color-surface) 25%, transparent 0 50%, var(--color-surface) 0 75%, transparent 0); background-size: 16px 16px; }
.view-icons-cursors__preview img { display: block; max-width: 64px; max-height: 64px; object-fit: contain; }
.view-icons-cursors__preview { text-decoration: none; }
.view-icons-cursors__preview:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.view-icons-cursors__name { max-width: 100%; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; text-align: center; }
.view-icons-cursors__failed { padding: 4px; color: var(--color-muted); font-size: 10px; text-align: center; }
.view-icons-cursors__empty { margin: 0; color: var(--color-muted); font-size: 12px; }
</style>

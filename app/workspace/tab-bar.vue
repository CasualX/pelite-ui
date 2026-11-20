<link rel="component" href="layout.vue.js">

<script>
const WorkspaceTabBar = Vue.defineComponent({
	template: '#workspace-tab-bar',
	props: {
		tabs: { type: /** @type {new () => number[]} */ (/** @type {unknown} */ (Array)), required: true },
		selected: Number,
		titles: { type: /** @type {new () => ReadonlyMap<number, string>} */ (/** @type {unknown} */ (Object)), required: true },
		prefix: { type: String, required: true },
		tabDragType: { type: String, required: true },
	},
	emits: ['select', 'close', 'split', 'float', 'move-tab', 'duplicate'],
	data() {
		return {
			menuTab: /** @type {number | undefined} */ (undefined),
			menuListeners: /** @type {AbortController | null} */ (null),
			dropMarker: /** @type {number | null} */ (null),
		};
	},
	watch: {
		selected() { this.$nextTick(() => this.revealSelected()); },
	},
	mounted() {
		this.revealSelected();
		this.$el.ownerDocument.addEventListener('dragend', this.clearDropMarker, true);
	},
	updated() {
		if (this.menuTab !== undefined && !this.tabs.includes(this.menuTab)) this.closeMenu();
	},
	beforeUnmount() {
		this.menuListeners?.abort();
		this.$el.ownerDocument.removeEventListener('dragend', this.clearDropMarker, true);
	},
	methods: {
		/** @param {WheelEvent} event */
		scrollTabs(event) {
			const { deltaMode, deltaX, deltaY, ctrlKey } = event;
			if (ctrlKey || deltaX || !deltaY) return;
			const bar = /** @type {HTMLElement} */ (event.currentTarget);
			if (bar.scrollWidth <= bar.clientWidth) return;
			const start = bar.scrollLeft;
			const unit = deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
				: deltaMode === WheelEvent.DOM_DELTA_PAGE ? bar.clientWidth : 1;
			bar.scrollLeft += deltaY * unit;
			if (bar.scrollLeft !== start) event.preventDefault();
		},
		revealSelected() {
			const bar = /** @type {HTMLElement} */ (this.$refs.tabs);
			if (!bar) return;
			const tab = bar.querySelector('[aria-selected="true"]')?.parentElement;
			if (!tab) return;
			const tabRect = tab.getBoundingClientRect();
			const barRect = bar.getBoundingClientRect();
			if (tabRect.left < barRect.left) bar.scrollLeft -= barRect.left - tabRect.left;
			else if (tabRect.right > barRect.right) bar.scrollLeft += tabRect.right - barRect.right;
		},
		/** @param {DragEvent} event @param {number} id */
		startDrag(event, id) {
			const transfer = event.dataTransfer;
			if (!transfer) return;
			this.closeMenu();
			transfer.setData(this.tabDragType, String(id));
			transfer.effectAllowed = 'move';
		},
		/** @param {HTMLElement} bar @param {number} x */
		insertionPoint(bar, x) {
			let left = bar.getBoundingClientRect().left;
			for (let index = 0; index < bar.children.length; index++) {
				const tab = bar.children[index].getBoundingClientRect();
				if (x < tab.left + tab.width / 2) return { index, left: tab.left };
				left = tab.right;
			}
			return { index: this.tabs.length, left };
		},
		/** @param {DragEvent} event */
		previewDrop(event) {
			const transfer = event.dataTransfer;
			if (!transfer?.types.includes(this.tabDragType)) return;
			event.preventDefault();
			event.stopPropagation();
			transfer.dropEffect = 'move';
			const bar = /** @type {HTMLElement} */ (event.currentTarget);
			const bounds = bar.getBoundingClientRect();
			const edge = Math.min(20, bounds.width / 3);
			if (event.clientX < bounds.left + edge) bar.scrollLeft -= 12;
			else if (event.clientX > bounds.right - edge) bar.scrollLeft += 12;
			const { left } = this.insertionPoint(bar, event.clientX);
			this.dropMarker = clampWorkspaceValue(left - bounds.left - 1, 0, bar.clientWidth - 2);
		},
		/** @param {DragEvent} event */
		leaveDrop(event) {
			const bar = /** @type {HTMLElement} */ (event.currentTarget);
			if (!(event.relatedTarget instanceof Node) || !bar.contains(event.relatedTarget)) this.clearDropMarker();
		},
		clearDropMarker() { this.dropMarker = null; },
		/** @param {DragEvent} event */
		dropTab(event) {
			this.clearDropMarker();
			const data = event.dataTransfer?.getData(this.tabDragType);
			if (!data) return;
			const id = Number(data);
			if (!Number.isFinite(id)) return;
			event.preventDefault();
			event.stopPropagation();
			const bar = /** @type {HTMLElement} */ (event.currentTarget);
			this.$emit('move-tab', id, this.insertionPoint(bar, event.clientX).index);
		},
		/** @param {KeyboardEvent} event @param {number} index */
		navigate(event, index) {
			if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
				this.openMenu(event, this.tabs[index]);
				return;
			}
			const length = this.tabs.length;
			let next;
			switch (event.key) {
				case 'ArrowLeft': next = (index + length - 1) % length; break;
				case 'ArrowRight': next = (index + 1) % length; break;
				case 'Home': next = 0; break;
				case 'End': next = length - 1; break;
				case 'Delete':
					event.preventDefault();
					this.$emit('close', this.tabs[index]);
					return;
				default: return;
			}
			event.preventDefault();
			const viewId = this.tabs[next];
			this.$emit('select', viewId);
			this.focusTab(viewId);
		},
		/** @param {number} id */
		focusTab(id) {
			this.$el.ownerDocument.getElementById(`${this.prefix}-tab-${id}`)?.focus({ preventScroll: true });
		},
		/** @param {MouseEvent | KeyboardEvent} event @param {number} id */
		openMenu(event, id) {
			event.preventDefault();
			event.stopPropagation();
			const tab = /** @type {HTMLButtonElement} */ (event.currentTarget);
			const menu = /** @type {HTMLElement} */ (this.$refs.menu);
			this.closeMenu();
			this.menuTab = id;
			const anchor = tab.getBoundingClientRect();
			const atPointer = 'clientX' in event && (event.clientX !== 0 || event.clientY !== 0);
			const x = atPointer ? event.clientX : anchor.left;
			const y = atPointer ? event.clientY : anchor.bottom;
			menu.showPopover();
			const { clientWidth, clientHeight } = menu.ownerDocument.documentElement;
			menu.style.left = `${clampWorkspaceValue(x, 4, clientWidth - menu.offsetWidth - 4)}px`;
			menu.style.top = `${clampWorkspaceValue(y, 4, clientHeight - menu.offsetHeight - 4)}px`;
			menu.querySelector('button')?.focus({ preventScroll: true });

			// Manual dismissal lets the menu survive the pointer release that opened it.
			const listeners = new AbortController();
			const options = { capture: true, signal: listeners.signal };
			/** @param {Event} next */
			const dismissOutside = next => {
				if (next.target instanceof Node && !menu.contains(next.target)) this.closeMenu();
			};
			this.menuListeners = listeners;
			menu.ownerDocument.addEventListener('pointerdown', dismissOutside, options);
			menu.ownerDocument.addEventListener('focusin', dismissOutside, options);
		},
		/** @param {boolean} [restoreFocus] */
		closeMenu(restoreFocus = false) {
			const id = this.menuTab;
			if (id === undefined) return;
			this.menuListeners?.abort();
			this.menuListeners = null;
			this.menuTab = undefined;
			this.$refs.menu.hidePopover();
			if (restoreFocus) this.focusTab(id);
		},
		/** @param {KeyboardEvent} event */
		navigateMenu(event) {
			const menu = /** @type {HTMLElement} */ (this.$refs.menu);
			const buttons = Array.from(menu.querySelectorAll('button'));
			const index = buttons.findIndex(button => button === menu.ownerDocument.activeElement);
			const offset = event.key === 'ArrowUp' ? -1 : 1;
			const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
				: (index + offset + buttons.length) % buttons.length;
			buttons[next]?.focus();
		},
		/** @param {WorkspaceDirection | 'float' | 'duplicate'} action */
		choose(action) {
			const id = this.menuTab;
			if (id === undefined) return;
			this.closeMenu();
			if (action === 'float') this.$emit('float', id);
			else if (action === 'duplicate') this.$emit('duplicate', id);
			else this.$emit('split', id, action);
		},
	},
});
</script>

<template id="workspace-tab-bar">
	<div class="workspace-tab-bar">
		<div ref="tabs" class="workspace-tab-bar__tabs" role="tablist" aria-label="Open views"
			@wheel="scrollTabs" @dragover="previewDrop" @dragleave="leaveDrop" @drop="dropTab">
			<div v-for="(id, index) in tabs" :key="id" class="workspace-tab" :class="{ 'workspace-tab--selected': selected === id }" role="presentation"
				@mousedown.middle.prevent @auxclick.middle.prevent="$emit('close', id)">
				<button :id="prefix + '-tab-' + id" class="workspace-tab__select" type="button" role="tab"
					:aria-controls="prefix + '-panel-' + id" :aria-selected="selected === id" :tabindex="selected === id ? 0 : -1"
					aria-haspopup="menu" :aria-expanded="menuTab === id" :title="titles.get(id)" draggable="true"
					@click="$emit('select', id)" @contextmenu="openMenu($event, id)" @keydown="navigate($event, index)"
					@dragstart="startDrag($event, id)">{{ titles.get(id) }}</button>
				<button class="workspace-tab__close workspace-control" type="button" tabindex="-1"
					:aria-label="'Close ' + titles.get(id)" @click="$emit('close', id)">×</button>
			</div>
		</div>
		<div v-if="dropMarker !== null" class="workspace-tab-bar__insertion" :style="{ left: dropMarker + 'px' }" aria-hidden="true"></div>
		<div ref="menu" class="workspace-tab-bar__menu" popover="manual" role="menu" :aria-label="'Actions for ' + titles.get(menuTab)"
			@contextmenu.prevent.stop @keydown.esc.prevent.stop="closeMenu(true)" @keydown.tab="closeMenu(true)"
			@keydown.up.prevent="navigateMenu" @keydown.down.prevent="navigateMenu" @keydown.home.prevent="navigateMenu" @keydown.end.prevent="navigateMenu">
			<button type="button" role="menuitem" tabindex="-1" @click="choose('duplicate')">Duplicate tab</button>
			<hr>
			<button type="button" role="menuitem" tabindex="-1" @click="choose('row')">Split right</button>
			<button type="button" role="menuitem" tabindex="-1" @click="choose('column')">Split down</button>
			<button type="button" role="menuitem" tabindex="-1" @click="choose('float')">Float window</button>
		</div>
	</div>
</template>

<style>
.workspace-tab-bar { position: relative; display: flex; flex: 1; min-width: 0; }
.workspace-tab-bar__tabs { display: flex; flex: 1; min-width: 0; overflow: auto hidden; scrollbar-width: thin; scrollbar-color: var(--workspace-border) transparent; }
.workspace-tab-bar__tabs:hover { scrollbar-color: var(--workspace-muted) transparent; }
.workspace-tab-bar__insertion { position: absolute; top: 3px; bottom: 3px; width: 2px; border-radius: 1px; background: var(--workspace-accent); pointer-events: none; }
.workspace-tab { display: flex; align-items: center; flex: 0 0 auto; min-width: 0; max-width: 100%; border-right: 1px solid var(--workspace-border); }
.workspace-tab--selected { background: var(--workspace-background); box-shadow: inset 0 -2px var(--workspace-border); color: var(--workspace-text); }
.workspace-pane--focused .workspace-tab--selected { box-shadow: inset 0 -2px var(--workspace-accent); }
.workspace-tab__select { align-self: stretch; min-width: 0; max-width: 220px; overflow: hidden; padding: 0 8px 0 12px; border: 0; background: transparent; color: inherit; font: inherit; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.workspace-tab__select:hover { color: var(--workspace-text); }
.workspace-tab__close { flex-shrink: 0; margin-right: 3px; }
.workspace-tab-bar__menu { position: fixed; inset: auto; margin: 0; padding: 4px; border: 1px solid var(--workspace-border); background: var(--workspace-surface); color: var(--workspace-text); box-shadow: 0 0 4px #0004, 0 2.5px 8px #0006; }
.workspace-tab-bar__menu hr { margin: 4px 0; border: 0; border-block-start: 1px solid var(--workspace-border); }
.workspace-tab-bar__menu button { display: block; width: 100%; padding: 6px 12px; border: 0; border-radius: 2px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.workspace-tab-bar__menu button:hover, .workspace-tab-bar__menu button:focus-visible { background: var(--workspace-background); outline: 1px solid var(--workspace-accent); }
</style>

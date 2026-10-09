<link rel="component" href="address.vue.js">

<script>
/** @typedef {{ title: string, request: WorkspaceContextAction }} WorkspaceMenuItem */

const WorkspaceContextMenu = Vue.defineComponent({
	template: '#workspace-context-menu',
	emits: ['context-action'],
	data() { return { items: /** @type {WorkspaceMenuItem[]} */ ([]) }; },
	methods: {
		/** @param {MouseEvent} event @param {import('./deps/pelite.js').PeFile} peFile */
		open(event, peFile) {
			const menu = this.$refs.menu;
			menu.hidePopover();
			if (event.ctrlKey || !(event.target instanceof Element)) return;
			const target = event.target;
			if (target.closest('button, a, [role="menu"]')) return;
			const cell = target.closest('td, [data-kind]');
			let text = cell?.textContent ?? (target.childElementCount === 0 ? target.textContent : '');
			let kind = cell?.getAttribute('data-kind') ?? undefined;
			const selection = document.getSelection();
			// Only use the selection when the pointer is over it, not a stale
			// selection elsewhere in the workspace.
			if (selection && !selection.isCollapsed && selection.rangeCount) {
				const rects = selection.getRangeAt(0).getClientRects();
				if (Array.from(rects).some(rect => event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom)) {
					text = selection.toString();
					if (!cell?.contains(selection.anchorNode) || !cell.contains(selection.focusNode)) kind = undefined;
				}
			}
			const number = text?.trim() ?? '';
			if (!/^(?:0x[\da-f]+|\d+)$/i.test(number)) return;
			const value = BigInt(number);
			const headers = peFile.headers();
			if (headers instanceof Error) return;
			const imageSize = headers.NtHeaders.OptionalHeader.SizeOfImage;
			const kinds = kind ? [kind] : ['rva', 'va', 'fo'];
			const items = /** @type {WorkspaceMenuItem[]} */ ([]);
			for (const candidate of kinds) {
				if (candidate !== 'rva' && candidate !== 'va' && candidate !== 'fo') continue;
				// The WASM VA input is u64; RVA/file-offset inputs must be exact.
				if (value > (candidate === 'va' ? 0xffffffffffffffffn : 0xffffffffn)) continue;
				try {
					const rva = workspaceAddressToRva(peFile, { kind: candidate, value });
					if (rva < 0 || rva >= imageSize) continue;
					items.push({
						title: `View Hex Dump as ${candidate === 'fo' ? 'file offset' : candidate.toUpperCase()} · 0x${rva.toString(16)}`,
						request: { action: 'open-view', viewer: 'hex-dump', data: { rva } },
					});
					if ([0x14c, 0x8664].includes(headers.NtHeaders.FileHeader.Machine)) {
						items.push({
							title: `View Disassembly as ${candidate === 'fo' ? 'file offset' : candidate.toUpperCase()} · 0x${rva.toString(16)}`,
							request: { action: 'open-view', viewer: 'disasm', data: { rva } },
						});
					}
				} catch { /* This interpretation does not address the virtual image. */ }
			}
			if (!items.length) return;
			event.preventDefault();
			this.items = items;
			this.$nextTick(() => {
				// A contextmenu event can fire before right-button release. Native
				// light dismissal can treat that release as an outside click.
				menu.showPopover();
				menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8))}px`;
				menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8))}px`;
				menu.querySelector('button').focus();
			});
		},
		/** @param {WorkspaceMenuItem} item */
		choose(item) {
			this.$refs.menu.hidePopover();
			this.$emit('context-action', item.request);
		},
		/** @param {PointerEvent} event */
		outsidePointerDown(event) {
			const menu = this.$refs.menu;
			if (menu.matches(':popover-open') && event.target instanceof Node && !menu.contains(event.target)) menu.hidePopover();
		},
		/** @param {KeyboardEvent} event */
		escape(event) {
			if (event.key === 'Escape' && this.$refs.menu.matches(':popover-open')) {
				event.preventDefault();
				this.$refs.menu.hidePopover();
			}
		},
		/** @param {KeyboardEvent} event */
		navigate(event) {
			const buttons = /** @type {HTMLButtonElement[]} */ (Array.from(this.$refs.menu.querySelectorAll('button')));
			const index = buttons.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
			const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
			buttons[next]?.focus();
		},
	},
	mounted() {
		document.addEventListener('pointerdown', this.outsidePointerDown);
		document.addEventListener('keydown', this.escape);
	},
	beforeUnmount() {
		document.removeEventListener('pointerdown', this.outsidePointerDown);
		document.removeEventListener('keydown', this.escape);
	},
});
</script>

<template id="workspace-context-menu">
	<div ref="menu" class="workspace-context-menu" popover="manual" role="menu" aria-label="Address actions"
		@keydown.down.prevent="navigate" @keydown.up.prevent="navigate" @keydown.home.prevent="navigate" @keydown.end.prevent="navigate">
		<button v-for="(item, index) in items" :key="index" type="button" role="menuitem" @click="choose(item)">{{ item.title }}</button>
	</div>
</template>

<style>
.workspace-context-menu { position: fixed; inset: auto; margin: 0; padding: 4px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); color: var(--color-text); }
.workspace-context-menu button { display: block; width: 100%; padding: 7px 12px; border: 0; border-radius: 2px; background: transparent; color: inherit; text-align: left; font: 12px system-ui, sans-serif; cursor: pointer; }
.workspace-context-menu button:hover, .workspace-context-menu button:focus-visible { background: var(--color-accent); color: var(--color-on-accent); outline: none; }
</style>

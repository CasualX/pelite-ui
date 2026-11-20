<link rel="component" href="address.vue.js">

<script>
const PeAddressMenu = Vue.defineComponent({
	template: '#pe-address-menu',
	emits: ['context-action'],
	data() {
		return {
			address: /** @type {{ text: string, rva: number | null, disassembly: boolean } | null} */ (null),
			copyStatus: '',
		};
	},
	methods: {
		/** @param {MouseEvent} event @param {PeDocument} openedDocument */
		open(event, openedDocument) {
			this.dismiss();
			if (event.ctrlKey || !(event.target instanceof Element)) return;
			if (event.target.closest('button, a, [role="menu"]')) return;
			const element = event.target.closest('[data-kind]');
			const kind = element?.getAttribute('data-kind');
			if (!element || (kind !== 'rva' && kind !== 'va' && kind !== 'fo')) return;
			const text = (element instanceof HTMLInputElement ? element.value : element.textContent)?.trim() ?? '';
			if (!/^(?:0x[\da-f]+|\d+)$/i.test(text)) return;

			const value = BigInt(text);
			const headers = openedDocument.peFile.headers();
			if (headers instanceof Error) return;
			const { FileHeader, OptionalHeader } = headers.NtHeaders;
			let rva = null;
			if (value <= (kind === 'va' ? 0xffffffffffffffffn : 0xffffffffn)
				&& (kind !== 'fo' || value < BigInt(openedDocument.file.size))) {
				try {
					const resolved = kind === 'va' && value === 0n && OptionalHeader.ImageBase === 0
						? 0 : workspaceAddressToRva(openedDocument, { kind, value });
					if (resolved >= 0 && resolved < OptionalHeader.SizeOfImage) rva = resolved;
				} catch { /* The address has no location in the virtual image. */ }
			}
			const disassembly = rva !== null && [0x14c, 0x8664].includes(FileHeader.Machine)
				&& !(openedDocument.peFile.sliceBytes(rva, 1) instanceof Error);
			event.preventDefault();
			this.address = { text, rva, disassembly };
			const address = this.address;
			this.$nextTick(() => {
				const menu = this.$refs.menu;
				if (!menu || this.address !== address) return;
				// Manual dismissal keeps the menu open through right-button release.
				menu.showPopover();
				menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8))}px`;
				menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8))}px`;
				(menu.querySelector('button:not(:disabled)') ?? menu).focus({ preventScroll: true });
			});
		},
		dismiss() {
			this.$refs.menu.hidePopover();
			this.address = null;
			this.copyStatus = '';
		},
		async copy() {
			const address = this.address;
			if (!address) return;
			try {
				await navigator.clipboard.writeText(address.text);
			} catch {
				if (this.address === address) this.copyStatus = 'Clipboard unavailable.';
				return;
			}
			if (this.address === address) this.dismiss();
		},
		/** @param {'hex-dump' | 'disasm'} viewer */
		choose(viewer) {
			const address = this.address;
			if (!address || address.rva === null || (viewer === 'disasm' && !address.disassembly)) return;
			this.dismiss();
			this.$emit('context-action', { action: 'open-view', viewer, data: { rva: address.rva } });
		},
		/** @param {PointerEvent} event */
		outsidePointerDown(event) {
			const menu = this.$refs.menu;
			if (menu.matches(':popover-open') && event.target instanceof Node && !menu.contains(event.target)) this.dismiss();
		},
		/** @param {KeyboardEvent} event */
		escape(event) {
			if (event.key !== 'Escape' || !this.$refs.menu.matches(':popover-open')) return;
			event.preventDefault();
			this.dismiss();
		},
		/** @param {KeyboardEvent} event */
		navigate(event) {
			const buttons = /** @type {HTMLButtonElement[]} */ (Array.from(this.$refs.menu.querySelectorAll('button:not(:disabled)')));
			if (!buttons.length) return;
			const index = buttons.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
			const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
			buttons[next].focus({ preventScroll: true });
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

<template id="pe-address-menu">
	<div ref="menu" class="pe-address-menu" popover="manual" role="menu" aria-label="Address actions" tabindex="-1"
		@keydown.down.prevent="navigate" @keydown.up.prevent="navigate" @keydown.home.prevent="navigate" @keydown.end.prevent="navigate" @keydown.tab="dismiss">
		<button type="button" role="menuitem" tabindex="-1" @click="copy">Copy</button>
		<hr role="separator">
		<button type="button" role="menuitem" tabindex="-1" :disabled="address?.rva == null" @click="choose('hex-dump')">Open Hex Dump</button>
		<button type="button" role="menuitem" tabindex="-1" :disabled="!address?.disassembly" @click="choose('disasm')">Open Disassembly</button>
		<p class="pe-address-menu__status" role="status">{{ copyStatus }}</p>
	</div>
</template>

<style>
.pe-address-menu { position: fixed; inset: auto; margin: 0; width: max-content; padding: 4px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); box-shadow: 0 0 4px #0004, 0 2.5px 8px #0006; }
.pe-address-menu button { display: block; width: 100%; padding: 7px 12px; border: 0; border-radius: 2px; background: transparent; color: inherit; text-align: left; white-space: nowrap; font: 12px system-ui, sans-serif; cursor: pointer; }
.pe-address-menu button:not(:disabled):is(:hover, :focus-visible) { background: var(--color-accent); color: var(--color-on-accent); outline: none; }
.pe-address-menu button:disabled { color: var(--color-muted); opacity: .6; cursor: default; }
.pe-address-menu hr { margin: 4px 0; border: 0; border-top: 1px solid var(--color-border); }
.pe-address-menu__status { margin: 4px 12px; color: var(--color-muted); font-size: 12px; }
.pe-address-menu__status:empty { display: none; }
</style>

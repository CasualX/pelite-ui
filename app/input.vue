<script>
/** @typedef {{ name: string, label: string, architecture: string, url: string }} ExampleBinary */

const AppInput = Vue.defineComponent({
	template: '#app-input',
	props: {
		loading: Boolean,
		error: { type: String, default: '' },
	},
	emits: ['choose', 'files', 'example', 'error'],
	data() {
		return {
			dragDepth: 0,
			examples: /** @type {ExampleBinary[]} */ ([
				{ name: 'zlib1-x86.dll', label: 'zlib1.dll', architecture: 'x86', url: './examples/zlib1-x86.dll' },
				{ name: 'zlib1-x64.dll', label: 'zlib1.dll', architecture: 'x64', url: './examples/zlib1-x64.dll' },
			]),
		};
	},
	methods: {
		focusPicker() {
			const button = this.$refs.chooseButton;
			if (button instanceof HTMLButtonElement) button.focus();
		},
		/** @param {DragEvent} event */
		onDragEnter(event) {
			if (!this.loading && event.dataTransfer?.types.includes('Files')) this.dragDepth++;
		},
		/** @param {DragEvent} event */
		onDragOver(event) {
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = !this.loading && event.dataTransfer.types.includes('Files') ? 'copy' : 'none';
			}
		},
		/** @param {DragEvent} event */
		onDrop(event) {
			this.dragDepth = 0;
			if (this.loading) return;
			const files = Array.from(event.dataTransfer?.files ?? []);
			if (files.length) this.$emit('files', files);
			else this.$emit('error', 'Drop a file from your device to get started.');
		},
	},
});
</script>

<template id="app-input">
	<div class="app-input" :class="{ 'app-input--dragging': dragDepth > 0 && !loading }"
		@dragenter.prevent="onDragEnter" @dragleave.prevent="dragDepth = Math.max(0, dragDepth - 1)"
		@dragover.prevent="onDragOver" @drop.prevent.stop="onDrop">
		<section class="app-input__panel" :aria-busy="loading" aria-labelledby="upload-title" aria-describedby="upload-description">
			<div class="app-input__hex" aria-hidden="true">
				<span>00000000</span>
				<span class="app-input__bytes"><strong>4D 5A</strong> 90 00 03 00 00 00<span class="app-input__hex-tail"> 04 00 00 00</span></span>
				<span><strong>MZ</strong><span class="app-input__hex-tail">..........</span></span>
			</div>
			<div class="app-input__body">
				<h1 id="upload-title">{{ dragDepth > 0 && !loading ? 'Release to open' : 'Open a Windows binary' }}</h1>
				<p id="upload-description">Drop files here, or choose them from your device.</p>
				<p class="app-input__formats"><code>.exe</code> <code>.dll</code> <code>.sys</code> <span>and other PE files</span></p>
				<button ref="chooseButton" class="app-input__choose" type="button" :disabled="loading" @click="$emit('choose')">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
					</svg>
					{{ loading ? 'Loading file…' : 'Choose files…' }}
				</button>
				<div role="status" aria-live="polite" aria-atomic="true">
					<p v-if="error" class="app-input__error">{{ error }}</p>
				</div>
			</div>
			<section class="app-input__examples" aria-labelledby="example-title">
				<h2 id="example-title">Try an example</h2>
				<div class="app-input__example-list">
					<button v-for="example in examples" :key="example.name" class="app-input__example"
						type="button" :disabled="loading" @click="$emit('example', example)">
						<span>{{ example.label }}</span>
						<span class="app-input__architecture">{{ example.architecture }}</span>
					</button>
				</div>
			</section>
			<p class="app-input__privacy">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" stroke-width="1.6" /><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.6" /></svg>
				Your files stay on your device.
			</p>
		</section>
	</div>
</template>

<style>
.app-input {
	--input-mono: ui-monospace, SFMono-Regular, Consolas, monospace;
	--input-inset: clamp(16px, 5vw, 32px);
	display: flex;
	position: relative;
	isolation: isolate;
	flex: 1;
	min-width: 0;
	padding: clamp(24px, 5vw, 48px) 16px;
}
.app-input::before, .app-input::after { content: ''; position: absolute; pointer-events: none; }
.app-input::before {
	inset: 0;
	z-index: -1;
	background: radial-gradient(circle, color-mix(in srgb, var(--color-secondary) 25%, transparent) 1px, transparent 1px) center / 16px 16px;
	mask-image: radial-gradient(ellipse 55% 65% at center, #000 30%, transparent 100%);
}
.app-input::after { inset: 10px; border: 2px dashed var(--color-accent); border-radius: 12px; opacity: 0; transition: opacity .15s; }
.app-input--dragging::after { opacity: .75; }
.app-input__panel {
	width: min(100%, 580px);
	min-width: 0;
	margin: auto;
	overflow: hidden;
	border: 1px solid var(--color-border);
	border-radius: 12px;
	background: var(--color-surface);
	box-shadow: 0 16px 40px light-dark(#252a2c12, #0005);
	transition: border-color .15s;
}
.app-input--dragging .app-input__panel { border-color: var(--color-accent); }
.app-input__hex {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) auto;
	align-items: center;
	gap: clamp(10px, 3vw, 24px);
	padding: 15px var(--input-inset);
	border-bottom: 1px solid var(--color-border);
	background: var(--color-background);
	color: var(--color-muted);
	font: clamp(10px, 2.5vw, 13px)/1.5 var(--input-mono);
	white-space: nowrap;
	user-select: none;
}
.app-input__hex strong { color: var(--color-secondary); }
.app-input__bytes { overflow: hidden; }
.app-input__body { padding: 26px var(--input-inset); }
.app-input__body h1 { margin: 0; font-size: clamp(22px, 5.6vw, 29px); font-weight: 650; letter-spacing: -.6px; line-height: 1.2; }
.app-input__body > p { margin: 8px 0 0; color: var(--color-muted); font-size: 14px; line-height: 1.5; }
.app-input__body .app-input__formats { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 14px; font-size: 12px; }
.app-input__formats code, .app-input__architecture { padding: 2px 6px; border: 1px solid var(--color-border); border-radius: 4px; font: 11px/1.4 var(--input-mono); }
.app-input__choose { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; margin-top: 22px; padding: 8px 16px; border: 1px solid var(--color-accent-hover); border-radius: 6px; background: var(--color-accent); color: var(--color-on-accent); font-size: 14px; font-weight: 600; cursor: pointer; }
.app-input__choose:disabled, .app-input__example:disabled { opacity: .6; cursor: wait; box-shadow: none; }
.app-input__choose:hover:not(:disabled) { background: var(--color-accent-hover); }
.app-input__choose:focus-visible, .app-input__example:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 4px; }
.app-input__examples { padding: 16px var(--input-inset) 20px; border-top: 1px solid var(--color-border); }
.app-input__examples h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
.app-input__example-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.app-input__example { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-background); color: var(--color-text); text-align: left; font: 13px var(--input-mono); cursor: pointer; }
.app-input__example:hover:not(:disabled) { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); }
.app-input__architecture { color: var(--color-muted); }
.app-input__error { margin: 14px 0 0; color: var(--color-danger); font-size: 14px; overflow-wrap: anywhere; }
.app-input__privacy { display: flex; align-items: center; gap: 8px; margin: 0; padding: 12px var(--input-inset); border-top: 1px solid var(--color-border); background: var(--color-background); color: var(--color-muted); font-size: 12px; }
@media (max-width: 580px) {
	.app-input__hex-tail { display: none; }
}
@media (max-width: 370px) {
	.app-input__example-list { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
	.app-input::after, .app-input__panel { transition: none; }
}
</style>

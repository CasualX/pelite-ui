<link rel="component" href="status.vue.js">

<script>
const AppInput = Vue.defineComponent({
	template: '#app-input',
	props: {
		pelite: { type: Object, required: true },
	},
	emits: ['status', 'selected'],
	data() {
		return {
			selectedFile: /** @type {File | null} */ (null),
			dragDepth: 0,
			error: '',
			loading: false,
			disposed: false,
		};
	},
	mounted() {
		this.updateStatus();
	},
	beforeUnmount() {
		this.disposed = true;
	},
	methods: {
		updateStatus() {
			const status = this.error
				? new StatusModel('var(--color-danger)', 'Error', this.error)
				: this.loading
					? new StatusModel('var(--color-warning)', 'Loading file', this.selectedFile?.name ?? '')
					: new StatusModel('var(--color-success)', 'Ready', 'Choose a file to get started.');
			this.$emit('status', status);
		},
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
		chooseFile() {
			if (this.loading) return;
			const input = this.$refs.fileInput;
			if (input instanceof HTMLInputElement) input.click();
		},

		/** @param {FileList | null} files */
		async selectFiles(files) {
			if (this.loading) return;
			if (!files?.length) return;
			if (files.length !== 1) {
				this.error = 'Please choose one file at a time.';
				this.updateStatus();
				return;
			}
			this.error = '';
			this.selectedFile = files[0];
			this.loading = true;
			this.updateStatus();
			let bytes;
			try {
				bytes = new Uint8Array(await this.selectedFile.arrayBuffer());
			} catch (error) {
				if (this.disposed) return;
				this.loading = false;
				this.error = 'Unable to read this file. Please try again.';
				this.updateStatus();
				return;
			}
			if (this.disposed) return;
			const pelite = /** @type {typeof import('./deps/pelite.js')} */ (this.pelite);
			let peFile;
			try {
				peFile = new pelite.PeFile(bytes);
			} catch (error) {
				this.loading = false;
				this.error = 'This file is not a supported PE file.';
				this.updateStatus();
				return;
			}
			this.loading = false;
			this.$emit('selected', this.selectedFile, peFile);
		},

		/** @param {Event} event */
		onFileChange(event) {
			const input = event.target;
			if (!(input instanceof HTMLInputElement)) return;
			this.selectFiles(input.files);
			input.value = '';
		},

		/** @param {DragEvent} event */
		onDrop(event) {
			this.dragDepth = 0;
			if (this.loading) return;
			const files = event.dataTransfer?.files;
			if (!files?.length) {
				this.error = 'Drop a file from your device to get started.';
				this.updateStatus();
				return;
			}
			this.selectFiles(files);
		},
	},
});
</script>

<template id="app-input">
	<div class="app-input" @dragover.prevent @drop.prevent="dragDepth = 0">
		<section class="app-input__dropzone" :class="{ 'app-input__dropzone--active': dragDepth > 0 }"
			:aria-busy="loading" aria-labelledby="upload-title" aria-describedby="upload-description"
			@dragenter.prevent="onDragEnter" @dragleave.prevent="dragDepth = Math.max(0, dragDepth - 1)"
			@dragover.prevent="onDragOver" @drop.prevent.stop="onDrop">
			<svg class="app-input__file-icon" viewBox="0 0 80 96" fill="none" aria-hidden="true">
				<path d="M17 4h31l22 22v59a7 7 0 0 1-7 7H17a7 7 0 0 1-7-7V11a7 7 0 0 1 7-7Z" fill="var(--color-surface)" stroke="currentColor" stroke-width="4" stroke-linejoin="round" />
				<path d="M48 4v22h22" stroke="currentColor" stroke-width="4" stroke-linejoin="round" />
				<text x="40" y="66" text-anchor="middle" fill="currentColor" font-size="25" font-family="sans-serif" font-weight="700">PE</text>
			</svg>
			<h1 id="upload-title">{{ dragDepth > 0 ? 'Drop your file to select it' : 'Open a Windows binary' }}</h1>
			<p id="upload-description">Drag and drop a file here, or choose one from your device.</p>
			<p class="app-input__formats">.exe, .dll, .sys and other PE files</p>
			<input ref="fileInput" class="app-input__file-input" type="file" :disabled="loading" tabindex="-1" aria-label="Choose a Windows binary" @change="onFileChange">
			<button ref="chooseButton" class="app-input__choose" type="button" :disabled="loading" @click="chooseFile">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
				</svg>
				{{ loading ? 'Loading file…' : selectedFile ? 'Choose another file…' : 'Choose a file…' }}
			</button>
		</section>

		<div class="app-input__feedback" role="status" aria-live="polite" aria-atomic="true">
			<p v-if="error" class="app-input__error">{{ error }}</p>
		</div>
		<p class="app-input__privacy">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" stroke-width="1.6" /><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.6" /></svg>
			Your file stays on your device.
		</p>
	</div>
</template>

<style>
.app-input { width: min(100%, 760px); margin: auto; padding: 40px 28px; text-align: center; }
.app-input__dropzone { padding: 48px 24px; border: 2px dashed color-mix(in srgb, var(--color-secondary) 35%, var(--color-border)); border-radius: 12px; background: var(--color-surface); transition: border-color .15s, background .15s; }
.app-input__dropzone--active { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface)); }
.app-input__file-icon { width: 72px; height: 86px; margin-bottom: 22px; color: var(--color-secondary); user-select: none; }
.app-input__dropzone h1 { margin: 0; color: var(--color-text); font-size: 28px; font-weight: 650; letter-spacing: -.7px; line-height: 1.3; }
.app-input__dropzone p { margin: 12px 0 0; color: var(--color-muted); font-size: 15px; line-height: 1.6; }
.app-input__dropzone .app-input__formats { margin: 8px 0 26px; color: var(--color-muted); font-size: 12px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.app-input__file-input { display: none; }
.app-input__choose { display: inline-flex; align-items: center; justify-content: center; gap: 12px; min-height: 42px; padding: 10px 20px; border: 1px solid var(--color-accent-hover); border-radius: 6px; background: var(--color-accent); color: var(--color-on-accent); font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 3px 7px color-mix(in srgb, var(--color-accent) 10%, transparent); }
.app-input__choose:disabled { opacity: .6; cursor: wait; box-shadow: none; }
.app-input__choose:hover:not(:disabled) { background: var(--color-accent-hover); }
.app-input__choose:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 4px; }
.app-input__feedback { text-align: left; }
.app-input__error { margin: 18px 0 0; color: var(--color-danger); font-size: 14px; }
.app-input__privacy { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 24px 0 0; color: var(--color-muted); font-size: 13px; }
@media (max-width: 560px) {
	.app-input { padding: 32px 20px; }
	.app-input__dropzone { padding: 32px 18px; }
	.app-input__dropzone h1 { font-size: 24px; }
	.app-input__dropzone p { font-size: 14px; }
}
</style>

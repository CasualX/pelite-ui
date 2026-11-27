<link rel="component" href="../../components/property-grid.vue">
<link rel="component" href="resource-format.vue.js">

<script>
/** @param {string[]} path @param {string} name @param {string} extension */
function resourceDownloadName(path, name, extension) {
	const stem = path.join('-').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 160);
	// Preserve a real filename in the resource tree, when present.
	if (/\.[a-z\d]{1,12}$/i.test(name) && name.length <= 160) {
		return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
	}
	return `${stem || 'resource'}.${extension}`;
}

const ResourceDetails = Vue.defineComponent({
	template: '#resource-details',
	props: {
		entry: { type: Object, default: null },
		path: { type: Array, required: true },
		fileOffset: { type: Number, default: null },
		languageId: { type: Number, default: null },
	},
	data() {
		return {
			metadataColumns: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', width: 'clamp(6.5rem, 34%, 11rem)', format: (_value, field) => String(field) },
				{ title: 'Value', kind: (_value, field) => field === 'Data RVA' ? 'rva' : field === 'File offset' ? 'fo' : undefined,
					format: (value, field) => field === 'Data RVA' || field === 'File offset' || field === 'Reserved'
						? formatPropertyGridHex(value) : String(value) },
			]),
			downloadUrl: '',
			previewUrl: '',
			previewFailed: false,
			dimensions: '',
			duration: '',
		};
	},
	computed: {
		resourceEntry() { return /** @type {PeLite.PeResourceData | null} */ (this.entry); },
		resourcePath() { return /** @type {string[]} */ (this.path); },
		resourceNameIndex() { return this.languageId === null ? this.resourcePath.length - 1 : 1; },
		resourceName() { return this.resourcePath[this.resourceNameIndex] ?? 'Resource'; },
		filename() { return resourceDownloadName(this.resourcePath, this.resourceName, this.content?.format.extension ?? 'bin'); },
		bytes() {
			const bytes = this.resourceEntry?.bytes;
			return bytes == null ? null : Uint8Array.from(atob(bytes), char => char.charCodeAt(0));
		},
		content() {
			return this.bytes && this.resourceEntry
				? describeResource(this.bytes, this.resourcePath[0], this.resourceEntry.code_page) : null;
		},
		previewKind() {
			const content = this.content;
			if (!content) return;
			if (content.text !== undefined) return 'text';
			if (content.format.extension === 'dib' && !content.bitmapHeader) return;
			return content.format.mime.split('/')[0];
		},
		metadata() {
			const resource = this.resourceEntry;
			if (!resource) return {};
			const fields = /** @type {Record<string, string | number>} */ ({
				'Size': `${resource.size.toLocaleString()} bytes`,
				'Data RVA': resource.image.OffsetToData,
				'Code page': resource.code_page,
				'Reserved': resource.image.Reserved,
			});
			if (this.fileOffset !== null) fields['File offset'] = this.fileOffset;
			if (this.languageId !== null) fields['Language ID'] = this.languageId;
			if (this.content) {
				fields['Format'] = this.content.format.label;
				fields['MIME type'] = this.content.format.mime;
			}
			if (this.dimensions) fields['Dimensions'] = this.dimensions;
			if (this.duration) fields['Duration'] = this.duration;
			return fields;
		},
	},
	mounted() {
		if (!this.bytes || !this.content) return;
		// Keep extracted markup inert even when its download link is opened in a new tab.
		const file = new Blob([this.bytes], { type: 'application/octet-stream' });
		this.downloadUrl = URL.createObjectURL(file);
		if (this.content.bitmapHeader) {
			this.previewUrl = URL.createObjectURL(new Blob([this.content.bitmapHeader, file], { type: 'image/bmp' }));
		} else if (['image', 'audio', 'video'].includes(this.previewKind ?? '')) {
			this.previewUrl = URL.createObjectURL(new Blob([file], { type: this.content.format.mime }));
		}
	},
	beforeUnmount() {
		URL.revokeObjectURL(this.downloadUrl);
		URL.revokeObjectURL(this.previewUrl);
	},
	methods: {
		/** @param {Event} event */
		readPreviewMetadata(event) {
			const element = event.currentTarget;
			if (element instanceof HTMLImageElement) this.dimensions = `${element.naturalWidth} × ${element.naturalHeight} px`;
			if (element instanceof HTMLVideoElement && element.videoWidth) this.dimensions = `${element.videoWidth} × ${element.videoHeight} px`;
			if (element instanceof HTMLMediaElement && Number.isFinite(element.duration)) this.duration = `${element.duration.toFixed(2)} s`;
		},
	},
});
</script>

<template id="resource-details">
	<section class="resource-details" aria-label="Resource details">
		<header class="resource-details__header">
			<p class="resource-details__path">
				<template v-for="(segment, index) in resourcePath" :key="index">
					<span v-if="index"> / </span><strong v-if="index === resourceNameIndex">{{ segment }}</strong><template v-else>{{ segment }}</template>
				</template>
			</p>
			<a v-if="downloadUrl" class="resource-details__download" :href="downloadUrl" :download="filename"
				:title="'Download ' + filename">Download</a>
		</header>
		<property-grid v-if="resourceEntry" :list="metadata" :interpretations="metadataColumns" label="Resource metadata"></property-grid>
		<div v-if="content" class="resource-details__preview">
			<h3>Preview</h3>
			<p v-if="previewFailed" role="status">The browser couldn’t preview this file. You can still download it.</p>
			<template v-else-if="previewKind === 'text'">
				<p v-if="content.truncated">Showing the first 64 KiB.</p>
				<pre tabindex="0" aria-label="Text preview">{{ content.text }}</pre>
			</template>
			<img v-else-if="previewKind === 'image'" :src="previewUrl || undefined" :alt="'Preview of ' + filename"
				@load="readPreviewMetadata" @error="previewFailed = true">
			<audio v-else-if="previewKind === 'audio'" :src="previewUrl || undefined" controls preload="metadata" :aria-label="'Preview of ' + filename"
				@loadedmetadata="readPreviewMetadata" @error="previewFailed = true"></audio>
			<video v-else-if="previewKind === 'video'" :src="previewUrl || undefined" controls playsinline preload="metadata" :aria-label="'Preview of ' + filename"
				@loadedmetadata="readPreviewMetadata" @error="previewFailed = true"></video>
			<p v-else>{{ bytes?.length ? 'No preview available for this format.' : 'This resource is empty.' }}</p>
		</div>
		<p v-else class="resource-details__message">Resource bytes are unavailable.</p>
	</section>
</template>

<style>
.resource-details__header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px var(--workspace-gutter, 12px); border-bottom: 1px solid var(--color-border); }
.resource-details__path { min-width: 0; margin: 0; color: var(--color-muted); font-size: 14px; line-height: 1.45; overflow-wrap: anywhere; }
.resource-details__path strong { color: var(--color-text); }
.resource-details__download { flex: none; min-height: 28px; padding: 5px 9px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); color: var(--color-text); font-size: 12px; text-decoration: none; }
.resource-details__download:hover { border-color: var(--color-accent); }
.resource-details__download:focus-visible, .resource-details__preview pre:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.resource-details__preview { padding: 12px var(--workspace-gutter, 12px); }
.resource-details__preview h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
.resource-details__preview p, .resource-details__message { margin: 0 0 8px; color: var(--color-muted); font-size: 13px; }
.resource-details__message { margin: 12px var(--workspace-gutter, 12px); }
.resource-details__preview img, .resource-details__preview video { display: block; max-width: 100%; max-height: 28rem; object-fit: contain; }
.resource-details__preview img { background-color: var(--color-background); background-image: conic-gradient(var(--color-surface) 25%, transparent 0 50%, var(--color-surface) 0 75%, transparent 0); background-size: 16px 16px; }
.resource-details__preview audio { display: block; width: min(100%, 30rem); }
.resource-details__preview pre { margin: 0; padding: 10px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 4; background: var(--color-surface); font: 12px/1.65 ui-monospace, SFMono-Regular, Consolas, monospace; }
</style>

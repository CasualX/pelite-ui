/** @typedef {{ label: string, mime: string, extension: string }} ResourceFormat */
/** @typedef {{ format: ResourceFormat, text?: string, truncated?: boolean, bitmapHeader?: ArrayBuffer }} ResourceContent */

const binaryResourceFormat = { label: 'Unknown binary', mime: 'application/octet-stream', extension: 'bin' };

/** Match headers against the exact bytes without using a resource's name as a type hint.
 * @type {{ format: ResourceFormat, signature: string, offset?: number, prefix?: string }[]}
 */
const resourceSignatures = [
	{ format: { label: 'PNG image', mime: 'image/png', extension: 'png' }, signature: '\x89PNG\r\n\x1a\n' },
	{ format: { label: 'JPEG image', mime: 'image/jpeg', extension: 'jpg' }, signature: '\xff\xd8\xff' },
	{ format: { label: 'GIF image', mime: 'image/gif', extension: 'gif' }, signature: 'GIF87a' },
	{ format: { label: 'GIF image', mime: 'image/gif', extension: 'gif' }, signature: 'GIF89a' },
	{ format: { label: 'Bitmap image', mime: 'image/bmp', extension: 'bmp' }, signature: 'BM' },
	{ format: { label: 'Windows icon', mime: 'image/x-icon', extension: 'ico' }, signature: '\x00\x00\x01\x00' },
	{ format: { label: 'WebP image', mime: 'image/webp', extension: 'webp' }, signature: 'WEBP', offset: 8, prefix: 'RIFF' },
	{ format: { label: 'WAV audio', mime: 'audio/wav', extension: 'wav' }, signature: 'WAVE', offset: 8, prefix: 'RIFF' },
	{ format: { label: 'FLAC audio', mime: 'audio/flac', extension: 'flac' }, signature: 'fLaC' },
	{ format: { label: 'MP3 audio', mime: 'audio/mpeg', extension: 'mp3' }, signature: 'ID3' },
	{ format: { label: 'AVI video', mime: 'video/x-msvideo', extension: 'avi' }, signature: 'AVI ', offset: 8, prefix: 'RIFF' },
	{ format: { label: 'PDF document', mime: 'application/pdf', extension: 'pdf' }, signature: '%PDF-' },
	{ format: { label: 'ZIP archive', mime: 'application/zip', extension: 'zip' }, signature: 'PK\x03\x04' },
	{ format: { label: 'Gzip archive', mime: 'application/gzip', extension: 'gz' }, signature: '\x1f\x8b\x08' },
];

const resourceTextPreviewLimit = 64 * 1024;

/** Windows bitmap resources contain a DIB without the 14-byte BMP file header.
 * @param {Uint8Array} bytes @returns {ArrayBuffer | undefined}
 */
function resourceBitmapHeader(bytes) {
	if (bytes.length < 12) return undefined;
	const dib = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const size = dib.getUint32(0, true);
	if (![12, 40, 52, 56, 108, 124].includes(size) || size > bytes.length) return undefined;
	const core = size === 12;
	const bits = dib.getUint16(core ? 10 : 14, true);
	const compression = core ? 0 : dib.getUint32(16, true);
	if (![1, 4, 8, 16, 24, 32].includes(bits) || ![0, 1, 2, 3, 6].includes(compression)) return undefined;
	const masks = size === 40 && compression === 3 ? 12 : size === 40 && compression === 6 ? 16 : 0;
	const colors = (core ? 0 : dib.getUint32(32, true)) || (bits <= 8 ? 2 ** bits : 0);
	const pixels = size + masks + colors * (core ? 3 : 4);
	if (pixels >= bytes.length) return undefined;
	const header = new ArrayBuffer(14);
	const view = new DataView(header);
	view.setUint16(0, 0x4d42, true);
	view.setUint32(2, header.byteLength + bytes.length, true);
	view.setUint32(10, header.byteLength + pixels, true);
	return header;
}

/** @param {Uint8Array} bytes @param {number} codePage */
function resourceText(bytes, codePage) {
	const sample = bytes.subarray(0, resourceTextPreviewLimit);
	const truncated = sample.length < bytes.length;
	const le = (sample[0] === 0xff && sample[1] === 0xfe) || (sample[0] === 0x3c && sample[1] === 0 && sample[3] === 0);
	const be = (sample[0] === 0xfe && sample[1] === 0xff) || (sample[0] === 0 && sample[1] === 0x3c && sample[2] === 0);
	const initialEncoding = le ? 'utf-16le' : be ? 'utf-16be' : { 1200: 'utf-16le', 1201: 'utf-16be' }[codePage] ?? 'utf-8';
	const encodings = [initialEncoding];
	if (codePage >= 1250 && codePage <= 1258) encodings.push(`windows-${codePage}`);
	for (const encoding of encodings) {
		try {
			const text = new TextDecoder(encoding, { fatal: true }).decode(sample, { stream: truncated });
			// Permit whitespace used in text files while rejecting binary control characters.
			if (text && !/[\x00-\x08\x0e-\x1f\x7f-\x9f]/.test(text)) return { text, truncated };
		} catch { /* Try the declared code page if UTF-8 decoding failed. */ }
	}
}

/** @param {Uint8Array} bytes @param {string} type @param {number} codePage @returns {ResourceContent} */
function describeResource(bytes, type, codePage) {
	const header = String.fromCharCode(...bytes.subarray(0, 256));
	const match = resourceSignatures.find(({ signature, offset, prefix }) =>
		header.startsWith(signature, offset) && (!prefix || header.startsWith(prefix)));
	if (match) return { format: match.format };
	if (type === '#BITMAP' || type === '#2') {
		return {
			format: { label: 'Device-independent bitmap', mime: 'image/bmp', extension: 'dib' },
			bitmapHeader: resourceBitmapHeader(bytes),
		};
	}
	if (header.startsWith('ftyp', 4)) {
		const brand = header.slice(8, 12);
		if (brand === 'avif' || brand === 'avis') return { format: { label: 'AVIF image', mime: 'image/avif', extension: 'avif' } };
		if (brand === 'M4A ') return { format: { label: 'MPEG-4 audio', mime: 'audio/mp4', extension: 'm4a' } };
		if (brand === 'qt  ') return { format: { label: 'QuickTime video', mime: 'video/quicktime', extension: 'mov' } };
		if (/^(?:isom|iso[2-9]|mp4[12]|avc1|dash|M4V )$/.test(brand)) {
			return { format: { label: 'MP4 video', mime: 'video/mp4', extension: 'mp4' } };
		}
	}
	if (header.startsWith('\x1a\x45\xdf\xa3') && header.includes('\x42\x82\x84webm')) {
		return { format: { label: 'WebM media', mime: 'video/webm', extension: 'webm' } };
	}
	if (header.startsWith('OggS')) {
		const packet = 27 + (bytes[26] ?? 0);
		if (header.startsWith('\x80theora', packet)) return { format: { label: 'Ogg video', mime: 'video/ogg', extension: 'ogv' } };
		return { format: { label: 'Ogg audio', mime: 'audio/ogg', extension: 'ogg' } };
	}
	const preview = resourceText(bytes, codePage);
	if (!preview) return { format: binaryResourceFormat };
	if (/^\s*(?:<\?xml[^?]*\?>\s*)?<svg(?:\s|>)/i.test(preview.text)) {
		return { format: { label: 'SVG image', mime: 'image/svg+xml', extension: 'svg' }, ...preview };
	}
	if (type === '#MANIFEST' || /^\s*<\?xml\b/.test(preview.text)) {
		return { format: { label: 'XML document', mime: 'application/xml', extension: 'xml' }, ...preview };
	}
	if (type === '#HTML' || /^\s*(?:<!doctype html\b|<html\b)/i.test(preview.text)) {
		return { format: { label: 'HTML document', mime: 'text/html', extension: 'html' }, ...preview };
	}
	return { format: { label: 'Plain text', mime: 'text/plain', extension: 'txt' }, ...preview };
}

<link rel="component" href="../../components/property-grid.vue">

<script>
/** @typedef {{ fileSize: number, hashes: import('./deps/pelite.js').PeHashes, sectionEntropy: import('./deps/pelite.js').SectionEntropy[], imports: SummaryImports, headers: import('./deps/pelite.js').PeHeaders, tls: import('./deps/pelite.js').Result<import('./deps/pelite.js').PeTls | null>, pdbFileName: import('./deps/pelite.js').Result<string | null> }} SummaryViewData */

/** @typedef {{ libraries: number, functions: number, by_library: { name: string, functions: number }[], notable: Record<string, string[]>, complete: boolean }} SummaryImports */

const summaryImportCategories = {
	'process execution': ['CreateProcessA', 'CreateProcessW', 'ShellExecuteA', 'ShellExecuteW', 'WinExec'],
	'process access / injection': ['VirtualAllocEx', 'WriteProcessMemory', 'ReadProcessMemory', 'CreateRemoteThread', 'NtMapViewOfSection', 'NtUnmapViewOfSection', 'OpenProcess'],
	'networking': ['InternetOpenA', 'InternetOpenW', 'InternetConnectA', 'InternetConnectW', 'HttpOpenRequestA', 'HttpOpenRequestW', 'HttpSendRequestA', 'HttpSendRequestW', 'URLDownloadToFileA', 'URLDownloadToFileW', 'WSAStartup', 'connect', 'recv', 'send'],
	'services / registry': ['CreateServiceA', 'CreateServiceW', 'StartServiceA', 'StartServiceW', 'RegSetValueExA', 'RegSetValueExW'],
	'cryptography': ['CryptDecrypt', 'CryptEncrypt', 'CryptAcquireContextA', 'CryptAcquireContextW', 'BCryptDecrypt', 'BCryptEncrypt'],
	'anti-analysis': ['IsDebuggerPresent', 'CheckRemoteDebuggerPresent', 'NtQueryInformationProcess', 'GetTickCount', 'QueryPerformanceCounter'],
	'dynamic loading': ['LoadLibraryA', 'LoadLibraryW', 'LoadLibraryExA', 'LoadLibraryExW', 'GetProcAddress'],
};

/** @param {import('./deps/pelite.js').Result<import('./deps/pelite.js').PeImportDescriptor[] | null>} result @param {boolean} present @returns {SummaryImports} */
function summarizeImports(result, present) {
	const summary = /** @type {SummaryImports} */ ({ libraries: 0, functions: 0, by_library: [], notable: {}, complete: true });
	if (result === null || result instanceof Error) {
		summary.complete = !present;
		return summary;
	}
	const descriptors = result;
	for (const descriptor of descriptors) {
		if (descriptor.dll_name === null || descriptor.imports === null) {
			summary.complete = false;
			continue;
		}
		let functions = 0;
		for (const row of descriptor.imports) {
			if (row.import === null) { summary.complete = false; continue; }
			functions++;
			const name = row.import.ByName?.name;
			if (name === undefined) continue;
			const category = Object.entries(summaryImportCategories).find(([, names]) => names.some(symbol => symbol.toLowerCase() === name.toLowerCase()))?.[0];
			if (category !== undefined) (summary.notable[category] ??= []).push(`${descriptor.dll_name}!${name}`);
		}
		summary.by_library.push({ name: descriptor.dll_name, functions });
		summary.functions += functions;
	}
	summary.libraries = summary.by_library.length;
	return summary;
}

/** @param {ViewContext} context @returns {ViewContent} */
function prepareSummaryView(context) {
	const hashes = context.peFile.hashes();
	if (hashes instanceof Error) throw hashes;
	const headers = context.peFile.headers();
	if (headers instanceof Error) throw headers;
	const imports = summarizeImports(context.peFile.imports(), !!headers.DataDirectory[1]?.VirtualAddress);
	const tls = context.peFile.tls();
	const pdbFileName = context.peFile.pdbFileName();
	const sectionEntropy = context.peFile.sectionEntropy();
	if (sectionEntropy instanceof Error) throw sectionEntropy;
	return { component: 'view-summary', data: { fileSize: context.file.size, hashes, sectionEntropy, imports, headers, tls, pdbFileName } };
}

/** @param {number} value @returns {string} */
function formatSummaryHex(value) { return value === 0 ? '0' : `0x${value.toString(16)}`; }

/** @param {number} value @returns {string} */
function formatSummarySize(value) { return `${value.toLocaleString()} bytes`; }

const ViewSummary = Vue.defineComponent({
	template: '#view-summary',
	props: { data: { type: Object, required: true } },
	data() {
		return {
			hashInterpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Hash', style: { minWidth: '120px' }, format: (value, name) => ({ md5: 'MD5', sha256: 'SHA-256', imphash: 'Import hash' })[name] ?? String(name) },
				{ title: 'Value', style: { minWidth: '520px' }, format: value => value === null ? 'Unavailable' : String(value) },
			]),
			importInterpretations: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Library', style: { minWidth: '260px' }, format: value => (/** @type {{ name: string }} */ (value)).name },
				{ title: 'Functions', style: { minWidth: '100px', textAlign: 'right' }, format: value => String((/** @type {{ functions: number }} */ (value)).functions) },
			]),
		};
	},
	computed: {
		summaryData() { return /** @type {SummaryViewData} */ (/** @type {unknown} */ (this.data)); },
		imports() { return this.summaryData.imports; },
		headers() { return this.summaryData.headers; },
		optional() { return this.headers.NtHeaders.OptionalHeader; },
		entryPointSection() {
			const rva = this.optional.AddressOfEntryPoint;
			return this.headers.SectionHeaders.findIndex(section => rva >= section.VirtualAddress && rva < ((section.VirtualAddress + section.VirtualSize) >>> 0));
		},
		tlsCallbacks() {
			const tls = this.summaryData.tls;
			if (tls instanceof Error) return null;
			if (tls === null || tls.image.AddressOfCallBacks === 0) return 0;
			return tls.callbacks === null ? null : tls.callbacks.length;
		},
		overlay() {
			const fileSize = this.summaryData.fileSize;
			let offset = this.optional.SizeOfHeaders;
			for (const section of this.headers.SectionHeaders) {
				offset = Math.max(offset, Math.min(section.PointerToRawData + section.SizeOfRawData, fileSize));
			}
			offset = Math.min(offset, fileSize);
			const size = fileSize - offset;
			// The security directory uses a file offset, unlike the other directories' RVAs.
			const certificate = this.headers.DataDirectory[4];
			const overlap = certificate === undefined ? 0 : Math.max(0,
				Math.min(certificate.VirtualAddress + certificate.Size, fileSize) - Math.max(certificate.VirtualAddress, offset));
			return { offset, size, outside_certificate: size - Math.min(overlap, size) };
		},
		findings() {
			const findings = /** @type {{ level: 'warning' | 'note', message: string }[]} */ ([]);
			const entrySection = this.headers.SectionHeaders[this.entryPointSection];
			if (this.optional.AddressOfEntryPoint !== 0 && entrySection === undefined) {
				findings.push({ level: 'warning', message: 'Entry point is outside the declared sections' });
			} else if (entrySection !== undefined && !(entrySection.Characteristics & 0x20000000)) {
				findings.push({ level: 'warning', message: `Entry point is in non-executable section ${entrySection.Name}` });
			}
			if (this.overlay.outside_certificate !== 0) {
				findings.push({ level: 'note', message: `${this.overlay.outside_certificate} bytes follow the last section outside the certificate table` });
			}
			if (!this.imports.complete) {
				findings.push({ level: 'warning', message: 'Some imports could not be parsed; import counts may be incomplete' });
			}
			if (this.hasNotableImports) {
				findings.push({ level: 'note', message: 'Notable imports suggest capabilities worth reviewing; imports alone do not prove behavior' });
			}
			for (const { header, analysis } of this.sections) {
				if ((header.Characteristics & 0x20000000) && (header.Characteristics & 0x80000000)) {
					findings.push({ level: 'warning', message: `Section ${header.Name} is both writable and executable` });
				}
				if (analysis.entropy !== null && analysis.entropy >= 7.2 && header.SizeOfRawData >= 256) {
					findings.push({ level: 'note', message: `Section ${header.Name} has high entropy (${analysis.entropy.toFixed(2)}); it may be compressed or encrypted` });
				}
				if (analysis.entropy === null && header.SizeOfRawData !== 0) {
					findings.push({ level: 'warning', message: `Section ${header.Name} has an invalid raw-data range` });
				}
			}
			if (this.tlsCallbacks === null) {
				findings.push({ level: 'warning', message: this.summaryData.tls instanceof Error ? 'TLS directory could not be parsed' : 'TLS callbacks could not be parsed' });
			} else if (this.tlsCallbacks !== 0) {
				findings.push({ level: 'note', message: `Contains ${this.tlsCallbacks} TLS callback(s) that run before the normal entry point` });
			}
			if (this.summaryData.pdbFileName instanceof Error) {
				findings.push({ level: 'warning', message: 'PDB file name could not be parsed' });
			}
			return findings;
		},
		identity() {
			const file = this.headers.NtHeaders.FileHeader;
			const kind = (file.Characteristics & 0x1000) || (this.optional.DllCharacteristics & 0x2000) ? 'Driver' : file.Characteristics & 0x2000 ? 'DLL' : 'Executable';
			const machine = String(this.headers.details['FileHeader.Machine'] ?? formatSummaryHex(file.Machine)).replace('IMAGE_FILE_MACHINE_', '');
			const subsystem = String(this.headers.details['OptionalHeader.Subsystem'] ?? formatSummaryHex(this.optional.Subsystem)).replace('IMAGE_SUBSYSTEM_', '').replaceAll('_', ' ');
			return `${this.optional.Magic === 0x20b ? 'PE32+' : 'PE32'} · ${machine} · ${kind} · ${subsystem}`;
		},
		imageFields() {
			const timestamp = this.headers.NtHeaders.FileHeader.TimeDateStamp;
			const entrySection = this.entryPointSection;
			const checksum = this.optional.CheckSum;
			const checksumState = checksum === 0 ? 'Not set' : checksum === this.headers.details['OptionalHeader.CheckSum'] ? 'Valid' : 'Does not match';
			const certificate = this.headers.DataDirectory[4];
			const clr = this.headers.DataDirectory[14];
			return [
				{ label: 'File size', value: formatSummarySize(this.summaryData.fileSize) },
				{ label: 'Image size', value: formatSummarySize(this.optional.SizeOfImage) },
				{ label: 'Entry point', value: `${formatSummaryHex(this.optional.AddressOfEntryPoint)} · ${entrySection < 0 ? 'No section' : this.headers.SectionHeaders[entrySection].Name}` },
				{ label: 'Image base', value: formatSummaryHex(this.optional.ImageBase) },
				{ label: 'Timestamp (self-reported)', value: timestamp === 0 || timestamp === 0xffffffff ? 'Unspecified' : new Date(timestamp * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC') },
				{ label: 'Checksum', value: `${formatSummaryHex(checksum)} · ${checksumState}` },
				{ label: 'Certificate table', value: certificate?.VirtualAddress && certificate.Size ? 'Present (not validated)' : 'Not present' },
				{ label: 'CLR (.NET)', value: clr?.VirtualAddress && clr.Size ? 'Present' : 'Not present' },
				{ label: 'TLS callbacks', value: this.tlsCallbacks === null ? 'Unavailable' : String(this.tlsCallbacks) },
				{ label: 'Overlay', value: `${formatSummarySize(this.overlay.size)} at file offset ${formatSummaryHex(this.overlay.offset)}` },
				...(this.summaryData.pdbFileName === null ? [] : [{ label: 'PDB path', value: this.summaryData.pdbFileName instanceof Error ? 'Unavailable' : this.summaryData.pdbFileName }]),
			];
		},
		mitigations() {
			return [{ name: 'ASLR', flag: 0x40 }, { name: 'DEP / NX', flag: 0x100 }, { name: 'CFG', flag: 0x4000 }, { name: 'High-entropy VA', flag: 0x20 }]
				.map(item => ({ name: item.name, enabled: !!(this.optional.DllCharacteristics & item.flag) }));
		},
		sections() {
			return this.headers.SectionHeaders.map((header, index) => ({ header, analysis: this.summaryData.sectionEntropy[index], entry: this.entryPointSection === index }));
		},
		hasNotableImports() { return Object.keys(this.imports.notable).length > 0; },
	},
	methods: {
		formatSummaryHex, formatSummarySize,
		/** @param {number} flags @returns {string} */
		permissions(flags) { return [[0x40000000, 'R'], [0x80000000, 'W'], [0x20000000, 'X']].map(([flag, letter]) => flags & Number(flag) ? letter : '—').join(''); },
	},
});
</script>

<template id="view-summary">
	<section class="view-summary">
		<p class="view-summary__identity">{{ identity }}</p>
		<dl class="view-summary__image">
			<div v-for="field in imageFields" :key="field.label"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></div>
		</dl>
		<h2>Hashes</h2>
		<property-grid :list="summaryData.hashes" :interpretations="hashInterpretations" label="File hashes"></property-grid>
		<h2>Declared mitigations</h2>
		<ul class="view-summary__mitigations">
			<li v-for="item in mitigations" :key="item.name" :class="{ 'view-summary__mitigation--enabled': item.enabled }">{{ item.name }} <span>{{ item.enabled ? 'Yes' : 'No' }}</span></li>
		</ul>
		<h2>Sections</h2>
		<div v-if="sections.length" class="view-summary__sections">
			<table aria-label="Section summary">
				<thead><tr><th scope="col">Name</th><th scope="col">RVA</th><th scope="col">Virtual size</th><th scope="col">Raw size</th><th scope="col">Permissions</th><th scope="col">Entropy</th><th scope="col">Distribution</th><th scope="col">Entry</th></tr></thead>
				<tbody><tr v-for="(section, index) in sections" :key="index">
					<td>{{ section.header.Name }}</td><td>{{ formatSummaryHex(section.header.VirtualAddress) }}</td><td>{{ formatSummaryHex(section.header.VirtualSize) }}</td><td>{{ formatSummaryHex(section.header.SizeOfRawData) }}</td><td>{{ permissions(section.header.Characteristics) }}</td><td>{{ section.analysis.entropy?.toFixed(2) ?? '—' }}</td>
					<td><div class="view-summary__entropy" aria-label="Entropy distribution, scale 0 to 8"><span v-for="(entropy, sample) in section.analysis.samples" :key="sample" :style="{ height: (entropy / 8 * 100) + '%' }" :title="entropy.toFixed(2)"></span></div></td><td>{{ section.entry ? '← Entry point' : '' }}</td>
				</tr></tbody>
			</table>
		</div>
		<p v-else class="view-summary__muted">No sections.</p>
		<h2>Imports <span class="view-summary__muted">{{ imports.functions }} functions · {{ imports.libraries }} libraries</span></h2>
		<property-grid v-if="imports.by_library.length" :list="imports.by_library" :interpretations="importInterpretations" label="Import summary"></property-grid>
		<p v-else class="view-summary__muted">No parsed imports.</p>
		<details v-if="hasNotableImports" class="view-summary__notable">
			<summary>Notable imports</summary>
			<p class="view-summary__muted">These imports suggest capabilities to review in context; they do not prove behavior.</p>
			<dl><div v-for="(symbols, category) in imports.notable" :key="category"><dt>{{ category }}</dt><dd>{{ symbols.join(', ') }}</dd></div></dl>
		</details>
		<h2>Signals to review</h2>
		<ul v-if="findings.length" class="view-summary__findings"><li v-for="(finding, index) in findings" :key="index"><span :class="{ 'view-summary__warning': finding.level === 'warning' }">{{ finding.level }}</span>{{ finding.message }}</li></ul>
		<p v-else class="view-summary__muted">No findings from these lightweight checks.</p>
	</section>
</template>

<style>
.view-summary__identity { margin: 0 0 20px; font-size: 15px; font-weight: 600; }
.view-summary h2 { margin: 26px 0 12px; font-size: 13px; font-weight: 600; }
.view-summary h2 span { margin-left: 12px; font-size: 12px; font-weight: 400; }
.view-summary__image { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 32px; max-width: 1120px; margin: 0; }
.view-summary__image div { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 12px; font-size: 12px; }
.view-summary dt { color: var(--color-muted); }
.view-summary dd { margin: 0; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.view-summary__mitigations { display: flex; gap: 12px; margin: 0; padding: 0; list-style: none; font-size: 12px; }
.view-summary__mitigations li { padding: 7px 10px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-muted); }
.view-summary__mitigations span { margin-left: 12px; font-weight: 600; }
.view-summary__mitigation--enabled span { color: var(--color-secondary); }
.view-summary__sections { overflow-x: auto; max-width: 100%; }
.view-summary__sections table { width: max-content; border-collapse: collapse; border: 1px solid var(--color-border); font-size: 12px; }
.view-summary__sections th { padding: 9px 14px; background: var(--color-surface); color: var(--color-muted); font-weight: 600; white-space: nowrap; }
.view-summary__sections td { padding: 7px 14px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; white-space: nowrap; }
.view-summary__sections th, .view-summary__sections td { border-bottom: 1px solid var(--color-border); text-align: right; }
.view-summary__sections th:first-child, .view-summary__sections td:first-child { text-align: left; }
.view-summary__sections tbody tr:hover { background: var(--color-surface); }
.view-summary__entropy { display: flex; align-items: flex-end; gap: 2px; width: 96px; height: 20px; border-bottom: 1px solid var(--color-border); }
.view-summary__entropy span { flex: 1; min-height: 1px; background: var(--color-secondary); }
.view-summary__notable { margin-top: 16px; font-size: 12px; }
.view-summary__notable summary { width: max-content; cursor: pointer; font-weight: 600; user-select: none; }
.view-summary__notable summary:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.view-summary__notable dl div + div { margin-top: 12px; }
.view-summary__notable dt { margin-bottom: 4px; }
.view-summary__findings { max-width: 1120px; margin: 0; padding: 0; list-style: none; font-size: 12px; }
.view-summary__findings li { display: flex; gap: 16px; padding: 9px 0; border-bottom: 1px solid var(--color-border); line-height: 1.5; }
.view-summary__findings li > span { flex: 0 0 56px; color: var(--color-muted); }
.view-summary__findings .view-summary__warning { color: var(--color-warning); }
.view-summary__muted { color: var(--color-muted); font-size: 12px; line-height: 1.6; }
</style>

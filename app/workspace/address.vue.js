/** @typedef {{ kind: 'rva' | 'va' | 'fo', value: number | bigint }} WorkspaceAddressValue */

/** Resolve a typed address for viewers that work in the virtual image.
 * @param {import('./deps/pelite.js').PeFile} peFile @param {WorkspaceAddressValue} address @returns {number}
 */
function workspaceAddressToRva(peFile, address) {
	const rva = address.kind === 'va' ? peFile.vaToRva(address.value)
		: address.kind === 'fo' ? peFile.fileOffsetToRva(Number(address.value))
		: Number(address.value);
	if (rva instanceof Error) throw rva;
	return rva;
}

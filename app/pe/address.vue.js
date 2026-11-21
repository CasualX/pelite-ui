/** @typedef {{ kind: 'rva' | 'va' | 'fo', value: number | bigint }} WorkspaceAddressValue */

/** @param {string} text @returns {boolean} */
function isWorkspaceAddressText(text) { return /^(?:0x[\da-f]+|\d+)$/i.test(text.trim()); }

/** Resolve a typed address for viewers that work in the virtual image.
 * @param {PeDocument} openedDocument @param {WorkspaceAddressValue} address @returns {number}
 */
function workspaceAddressToRva(openedDocument, address) {
	const rva = address.kind === 'va' ? openedDocument.peFile.vaToRva(address.value)
		: address.kind === 'fo' ? openedDocument.peFile.fileOffsetToRva(Number(address.value))
		: Number(address.value);
	if (rva instanceof Error) throw rva;
	return rva;
}

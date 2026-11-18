/** @param {PointerEvent} event @param {(dx: number, dy: number) => void} move */
function trackWorkspacePointer(event, move) {
	if (event.button !== 0 || !event.isPrimary || !(event.currentTarget instanceof HTMLElement)) return;
	const control = event.currentTarget;
	const owner = control.ownerDocument.defaultView;
	if (!owner) return;
	const { pointerId, clientX, clientY } = event;
	const listeners = new AbortController();
	const options = { capture: true, signal: listeners.signal };
	/** @param {PointerEvent} next */
	const stop = next => { if (next.pointerId === pointerId) listeners.abort(); };
	event.preventDefault();
	control.setPointerCapture(pointerId);
	owner.addEventListener('pointermove', next => {
		if (next.pointerId !== pointerId) return;
		if (control.isConnected && (next.buttons & 1)) move(next.clientX - clientX, next.clientY - clientY);
		else listeners.abort();
	}, options);
	owner.addEventListener('pointerup', stop, options);
	owner.addEventListener('pointercancel', stop, options);
	owner.addEventListener('blur', () => listeners.abort(), { signal: listeners.signal });
}

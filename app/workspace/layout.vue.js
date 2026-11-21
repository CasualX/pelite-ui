/** @typedef {'row' | 'column'} WorkspaceDirection */
/** @typedef {{ type: 'pane', id: number, tabs: number[], selected: number | undefined }} WorkspacePaneNode */
/** @typedef {{ type: 'split', id: number, direction: WorkspaceDirection, ratio: number, first: WorkspaceNode, second: WorkspaceNode }} WorkspaceSplitNode */
/** @typedef {WorkspacePaneNode | WorkspaceSplitNode} WorkspaceNode */
/** @typedef {{ width: number, height: number }} WorkspaceSize */
/** @typedef {WorkspaceSize & { x: number, y: number }} WorkspaceBounds */
/** @typedef {{ viewId: number, bounds: WorkspaceBounds, layer: number }} WorkspaceFloatingWindow */

/** Workspace placement and focus. The host owns view IDs and their content. */
class WorkspaceLayout {
	constructor() {
		this.nextNodeId = 1;
		/** @type {WorkspaceNode} */
		this.root = this.createPane();
		this.lastPaneId = this.root.id;
		/** @type {{ type: 'pane' | 'window', id: number }} */
		this.focused = { type: 'pane', id: this.root.id };
		/** @type {WorkspaceFloatingWindow[]} */
		this.windows = [];
		this.nextLayer = 1;
	}

	/** @returns {WorkspacePaneNode[]} */
	get panes() {
		/** @param {WorkspaceNode} node @returns {WorkspacePaneNode[]} */
		const collect = node => node.type === 'pane' ? [node] : [...collect(node.first), ...collect(node.second)];
		return collect(this.root);
	}

	get activeViewId() {
		return this.focused.type === 'window' ? this.focused.id : this.panes.find(pane => pane.id === this.focused.id)?.selected;
	}

	/** @returns {WorkspacePaneNode} */
	createPane() {
		return { type: 'pane', id: this.nextNodeId++, tabs: [], selected: undefined };
	}

	/** @param {number} paneId */
	focusPane(paneId) {
		this.lastPaneId = paneId;
		if (this.focused.type !== 'pane' || this.focused.id !== paneId) this.focused = { type: 'pane', id: paneId };
	}

	/** @param {WorkspaceFloatingWindow} floating */
	focusWindow(floating) {
		if (this.focused.type === 'window' && this.focused.id === floating.viewId) return;
		floating.layer = this.nextLayer++;
		this.focused = { type: 'window', id: floating.viewId };
	}

	/** @param {number} viewId @param {number} [afterViewId] */
	open(viewId, afterViewId) {
		if (this.activate(viewId)) return;
		const panes = this.panes;
		const source = afterViewId === undefined ? undefined : panes.find(item => item.tabs.includes(afterViewId));
		const pane = source ?? panes.find(item => item.id === this.lastPaneId) ?? panes[0];
		if (source && afterViewId !== undefined) pane.tabs.splice(pane.tabs.indexOf(afterViewId) + 1, 0, viewId);
		else pane.tabs.push(viewId);
		pane.selected = viewId;
		this.focusPane(pane.id);
	}

	/** @param {number} viewId @param {WorkspaceSize} [size] */
	openWindow(viewId, { width, height } = { width: 640, height: 460 }) {
		if (this.activate(viewId)) return;
		const offset = 24 + this.windows.length % 6 * 24;
		this.windows.push({ viewId, bounds: { x: offset, y: offset, width, height }, layer: 0 });
		this.focusWindow(this.windows[this.windows.length - 1]);
	}

	/** @param {number} viewId */
	activate(viewId) {
		const pane = this.panes.find(item => item.tabs.includes(viewId));
		if (pane) {
			pane.selected = viewId;
			this.focusPane(pane.id);
			return true;
		}
		const floating = this.windows.find(item => item.viewId === viewId);
		if (!floating) return false;
		this.focusWindow(floating);
		return true;
	}

	/** Move a tab to an insertion index in the destination's current tab order.
	 * @param {number} viewId @param {number} paneId @param {number} index
	 */
	moveTab(viewId, paneId, index) {
		const panes = this.panes;
		const source = panes.find(pane => pane.tabs.includes(viewId));
		const target = panes.find(pane => pane.id === paneId);
		if (!source || !target || !Number.isInteger(index) || index < 0 || index > target.tabs.length) return false;
		if (source === target) {
			const from = source.tabs.indexOf(viewId);
			const to = index > from ? index - 1 : index;
			if (from === to) return false;
			source.tabs.splice(from, 1);
			source.tabs.splice(to, 0, viewId);
		} else {
			this.removeTab(source, viewId);
			target.tabs.splice(index, 0, viewId);
			target.selected = viewId;
			this.focusPane(target.id);
			this.closeEmptyPane(source.id);
		}
		return true;
	}

	/** @param {number} paneId @param {WorkspaceDirection} direction @param {number} [viewId] */
	split(paneId, direction, viewId) {
		const pane = this.panes.find(item => item.id === paneId);
		viewId ??= pane?.selected;
		if (!pane || viewId === undefined || !pane.tabs.includes(viewId)) return false;
		const second = this.createPane();
		second.selected = viewId;
		second.tabs.push(viewId);
		this.removeTab(pane, viewId);
		this.replaceNode(paneId, { type: 'split', id: this.nextNodeId++, direction, ratio: 0.5, first: pane, second });
		this.focusPane(second.id);
		return true;
	}

	/** @param {number} viewId @param {WorkspaceSize} [size] */
	float(viewId, size) {
		const pane = this.panes.find(item => item.tabs.includes(viewId));
		if (!pane) return false;
		this.focusPane(pane.id);
		this.removeTab(pane, viewId);
		this.closeEmptyPane(pane.id);
		this.openWindow(viewId, size);
		return true;
	}

	/** @param {number} viewId */
	dock(viewId) {
		const index = this.windows.findIndex(item => item.viewId === viewId);
		if (index < 0) return false;
		this.windows.splice(index, 1);
		this.open(viewId);
		return true;
	}

	/** @param {number} viewId */
	close(viewId) {
		const pane = this.panes.find(item => item.tabs.includes(viewId));
		if (pane) {
			this.removeTab(pane, viewId);
			this.closeEmptyPane(pane.id);
			return true;
		}
		const index = this.windows.findIndex(item => item.viewId === viewId);
		if (index < 0) return false;
		this.windows.splice(index, 1);
		if (this.focused.type === 'window' && this.focused.id === viewId) {
			this.focusPane(this.lastPaneId);
			if (this.activeViewId === undefined && this.windows.length) {
				const front = this.windows.reduce((a, b) => a.layer > b.layer ? a : b);
				this.focusWindow(front);
			}
		}
		return true;
	}

	/** @param {number} paneId */
	closeEmptyPane(paneId) {
		const panes = this.panes;
		const index = panes.findIndex(pane => pane.id === paneId);
		if (index < 0 || panes.length === 1 || panes[index].tabs.length) return false;
		const neighbor = panes[index + 1] ?? panes[index - 1];
		this.replaceNode(paneId);
		if (this.lastPaneId === paneId) this.lastPaneId = neighbor.id;
		if (this.focused.type === 'pane' && this.focused.id === paneId) this.focusPane(neighbor.id);
		return true;
	}

	/** @param {WorkspacePaneNode} pane @param {number} viewId */
	removeTab(pane, viewId) {
		const index = pane.tabs.indexOf(viewId);
		pane.tabs.splice(index, 1);
		if (pane.selected === viewId) pane.selected = pane.tabs[Math.min(index, pane.tabs.length - 1)];
	}

	/** @param {number} id @param {WorkspaceNode} [replacement] */
	replaceNode(id, replacement) {
		/** @param {WorkspaceNode} node @returns {WorkspaceNode | undefined} */
		const replace = node => {
			if (node.id === id) return replacement;
			if (node.type === 'pane') return node;
			const first = replace(node.first);
			const second = replace(node.second);
			if (!first || !second) return first ?? second;
			return first === node.first && second === node.second ? node : { ...node, first, second };
		};
		this.root = replace(this.root) ?? this.createPane();
	}
}

/** @param {number} value @param {number} min @param {number} max */
function clampWorkspaceValue(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

/** @param {WorkspaceBounds} bounds @param {WorkspaceSize} area @returns {WorkspaceBounds} */
function boundWorkspaceWindow(bounds, area) {
	const width = clampWorkspaceValue(bounds.width, Math.min(240, area.width), area.width);
	const height = clampWorkspaceValue(bounds.height, Math.min(160, area.height), area.height);
	return {
		x: clampWorkspaceValue(bounds.x, 0, area.width - width),
		y: clampWorkspaceValue(bounds.y, 0, area.height - height),
		width, height,
	};
}

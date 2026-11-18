/** @typedef {{ action: 'open-view', viewer: string, data?: unknown }} WorkspaceContextAction */
/** @typedef {{ component: string, data: Record<string, unknown>, titleSuffix?: string | null, duplicateData?: unknown, preferredWindowSize?: WorkspaceSize }} ViewContent */

/** A live content view. Window placement and docking belong to the window manager. */
class ViewModel {
	/** @param {number} id @param {ViewDefinition} definition @param {ViewContent} content */
	constructor(id, definition, content) {
		this.id = id;
		this.kind = definition.id;
		this.title = definition.title;
		this.icon = definition.icon;
		this.content = content;
	}

	get displayTitle() {
		const suffix = this.content.titleSuffix;
		return suffix ? `${this.title} - ${suffix}` : this.title;
	}
}

/** Owns the live views for one workspace; IDs are never reused within it. */
class PeWorkspaceModel {
	constructor() {
		/** @type {ViewModel[]} */
		this.views = [];
		this.layout = new WorkspaceLayout();
		this.nextViewId = 1;
	}

	get activeViewId() { return this.layout.activeViewId; }

	/** Fetches data before allocating an ID or adding the instance. Throws on failure.
	 * @param {ViewDefinition} definition @param {PeDocument} context @param {unknown} [data] @param {number} [afterViewId] @returns {ViewModel}
	 */
	createView(definition, context, data, afterViewId) {
		if (!definition.prepare) throw new Error('This view is unavailable.');
		const content = definition.prepare(context, data);
		const view = new ViewModel(this.nextViewId++, definition, content);
		this.views.push(view);
		this.layout.open(view.id, afterViewId);
		return view;
	}

	/** @param {number} id @returns {boolean} */
	closeView(id) {
		const index = this.views.findIndex(view => view.id === id);
		if (index < 0) return false;
		this.layout.close(id);
		this.views.splice(index, 1);
		return true;
	}
}

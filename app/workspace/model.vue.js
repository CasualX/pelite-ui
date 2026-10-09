/** @typedef {{ action: 'open-view', viewer: string, data?: unknown }} WorkspaceContextAction */
/** @typedef {{ file: File, peFile: import('./deps/pelite.js').PeFile }} ViewContext */
/** @typedef {{ component: string, data: Record<string, unknown>, titleSuffix?: string | null }} ViewContent */

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
class WorkspaceModel {
	constructor() {
		/** @type {ViewModel[]} */
		this.views = [];
		/** @type {number | undefined} */
		this.activeViewId = undefined;
		this.nextViewId = 1;
	}

	/** Fetches data before allocating an ID or adding the instance. Throws on failure.
	 * @param {ViewDefinition} definition @param {ViewContext} context @param {unknown} [data] @returns {ViewModel}
	 */
	createView(definition, context, data) {
		if (!definition.prepare) throw new Error('This view is unavailable.');
		const content = definition.prepare(context, data);
		const view = new ViewModel(this.nextViewId++, definition, content);
		this.views.push(view);
		return view;
	}

	/** Also used when the window manager reports focus. @param {number} id @returns {boolean} */
	activateView(id) {
		if (!this.views.some(view => view.id === id)) return false;
		this.activeViewId = id;
		return true;
	}

	/** @param {number} id @returns {boolean} */
	closeView(id) {
		const index = this.views.findIndex(view => view.id === id);
		if (index < 0) return false;
		this.views.splice(index, 1);
		if (this.activeViewId === id) {
			this.activeViewId = this.views[Math.min(index, this.views.length - 1)]?.id;
		}
		return true;
	}
}

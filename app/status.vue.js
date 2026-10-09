/** Presentation data for a status bar; the parent decides what it represents. */
class StatusModel {
	/** @param {string} color @param {string} text @param {string} message */
	constructor(color, text, message) {
		this.color = color;
		this.text = text;
		this.message = message;
	}
}

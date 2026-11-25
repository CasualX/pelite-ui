<script>
/** @typedef {(value: unknown, index: string | number) => string} PropertyGridFormatter */
/** @typedef {{ title: string, label?: string, width?: string, kind?: string | ((value: unknown, index: string | number) => string | undefined), style?: Record<string, string | number> } & ({ format: PropertyGridFormatter, slot?: string } | { slot: string, format?: PropertyGridFormatter })} PropertyGridColumn */
/** @typedef {unknown[] | Record<string, unknown>} PropertyGridList */

/** @param {unknown} value @returns {string} */
function formatPropertyGridHex(value) {
	if (value == null) return '—';
	return typeof value === 'number' && value !== 0 ? `0x${value.toString(16)}` : String(value);
}

// Each column interprets the original value and its array index or object key.
// Optional kind supplies a semantic data-kind hint for contextual tools.
// Current address kinds are rva, va, and fo; other kinds can be added later.
// Use a CSS length or percentage for width. Columns without a width share the remaining space.
// The grid supports container units such as max(10rem, 25cqi) for widths with a minimum.
// Set spacer when all data columns have widths and the remaining space should stay empty.
// A named cell slot receives value and index. A format callback can supply fallback text.
// style is applied to both the header and cells of the column.
// Set selectable to bind v-model:selected-index to the array index or object key.
const PropertyGrid = Vue.defineComponent({
	template: '#property-grid',
	props: {
		list: { type: [Array, Object], required: true },
		interpretations: { type: Array, required: true },
		label: String,
		minWidth: String,
		autoLayout: Boolean,
		rowKey: Function,
		spacer: Boolean,
		selectable: Boolean,
		selectedIndex: [String, Number],
	},
	emits: ['update:selectedIndex'],
	data() {
		return {
			rowIdPrefix: Vue.useId(),
			pointerStart: /** @type {{ x: number, y: number } | null} */ (null),
		};
	},
	computed: {
		columns() {
			return /** @type {PropertyGridColumn[]} */ (this.interpretations);
		},
	},
	methods: {
		/** @param {PointerEvent} event */
		startRowClick(event) {
			this.pointerStart = { x: event.clientX, y: event.clientY };
		},
		/** @param {MouseEvent} event @param {string | number} index */
		selectRow(event, index) {
			const row = /** @type {HTMLTableRowElement} */ (event.currentTarget);
			const start = this.pointerStart;
			this.pointerStart = null;
			// A text drag can still dispatch a click on the row.
			if (event.detail && start && (event.clientX !== start.x || event.clientY !== start.y)) {
				const selection = row.ownerDocument.getSelection();
				if (selection && !selection.isCollapsed && selection.containsNode(row, true)) return;
			}
			const button = /** @type {HTMLButtonElement | null} */ (row.querySelector('.property-grid__row-button'));
			button?.focus({ preventScroll: true });
			this.$emit('update:selectedIndex', index);
		},
	},
});
</script>

<template id="property-grid">
	<div class="property-grid">
		<table class="property-grid__table" :aria-label="label" :style="{ minWidth, tableLayout: autoLayout ? 'auto' : 'fixed' }">
			<colgroup>
				<col v-for="(column, index) in columns" :key="index" :style="{ width: column.width }">
				<col v-if="spacer">
			</colgroup>
			<thead>
				<tr>
					<th v-for="(column, columnIndex) in columns" :key="columnIndex" :style="column.style" :aria-label="column.label" :title="column.label" scope="col">{{ column.title }}</th>
					<th v-if="spacer" class="property-grid__spacer" aria-hidden="true"></th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="(value, index, rowNumber) in list" :key="rowKey ? rowKey(value, index) : index"
					:id="selectable ? rowIdPrefix + '-' + (rowNumber ?? index) : undefined" :class="{ 'property-grid__selectable-row': selectable }"
					@pointerdown="selectable && startRowClick($event)" @click="selectable && selectRow($event, index)">
					<td v-for="(column, columnIndex) in columns" :key="columnIndex" :style="column.style" :data-kind="typeof column.kind === 'function' ? column.kind(value, index) : column.kind">
						<button v-if="selectable && columnIndex === 0" type="button" class="property-grid__row-button"
							:aria-labelledby="rowIdPrefix + '-' + (rowNumber ?? index)" :aria-pressed="selectedIndex === index"></button>
						<span v-if="selectable" class="property-grid__row-text">
							<slot v-if="column.slot" :name="column.slot" :value="value" :index="index">{{ column.format?.(value, index) }}</slot>
							<template v-else>{{ column.format(value, index) }}</template>
						</span>
						<slot v-else-if="column.slot" :name="column.slot" :value="value" :index="index">{{ column.format?.(value, index) }}</slot>
						<template v-else>{{ column.format(value, index) }}</template>
					</td>
					<td v-if="spacer" class="property-grid__spacer" aria-hidden="true"></td>
				</tr>
				<tr v-if="$slots.empty && Object.keys(list).length === 0">
					<td :colspan="columns.length + Number(spacer)"><slot name="empty"></slot></td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<style>
.property-grid { container-type: inline-size; }
.property-grid--scrollable { overflow: auto; overscroll-behavior: contain; }
.property-grid--scrollable:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.property-grid__table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; line-height: 16px; }
.property-grid__table :is(th, td) { padding: 6px 12px; border-bottom: 1px solid color-mix(in srgb, var(--color-border) 55%, var(--color-background)); vertical-align: top; overflow-wrap: anywhere; }
.property-grid__table :is(th, td):first-child { padding-left: var(--property-grid-gutter, var(--workspace-gutter, 12px)); }
.property-grid__table :is(th, td):last-child { padding-right: var(--property-grid-gutter, var(--workspace-gutter, 12px)); }
.property-grid__table thead { position: sticky; top: 0; z-index: 1; }
.property-grid__table th { padding-top: 7px; padding-bottom: 7px; border-bottom-color: var(--color-border); background: var(--color-surface); color: var(--color-muted); font-weight: 500; text-align: left; }
.property-grid__table td { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; }
.property-grid__table tbody tr:hover { background: var(--color-surface); }
.property-grid__selectable-row { position: relative; cursor: pointer; }
.property-grid__row-button { position: absolute; inset: 0; width: 100%; padding: 0; border: 0; background: transparent; pointer-events: none; }
.property-grid__row-button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.property-grid__row-text { cursor: text; user-select: text; }
.property-grid__table tbody tr:has(.property-grid__row-button[aria-pressed="true"]) { background: color-mix(in srgb, var(--color-accent) 13%, var(--color-background)); }
.property-grid__table .property-grid__spacer:last-child { padding: 0; }
</style>

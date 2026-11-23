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
	},
	computed: {
		columns() {
			return /** @type {PropertyGridColumn[]} */ (this.interpretations);
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
				<tr v-for="(value, index) in list" :key="rowKey ? rowKey(value, index) : index">
					<td v-for="(column, columnIndex) in columns" :key="columnIndex" :style="column.style" :data-kind="typeof column.kind === 'function' ? column.kind(value, index) : column.kind">
						<slot v-if="column.slot" :name="column.slot" :value="value" :index="index">{{ column.format?.(value, index) }}</slot>
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
.property-grid { container-type: inline-size; overflow-x: auto; }
.property-grid__table { width: 100%; border-collapse: collapse; font-size: 12px; line-height: 16px; }
.property-grid__table :is(th, td) { padding: 6px 12px; border-bottom: 1px solid color-mix(in srgb, var(--color-border) 55%, var(--color-background)); vertical-align: top; overflow-wrap: anywhere; }
.property-grid__table :is(th, td):first-child { padding-left: var(--property-grid-gutter, var(--workspace-gutter, 12px)); }
.property-grid__table :is(th, td):last-child { padding-right: var(--property-grid-gutter, var(--workspace-gutter, 12px)); }
.property-grid__table th { padding-top: 7px; padding-bottom: 7px; border-bottom-color: var(--color-border); background: var(--color-surface); color: var(--color-muted); font-weight: 500; text-align: left; }
.property-grid__table td { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; }
.property-grid__table tbody tr:hover { background: var(--color-surface); }
.property-grid__table .property-grid__spacer:last-child { padding: 0; }
</style>

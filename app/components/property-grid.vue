<script>
/** @typedef {{ title: string, kind?: string | ((value: unknown, index: string | number) => string | undefined), style?: Record<string, string | number>, format: (value: unknown, index: string | number) => string }} PropertyGridColumn */
/** @typedef {unknown[] | Record<string, unknown>} PropertyGridList */

// Each column interprets the original value and its array index or object key.
// Optional kind supplies a semantic data-kind hint for contextual tools.
// Current address kinds are rva, va, and fo; other kinds can be added later.
// style is applied to both the header and cells of the column.
// Example: { title: 'Field', style: { minWidth: '240px' }, format: (value, key) => String(key) }.
const PropertyGrid = Vue.defineComponent({
	template: '#property-grid',
	props: {
		list: { type: [Array, Object], required: true },
		interpretations: { type: Array, required: true },
		label: String,
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
		<table class="property-grid__table" :aria-label="label">
			<thead>
				<tr><th v-for="(column, columnIndex) in columns" :key="columnIndex" :style="column.style" scope="col">{{ column.title }}</th></tr>
			</thead>
			<tbody>
				<tr v-for="(value, index) in list" :key="index">
					<td v-for="(column, columnIndex) in columns" :key="columnIndex" :style="column.style" :data-kind="typeof column.kind === 'function' ? column.kind(value, index) : column.kind">{{ column.format(value, index) }}</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<style>
.property-grid { max-width: 100%; overflow-x: auto; }
.property-grid__table { width: max-content; border: 1px solid var(--color-border); border-collapse: collapse; font-size: 12px; }
.property-grid__table th { padding: 9px 14px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-muted); font-weight: 600; text-align: left; white-space: nowrap; }
.property-grid__table td { padding: 9px 14px; border-bottom: 1px solid var(--color-border); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; vertical-align: top; white-space: pre-wrap; }
.property-grid__table tbody tr:hover { background: var(--color-surface); }
</style>

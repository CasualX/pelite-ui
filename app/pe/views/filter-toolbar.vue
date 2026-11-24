<script>
const PeFilterToolbar = Vue.defineComponent({
	template: '#pe-filter-toolbar',
	props: {
		label: { type: String, required: true },
		query: { type: String, required: true },
		fields: { type: Array, required: true },
		matchFields: { type: Array, required: true },
	},
	emits: ['update:query', 'update:matchFields'],
	computed: {
		queryModel: {
			get() { return this.query; },
			/** @param {string} value */
			set(value) { this.$emit('update:query', value); },
		},
	},
	methods: {
		/** @param {string} field */
		toggleField(field) {
			const selected = /** @type {string[]} */ (this.matchFields);
			if (!selected.includes(field)) {
				this.$emit('update:matchFields', [...selected, field]);
			} else if (selected.length > 1) {
				this.$emit('update:matchFields', selected.filter(value => value !== field));
			}
		},
	},
});
</script>

<template id="pe-filter-toolbar">
	<div class="pe-filter-toolbar">
		<div class="pe-filter-toolbar__search">
			<input v-model="queryModel" type="search" :aria-label="label" :placeholder="label" spellcheck="false" autocomplete="off">
		</div>
		<div class="pe-filter-toolbar__fields" role="group" aria-label="Match in">
			<span aria-hidden="true">Match in</span>
			<button v-for="field in fields" :key="field" type="button" :aria-pressed="matchFields.includes(field)"
				:disabled="matchFields.length === 1 && matchFields.includes(field)" @click="toggleField(field)">{{ field }}</button>
		</div>
		<slot></slot>
	</div>
</template>

<style>
.pe-filter-toolbar { display: flex; flex: none; flex-wrap: wrap; align-items: center; gap: 6px 14px; padding: 7px var(--workspace-gutter, 12px); border-bottom: 1px solid var(--color-border); background: var(--workspace-background); }
.pe-filter-toolbar__search { position: relative; flex: 0 1 16rem; max-width: 100%; }
.pe-filter-toolbar__search::before, .pe-filter-toolbar__search::after { content: ''; position: absolute; color: var(--color-muted); pointer-events: none; }
.pe-filter-toolbar__search::before { top: 9px; left: 10px; width: 9px; height: 9px; border: 1px solid; border-radius: 50%; }
.pe-filter-toolbar__search::after { top: 17px; left: 17px; width: 5px; border-top: 1px solid; transform: rotate(45deg); transform-origin: left; }
.pe-filter-toolbar__search input { display: block; width: 100%; height: 30px; padding: 4px 8px 4px 28px; border: 1px solid var(--color-border); border-radius: 5px; background: var(--workspace-surface); color: var(--color-text); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; }
.pe-filter-toolbar__search input::placeholder { color: var(--color-muted); }
.pe-filter-toolbar__fields { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; min-width: 0; color: var(--color-muted); font-size: 12px; }
.pe-filter-toolbar__fields > span { margin-right: 4px; }
.pe-filter-toolbar__fields button { padding: 3px 8px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: inherit; white-space: nowrap; cursor: pointer; }
.pe-filter-toolbar__fields button[aria-pressed="true"] { border-color: var(--color-border); background: var(--workspace-surface); color: var(--color-text); }
.pe-filter-toolbar__fields button:hover:enabled { border-color: var(--color-accent); color: var(--color-accent-hover); }
.pe-filter-toolbar__fields button:disabled { cursor: default; }
.pe-filter-toolbar__search input:focus-visible, .pe-filter-toolbar__fields button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
</style>

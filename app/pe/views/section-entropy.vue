<script>
const SectionEntropy = Vue.defineComponent({
	template: '#section-entropy',
	props: {
		samples: { type: /** @type {new () => number[]} */ (/** @type {unknown} */ (Array)), required: true },
	},
});
</script>

<template id="section-entropy">
	<div class="section-entropy" role="img" aria-label="Entropy distribution, scale 0 to 8">
		<span v-for="(sample, index) in samples" :key="index" :style="{ height: (sample / 8 * 100) + '%' }" :title="sample.toFixed(2)"></span>
	</div>
</template>

<style>
.section-entropy { display: flex; align-items: flex-end; gap: 2px; width: 96px; height: 20px; border-bottom: 1px solid var(--color-border); }
.section-entropy span { flex: 1; min-height: 1px; background: var(--color-secondary); }
</style>

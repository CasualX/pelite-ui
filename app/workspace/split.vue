<link rel="component" href="layout.vue.js">
<link rel="component" href="splitter.vue">

<script>
const WorkspaceSplit = Vue.defineComponent({
	name: 'workspace-split',
	template: '#workspace-split',
	components: { WorkspaceSplitter },
	props: { node: { type: /** @type {new () => WorkspaceNode} */ (/** @type {unknown} */ (Object)), required: true } },
	computed: {
		tracks() {
			const node = this.node;
			if (node.type !== 'split') return {};
			const tracks = `minmax(0, ${node.ratio}fr) 5px minmax(0, ${1 - node.ratio}fr)`;
			return node.direction === 'row' ? { gridTemplateColumns: tracks } : { gridTemplateRows: tracks };
		},
	},
});
</script>

<template id="workspace-split">
	<slot v-if="node.type === 'pane'" :pane="node"></slot>
	<div v-else class="workspace-split" :style="tracks">
		<div class="workspace-split__child">
			<workspace-split :node="node.first" v-slot="scope"><slot v-bind="scope"></slot></workspace-split>
		</div>
		<workspace-splitter :direction="node.direction" :ratio="node.ratio" @resize="node.ratio = $event"></workspace-splitter>
		<div class="workspace-split__child">
			<workspace-split :node="node.second" v-slot="scope"><slot v-bind="scope"></slot></workspace-split>
		</div>
	</div>
</template>

<style>
.workspace-split { display: grid; flex: 1; min-width: 0; min-height: 0; }
.workspace-split__child { display: flex; min-width: 0; min-height: 0; }
</style>

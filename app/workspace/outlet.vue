<script>
const WorkspaceOutlet = Vue.defineComponent({
	template: '#workspace-outlet',
	props: { target: { type: String, required: true } },
	emits: ['register', 'unregister'],
	mounted() { this.$emit('register', this.target, this.$el); },
	beforeUnmount() { this.$emit('unregister', this.target, this.$el); },
});
</script>

<template id="workspace-outlet">
	<div class="workspace-area__outlet"></div>
</template>

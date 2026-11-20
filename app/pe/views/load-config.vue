<link rel="component" href="../../components/property-grid.vue">

<script>
/** @param {PeDocument} context @returns {ViewContent} */
function prepareLoadConfigView(context) {
	const config = context.peFile.loadConfig();
	if (config instanceof Error) throw config;
	if (config === null) throw new Error('The directory is unavailable.');
	const image = Object.fromEntries(Object.entries(config.image).flatMap(([field, value]) =>
		value !== null && typeof value === 'object'
			? Object.entries(value).map(([member, memberValue]) => [`${field}.${member}`, memberValue])
			: [[field, value]]
	));
	return { component: 'view-load-config', data: {
		image,
		securityCookie: config.security_cookie === null ? 'Unavailable' : formatPropertyGridHex(config.security_cookie),
		handlers: config.se_handler_table,
	} };
}

const ViewLoadConfig = Vue.defineComponent({
	template: '#view-load-config',
	props: { data: { type: Object, required: true } },
	data() {
		const addresses = /** @type {Partial<Record<string, 'va'>>} */ ({
			LockPrefixTable: 'va', EditList: 'va', SecurityCookie: 'va', SEHandlerTable: 'va',
			GuardCFCheckFunctionPointer: 'va', GuardCFDispatchFunctionPointer: 'va', GuardCFFunctionTable: 'va',
			GuardAddressTakenIatEntryTable: 'va', GuardLongJumpTargetTable: 'va', DynamicValueRelocTable: 'va',
			CHPEMetadataPointer: 'va', GuardRFFailureRoutine: 'va', GuardRFFailureRoutineFunctionPointer: 'va',
			GuardRFVerifyStackPointerFunctionPointer: 'va', EnclaveConfigurationPointer: 'va', VolatileMetadataPointer: 'va',
			GuardEHContinuationTable: 'va', GuardXFGCheckFunctionPointer: 'va', GuardXFGDispatchFunctionPointer: 'va',
			GuardXFGTableDispatchFunctionPointer: 'va', CastGuardOsDeterminedFailureMode: 'va', GuardMemcpyFunctionPointer: 'va',
			UmaFunctionPointers: 'va',
		});
		return {
			headerColumns: /** @type {PropertyGridColumn[]} */ ([
				{ title: 'Field', style: { minWidth: '160px' }, format: (value, field) => String(field) },
				{ title: 'Value', style: { minWidth: '120px' }, kind: (value, field) => addresses[field], format: formatPropertyGridHex },
			]),
			handlerColumns: /** @type {PropertyGridColumn[]} */ ([{ title: 'Handler RVA', kind: 'rva', format: formatPropertyGridHex }]),
		};
	},
});
</script>

<template id="view-load-config">
	<section>
		<p class="view-load-config__note">pelite zero-fills fields beyond the size of the load configuration structure.</p>
		<property-grid :list="data.image" :interpretations="headerColumns" label="Load configuration header"></property-grid>
		<h2 class="view-load-config__title">Security cookie value</h2>
		<p class="view-load-config__cookie"><code>{{ data.securityCookie }}</code></p>
		<h2 class="view-load-config__title">SE handlers</h2>
		<property-grid v-if="data.handlers?.length" :list="data.handlers" :interpretations="handlerColumns" label="SE handlers"></property-grid>
		<p v-else class="view-load-config__note">{{ data.handlers === null && data.image.SEHandlerTable ? 'SE handler table unavailable.' : 'No SE handlers.' }}</p>
	</section>
</template>

<style>
.view-load-config__title { margin: 24px 0 12px; font-size: 14px; font-weight: 600; }
.view-load-config__note { margin: 0 0 12px; color: var(--color-muted); font-size: 13px; }
.view-load-config__cookie { margin: 0; font-size: 12px; }
</style>

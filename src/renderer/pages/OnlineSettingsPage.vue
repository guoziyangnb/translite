<!--
组件作用：线上设置页父组件，负责供应商列表、供应商编辑和用量查询配置三个视图的切换。
适用场景：用户在设置页管理在线大模型供应商、启用接口、配置用量查询。
-->
<template>
  <section class="settings-page">
    <article class="settings-panel online-panel">
      <ProviderList
        v-if="view === 'list'"
        :endpoints="endpoints"
        :active-id="activeId"
        :success-tag="successTag"
        :activating-id="activatingId"
        :testing-id="testingId"
        :usage-id="usageId"
        :removing-id="removingId"
        @create="startCreate"
        @edit="startEdit"
        @configure-usage="startUsageConfig"
        @activate="$emit('activate-endpoint', $event)"
        @test="$emit('test-endpoint', $event)"
        @refresh-usage="$emit('test-usage-config', $event)"
        @remove="$emit('remove-endpoint', $event)"
      />

      <ProviderEditor
        v-else-if="view === 'edit'"
        :draft="draft"
        :editing="Boolean(editingId)"
        :save-loading="saveLoading"
        :loading-models-id="loadingModelsId"
        :testing-id="testingId"
        :model-options="modelOptions"
        :preset-groups="PROVIDER_PRESET_GROUPS"
        @cancel="backToList"
        @save="saveDraft"
        @fetch-models="$emit('fetch-models', $event)"
        @test="$emit('test-endpoint', $event)"
        @apply-preset="applyPreset"
      />

      <UsageConfigEditor
        v-else
        :draft="draft"
        :usage-id="usageId"
        :save-loading="saveLoading"
        @cancel="backToList"
        @save="saveUsageConfig"
        @test="$emit('test-usage-config-draft', $event)"
      />
    </article>
  </section>
</template>

<script setup>
// 组件作用：线上设置页父组件，负责供应商列表、供应商编辑和用量查询配置三个视图的切换。
// 适用场景：用户在设置页管理在线大模型供应商、启用接口、配置用量查询。
import { reactive, ref, watch } from 'vue';
import ProviderEditor from '../components/ProviderEditor.vue';
import ProviderList from '../components/ProviderList.vue';
import UsageConfigEditor from '../components/UsageConfigEditor.vue';
import { applyProviderPresetToEndpoint, findProviderPreset, PROVIDER_PRESET_GROUPS } from '../const/providerPresets';
import { DEFAULT_USAGE_TEMPLATE_ID, getUsageTemplateScript, resolveUsageTemplateId } from '../const/usageTemplates';

const props = defineProps({
  // 当前保存的线上供应商列表，默认由 App 全局设置传入。
  endpoints: { type: Array, required: true },
  // 当前启用的供应商 id，默认空字符串。
  activeId: { type: String, default: '' },
  // 已启用状态标签颜色配置，默认由 App 统一维护。
  successTag: { type: Object, required: true },
  // 保存动作 loading 状态，默认 false。
  saveLoading: { type: Boolean, default: false },
  // 正在获取模型列表的供应商 id，默认空字符串。
  loadingModelsId: { type: String, default: '' },
  // 正在启用的供应商 id，默认空字符串。
  activatingId: { type: String, default: '' },
  // 正在测试接口的供应商 id，默认空字符串。
  testingId: { type: String, default: '' },
  // 正在测试或刷新用量查询的供应商 id，默认空字符串。
  usageId: { type: String, default: '' },
  // 正在删除的供应商 id，默认空字符串。
  removingId: { type: String, default: '' },
  // 模型选项生成函数，默认由 App 根据供应商模型列表提供。
  modelOptions: { type: Function, required: true }
});

const emit = defineEmits([
  'save-endpoint',
  'fetch-models',
  'activate-endpoint',
  'test-endpoint',
  'test-usage-config',
  'test-usage-config-draft',
  'save-usage-config',
  'remove-endpoint'
]);

const view = ref('list');
const editingId = ref('');
const draft = reactive(createEndpointDraft());

function createEndpointDraft(source = {}) {
  return {
    id: source.id || `endpoint-${Date.now()}`,
    presetId: source.presetId || '',
    name: source.name || '',
    baseUrl: source.baseUrl || '',
    apiKey: source.apiKey || '',
    apiFormat: source.apiFormat || 'openai',
    model: source.model || '',
    modelsPath: source.modelsPath || '/models',
    chatPath: source.chatPath || '/chat/completions',
    usageConfig: createUsageConfig(source.usageConfig),
    models: Array.isArray(source.models) ? [...source.models] : []
  };
}

function createUsageConfig(source = {}) {
  const template = resolveUsageTemplateId(source.template || DEFAULT_USAGE_TEMPLATE_ID);
  const script = migrateUsageScript(source.script || getUsageTemplateScript(template), template);
  return {
    enabled: source.enabled ?? Boolean(source.lastCheckedAt || source.lastResult || source.lastError),
    baseUrl: source.baseUrl || '',
    apiKey: source.apiKey || '',
    template,
    timeoutSeconds: String(source.timeoutSeconds ?? 10),
    intervalMinutes: String(source.intervalMinutes ?? 0),
    script,
    lastCheckedAt: source.lastCheckedAt || '',
    lastResult: source.lastResult || null,
    lastError: source.lastError || ''
  };
}

function migrateUsageScript(script, template) {
  if (template === 'deepseek' && script.includes('{{baseUrl}}/v1/usage')) return getUsageTemplateScript('deepseek');
  return script;
}

function assignDraft(source = {}) {
  Object.assign(draft, createEndpointDraft(source));
}

function startCreate() {
  editingId.value = '';
  assignDraft();
  view.value = 'edit';
}

function startEdit(endpoint) {
  editingId.value = endpoint.id;
  assignDraft(endpoint);
  view.value = 'edit';
}

function startUsageConfig(endpoint) {
  editingId.value = endpoint.id;
  assignDraft(endpoint);
  ensurePresetUsageTemplate();
  view.value = 'usage';
}

function backToList() {
  view.value = 'list';
}

function saveDraft(endpoint) {
  emit('save-endpoint', endpoint);
  view.value = 'list';
}

function saveUsageConfig(endpoint) {
  emit('save-usage-config', endpoint, backToList);
}

function applyPreset(preset) {
  Object.assign(draft, applyProviderPresetToEndpoint(draft, preset));
}

// 进入用量配置时，如果供应商来自官方预设且尚未保存过查询结果，默认带出该供应商的推荐模板。
function ensurePresetUsageTemplate() {
  if (draft.usageConfig?.lastCheckedAt || draft.usageConfig?.lastResult || draft.usageConfig?.lastError) return;
  const preset = findProviderPreset(draft.presetId);
  if (!preset) return;
  const template = resolveUsageTemplateId(preset.usageTemplate || DEFAULT_USAGE_TEMPLATE_ID);
  draft.usageConfig = {
    ...draft.usageConfig,
    baseUrl: draft.usageConfig.baseUrl || preset.usageConfig?.baseUrl || '',
    template,
    script: preset.usageConfig?.script || getUsageTemplateScript(template)
  };
}

watch(
  () => props.endpoints,
  (endpoints) => {
    if ((view.value !== 'edit' && view.value !== 'usage') || !editingId.value) return;
    const latest = endpoints.find((endpoint) => endpoint.id === editingId.value);
    if (latest) assignDraft(latest);
  },
  { deep: true }
);
</script>

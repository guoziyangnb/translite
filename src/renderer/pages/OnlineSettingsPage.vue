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
        @cancel="backToList"
        @save="saveDraft"
        @fetch-models="$emit('fetch-models', $event)"
        @test="$emit('test-endpoint', $event)"
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
import { reactive, ref, watch } from 'vue';
import ProviderEditor from '../components/ProviderEditor.vue';
import ProviderList from '../components/ProviderList.vue';
import UsageConfigEditor from '../components/UsageConfigEditor.vue';

const props = defineProps({
  endpoints: { type: Array, required: true },
  activeId: { type: String, default: '' },
  successTag: { type: Object, required: true },
  saveLoading: { type: Boolean, default: false },
  loadingModelsId: { type: String, default: '' },
  activatingId: { type: String, default: '' },
  testingId: { type: String, default: '' },
  usageId: { type: String, default: '' },
  removingId: { type: String, default: '' },
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
    name: source.name || '',
    baseUrl: source.baseUrl || '',
    apiKey: source.apiKey || '',
    model: source.model || '',
    modelsPath: source.modelsPath || '/v1/models',
    chatPath: source.chatPath || '/v1/chat/completions',
    usageConfig: createUsageConfig(source.usageConfig),
    models: Array.isArray(source.models) ? [...source.models] : []
  };
}

function createUsageConfig(source = {}) {
  const script = migrateUsageScript(source.script || defaultUsageScript(), source.template || 'deepseek');
  return {
    enabled: source.enabled ?? Boolean(source.lastCheckedAt || source.lastResult || source.lastError),
    baseUrl: source.baseUrl || '',
    apiKey: source.apiKey || '',
    template: source.template || 'deepseek',
    timeoutSeconds: String(source.timeoutSeconds ?? 10),
    intervalMinutes: String(source.intervalMinutes ?? 0),
    script,
    lastCheckedAt: source.lastCheckedAt || '',
    lastResult: source.lastResult || null,
    lastError: source.lastError || ''
  };
}

function migrateUsageScript(script, template) {
  if (template === 'deepseek' && script.includes('{{baseUrl}}/v1/usage')) return defaultUsageScript();
  return script;
}

function defaultUsageScript() {
  return `({
    request: {
      url: "{{baseUrl}}/user/balance",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      const balances = response?.balance_infos || [];
      const cny = balances.find((item) => item.currency === "CNY") || balances[0] || {};
      const remaining = cny.total_balance ?? cny.granted_balance ?? cny.topped_up_balance;
      return {
        isValid: response?.is_available ?? true,
        remaining,
        unit: cny.currency || "CNY"
      };
    }
  })`;
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

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
        :removing-id="removingId"
        @create="startCreate"
        @edit="startEdit"
        @activate="$emit('activate-endpoint', $event)"
        @test="$emit('test-endpoint', $event)"
        @remove="$emit('remove-endpoint', $event)"
      />

      <ProviderEditor
        v-else
        :draft="draft"
        :editing="Boolean(editingId)"
        :save-loading="saveLoading"
        :loading-models-id="loadingModelsId"
        :testing-id="testingId"
        :usage-id="usageId"
        :model-options="modelOptions"
        @cancel="backToList"
        @save="saveDraft"
        @fetch-models="$emit('fetch-models', $event)"
        @test="$emit('test-endpoint', $event)"
        @fetch-usage="$emit('fetch-usage', $event)"
      />
    </article>
  </section>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import ProviderEditor from '../components/ProviderEditor.vue';
import ProviderList from '../components/ProviderList.vue';

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
  'fetch-usage',
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
    usagePath: source.usagePath || '',
    models: Array.isArray(source.models) ? [...source.models] : []
  };
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

function backToList() {
  view.value = 'list';
}

function saveDraft(endpoint) {
  emit('save-endpoint', endpoint);
  view.value = 'list';
}

watch(
  () => props.endpoints,
  (endpoints) => {
    if (view.value !== 'edit' || !editingId.value) return;
    const latest = endpoints.find((endpoint) => endpoint.id === editingId.value);
    if (latest) assignDraft(latest);
  },
  { deep: true }
);
</script>

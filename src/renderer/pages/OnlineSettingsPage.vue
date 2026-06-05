<template>
  <section class="settings-page">
    <article class="settings-panel online-panel">
      <div v-if="view === 'list'" class="provider-list-view">
        <div class="panel-title">
          <div>
            <strong>线上翻译供应商</strong>
            <p>配置多个在线翻译模型商，启动其中一个作为当前线上翻译接口。</p>
          </div>
          <n-button type="primary" @click="startCreate">
            <template #icon><Plus :size="16" /></template>
            添加供应商
          </n-button>
        </div>

        <div class="provider-list">
          <div v-for="endpoint in endpoints" :key="endpoint.id" class="provider-card">
            <div class="provider-main">
              <div>
                <strong>{{ endpoint.name || '未命名供应商' }}</strong>
                <p>{{ endpoint.baseUrl || '未配置 Base URL' }}</p>
              </div>
              <n-tag v-if="activeId === endpoint.id" :color="successTag">已启用</n-tag>
            </div>

            <div class="provider-meta">
              <span>模型：{{ endpoint.model || '未选择' }}</span>
              <span>模型数：{{ endpoint.models?.length || 0 }}</span>
            </div>

            <div class="provider-actions">
              <n-button secondary @click="startEdit(endpoint)">编辑</n-button>
              <n-button type="primary" :loading="activatingId === endpoint.id" @click="$emit('activate-endpoint', endpoint)">
                启动
              </n-button>
              <n-button secondary :loading="testingId === endpoint.id" @click="$emit('test-endpoint', endpoint)">
                <template #icon><Wifi :size="16" /></template>
                测试
              </n-button>
              <n-button quaternary :loading="removingId === endpoint.id" @click="$emit('remove-endpoint', endpoint.id)">
                <template #icon><Trash2 :size="16" /></template>
              </n-button>
            </div>
          </div>

          <div v-if="endpoints.length === 0" class="empty-provider">
            <strong>还没有线上供应商</strong>
            <p>点击“添加供应商”配置 DeepSeek、GLM、OpenAI 或其他 OpenAI-compatible 网关。</p>
          </div>
        </div>
      </div>

      <div v-else class="provider-edit-view">
        <div class="panel-title">
          <div>
            <strong>{{ editingId ? '编辑供应商' : '添加供应商' }}</strong>
            <p>填写 Base URL 和 API Key，获取模型列表并选择用于翻译的模型。</p>
          </div>
          <n-button secondary @click="backToList">返回列表</n-button>
        </div>

        <div class="endpoint-fields">
          <label>
            <span>名称</span>
            <n-input v-model:value="draft.name" placeholder="DeepSeek / GLM / OpenAI" />
          </label>
          <label>
            <span>Base URL</span>
            <n-input v-model:value="draft.baseUrl" placeholder="https://api.deepseek.com" />
          </label>
          <label>
            <span>API Key</span>
            <n-input v-model:value="draft.apiKey" type="password" show-password-on="click" />
          </label>
          <label>
            <span>模型</span>
            <div class="path-row">
              <n-select
                v-model:value="draft.model"
                filterable
                tag
                placeholder="先获取模型列表，或手动输入模型名"
                :options="modelOptions(draft)"
              />
              <n-button secondary :loading="loadingModelsId === draft.id" @click="$emit('fetch-models', draft)">
                获取模型列表
              </n-button>
            </div>
          </label>
          <div class="advanced-grid">
            <label>
              <span>模型列表路径</span>
              <n-input v-model:value="draft.modelsPath" placeholder="/v1/models" />
            </label>
            <label>
              <span>Chat 路径</span>
              <n-input v-model:value="draft.chatPath" placeholder="/v1/chat/completions" />
            </label>
            <label>
              <span>用量查询路径</span>
              <n-input v-model:value="draft.usagePath" placeholder="/v1/dashboard/billing/usage，可留空" />
            </label>
          </div>
        </div>

        <div class="panel-actions">
          <n-button secondary :loading="usageId === draft.id" @click="$emit('fetch-usage', draft)">查询用量</n-button>
          <n-button secondary :loading="testingId === draft.id" @click="$emit('test-endpoint', draft)">
            <template #icon><Wifi :size="16" /></template>
            测试接口
          </n-button>
          <n-button type="primary" :loading="saveLoading" @click="saveDraft">保存并返回</n-button>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { Plus, Trash2, Wifi } from 'lucide-vue-next';

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

function saveDraft() {
  emit('save-endpoint', { ...draft });
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

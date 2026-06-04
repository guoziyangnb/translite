<template>
  <section class="settings-page">
    <article class="settings-panel online-panel">
      <div class="panel-title">
        <div>
          <strong>线上大模型接口</strong>
          <p>支持 OpenAI-compatible 接口，例如 DeepSeek、GLM、GPT 和自部署网关。</p>
        </div>
        <n-button secondary @click="$emit('add-endpoint')">
          <template #icon><Plus :size="16" /></template>
          添加接口
        </n-button>
      </div>

      <div class="endpoint-list">
        <div v-for="endpoint in endpoints" :key="endpoint.id" class="endpoint-item">
          <div class="endpoint-header">
            <strong>{{ endpoint.name || '未命名接口' }}</strong>
            <n-tag v-if="activeId === endpoint.id" :color="successTag">已启用</n-tag>
          </div>

          <div class="endpoint-fields">
            <label>
              <span>名称</span>
              <n-input v-model:value="endpoint.name" placeholder="DeepSeek / GLM / OpenAI" />
            </label>
            <label>
              <span>Base URL</span>
              <n-input v-model:value="endpoint.baseUrl" placeholder="https://api.deepseek.com" />
            </label>
            <label>
              <span>API Key</span>
              <n-input v-model:value="endpoint.apiKey" type="password" show-password-on="click" />
            </label>
            <label>
              <span>模型</span>
              <div class="path-row">
                <n-select
                  v-model:value="endpoint.model"
                  filterable
                  tag
                  placeholder="先获取模型列表，或手动输入模型名"
                  :options="modelOptions(endpoint)"
                />
                <n-button secondary :loading="loadingModelsId === endpoint.id" @click="$emit('fetch-models', endpoint)">
                  获取模型列表
                </n-button>
              </div>
            </label>
            <div class="advanced-grid">
              <label>
                <span>模型列表路径</span>
                <n-input v-model:value="endpoint.modelsPath" placeholder="/v1/models" />
              </label>
              <label>
                <span>Chat 路径</span>
                <n-input v-model:value="endpoint.chatPath" placeholder="/v1/chat/completions" />
              </label>
              <label>
                <span>用量查询路径</span>
                <n-input v-model:value="endpoint.usagePath" placeholder="/v1/dashboard/billing/usage，可留空" />
              </label>
            </div>
          </div>

          <div class="endpoint-actions">
            <n-button secondary :loading="saveLoading" @click="$emit('save')">保存</n-button>
            <n-button type="primary" :loading="activatingId === endpoint.id" @click="$emit('activate-endpoint', endpoint)">
              启动
            </n-button>
            <n-button secondary :loading="testingId === endpoint.id" @click="$emit('test-endpoint', endpoint)">
              <template #icon><Wifi :size="16" /></template>
              测试接口
            </n-button>
            <n-button secondary :loading="usageId === endpoint.id" @click="$emit('fetch-usage', endpoint)">
              查询用量
            </n-button>
            <n-button quaternary :loading="removingId === endpoint.id" @click="$emit('remove-endpoint', endpoint.id)">
              <template #icon><Trash2 :size="16" /></template>
            </n-button>
          </div>

        </div>
        <p v-if="endpoints.length === 0" class="empty-state">还没有线上接口。</p>
      </div>
    </article>
  </section>
</template>

<script setup>
import { Plus, Trash2, Wifi } from 'lucide-vue-next';

defineProps({
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

defineEmits([
  'add-endpoint',
  'save',
  'fetch-models',
  'activate-endpoint',
  'test-endpoint',
  'fetch-usage',
  'remove-endpoint'
]);
</script>

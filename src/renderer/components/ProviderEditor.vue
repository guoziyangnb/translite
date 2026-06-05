<template>
  <div class="provider-edit-view">
    <div class="panel-title">
      <div>
        <strong>{{ editing ? '编辑供应商' : '添加供应商' }}</strong>
        <p>填写 Base URL 和 API Key，获取模型列表并选择用于翻译的模型。</p>
      </div>
      <n-button secondary @click="$emit('cancel')">返回列表</n-button>
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
      <n-button secondary :loading="testingId === draft.id" @click="$emit('test', draft)">
        <template #icon><Wifi :size="16" /></template>
        测试接口
      </n-button>
      <n-button type="primary" :loading="saveLoading" @click="$emit('save', { ...draft })">保存并返回</n-button>
    </div>
  </div>
</template>

<script setup>
import { Wifi } from 'lucide-vue-next';

defineProps({
  draft: { type: Object, required: true },
  editing: { type: Boolean, default: false },
  saveLoading: { type: Boolean, default: false },
  loadingModelsId: { type: String, default: '' },
  testingId: { type: String, default: '' },
  usageId: { type: String, default: '' },
  modelOptions: { type: Function, required: true }
});

defineEmits(['cancel', 'save', 'fetch-models', 'test', 'fetch-usage']);
</script>

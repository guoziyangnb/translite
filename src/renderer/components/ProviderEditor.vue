<!--
组件作用：编辑线上供应商基础信息，并提供官方供应商预设按钮快速填充。
适用场景：线上设置页的添加/编辑供应商视图，由父页面维护草稿和保存逻辑。
-->
<template>
  <div class="provider-edit-view">
    <div class="panel-title">
      <div>
        <strong>{{ editing ? '编辑供应商' : '添加供应商' }}</strong>
        <p>填写 Base URL 和 API Key，获取模型列表并选择用于翻译的模型。</p>
      </div>
      <n-button secondary @click="$emit('cancel')">返回列表</n-button>
    </div>

    <div class="provider-preset-section">
      <div class="section-title">
        <strong>官方供应商</strong>
        <span>选择后自动填充 OpenAI-compatible 默认路径，Claude 会使用 Anthropic 协议。</span>
      </div>
      <div
        v-for="group in presetGroups"
        :key="group.label"
        class="provider-preset-group"
      >
        <span>{{ group.label }}</span>
        <div class="provider-preset-list">
          <n-button
            v-for="preset in group.presets"
            :key="preset.id"
            size="small"
            :type="draft.presetId === preset.id ? 'primary' : 'default'"
            secondary
            @click="$emit('apply-preset', preset)"
          >
            {{ preset.name }}
          </n-button>
        </div>
      </div>
    </div>

    <div class="endpoint-fields">
      <label>
        <span>名称</span>
        <n-input v-model:value="draft.name" placeholder="DeepSeek / GLM / OpenAI" />
      </label>
      <label>
        <span>Base URL</span>
        <n-input
          v-model:value="draft.baseUrl"
          placeholder="https://api.deepseek.com"
          @update:value="clearPresetIfCustomized"
        />
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
          <span>接口格式</span>
          <n-select
            v-model:value="draft.apiFormat"
            :options="apiFormatOptions"
          />
        </label>
        <label>
          <span>模型列表路径</span>
          <n-input v-model:value="draft.modelsPath" placeholder="/models" />
        </label>
        <label>
          <span>Chat 路径</span>
          <n-input v-model:value="draft.chatPath" placeholder="/chat/completions" />
        </label>
      </div>
    </div>

    <div class="panel-actions">
      <n-button secondary :loading="testingId === draft.id" @click="$emit('test', draft)">
        <template #icon><Wifi :size="16" /></template>
        测试接口
      </n-button>
      <n-button type="primary" :loading="saveLoading" @click="$emit('save', { ...draft })">保存并返回</n-button>
    </div>
  </div>
</template>

<script setup>
// 组件作用：编辑线上供应商基础信息，并提供官方供应商预设按钮快速填充。
// 适用场景：线上设置页的添加/编辑供应商视图，由父页面维护草稿和保存逻辑。
import { Wifi } from 'lucide-vue-next';
import { findProviderPreset } from '../const/providerPresets';

const props = defineProps({
  // 当前正在编辑的供应商草稿，默认由父页面维护。
  draft: { type: Object, required: true },
  // 是否处于编辑已有供应商模式，默认 false。
  editing: { type: Boolean, default: false },
  // 保存按钮 loading 状态，默认 false。
  saveLoading: { type: Boolean, default: false },
  // 正在获取模型列表的供应商 id，默认空字符串。
  loadingModelsId: { type: String, default: '' },
  // 正在测试接口的供应商 id，默认空字符串。
  testingId: { type: String, default: '' },
  // 模型下拉选项生成函数，默认由父组件根据当前供应商模型列表生成。
  modelOptions: { type: Function, required: true },
  // 官方供应商分组按钮数据，默认由 const/providerPresets 传入。
  presetGroups: { type: Array, required: true }
});

defineEmits(['cancel', 'save', 'fetch-models', 'test', 'apply-preset']);

const apiFormatOptions = [
  { label: 'OpenAI Chat Completions', value: 'openai' },
  { label: 'Anthropic Messages', value: 'anthropic' }
];

// 用户手动修改接口地址后视为自定义供应商，避免官方按钮继续显示选中状态。
function clearPresetIfCustomized(value) {
  const preset = findProviderPreset(props.draft.presetId);
  if (preset && value === preset.baseUrl) return;
  if (props.draft.presetId) props.draft.presetId = '';
}
</script>

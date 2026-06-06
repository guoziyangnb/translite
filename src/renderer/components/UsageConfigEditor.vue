<!--
组件作用：编辑单个供应商的用量查询配置，包括启用开关、请求凭证、模板和脚本。
适用场景：线上设置页进入“配置用量查询”视图时使用，父组件负责保存和测试脚本。
-->
<template>
  <div class="usage-config-view">
    <div class="panel-title">
      <div>
        <strong>配置用量查询</strong>
        <p>为 {{ draft.name || '当前供应商' }} 配置用量或余额查询脚本，保存后才会在列表生效。</p>
      </div>
      <n-button secondary @click="$emit('cancel')">取消</n-button>
    </div>

    <div class="usage-enable-row">
      <div>
        <strong>启用用量查询</strong>
        <p>开启后保存配置会立即查询一次，并在供应商列表显示用量状态。</p>
      </div>
      <n-switch v-model:value="draft.usageConfig.enabled" size="medium">
        <template #checked>启用</template>
        <template #unchecked>关闭</template>
      </n-switch>
    </div>

    <template v-if="draft.usageConfig.enabled">
      <div class="usage-endpoint-grid">
        <label>
          <span>请求地址（可选）</span>
          <n-input v-model:value="draft.usageConfig.baseUrl" placeholder="留空则使用供应商地址" />
        </label>
        <label>
          <span>API Key（可选）</span>
          <n-input
            v-model:value="draft.usageConfig.apiKey"
            type="password"
            show-password-on="click"
            placeholder="留空则使用供应商地址"
          />
        </label>
      </div>

      <div class="usage-template-grid">
        <label>
          <span>预设模板</span>
          <n-select
            v-model:value="draft.usageConfig.template"
            :options="templateOptions"
            @update:value="applyTemplate"
          />
        </label>
        <label>
          <span>超时时间（秒）</span>
          <n-input v-model:value="draft.usageConfig.timeoutSeconds" placeholder="10" />
        </label>
        <label>
          <span>自动查询间隔（分钟，0 表示不自动查询）</span>
          <n-input v-model:value="draft.usageConfig.intervalMinutes" placeholder="0" />
        </label>
      </div>

      <div class="code-field">
        <span class="code-field-heading">
          <span>提取器代码</span>
          <small>返回对象可包含剩余额度、用量指标或状态信息</small>
        </span>
        <CodeEditor
          v-model:value="draft.usageConfig.script"
        />
      </div>

      <div v-if="draft.usageConfig.lastResult" class="usage-preview">
        <strong v-if="formatUsageMetric(draft.usageConfig.lastResult)">
          {{ formatUsageMetric(draft.usageConfig.lastResult) }}
        </strong>
        <strong v-else-if="hasRemaining(draft.usageConfig.lastResult)">剩余：{{ formatUsage(draft.usageConfig.lastResult) }}</strong>
        <strong v-else-if="formatUsageMeta(draft.usageConfig.lastResult)">查询通过</strong>
        <strong v-else>未提取到余额</strong>
        <span v-if="draft.usageConfig.lastCheckedAt">最近刷新：{{ formatDate(draft.usageConfig.lastCheckedAt) }}</span>
        <span v-if="draft.usageConfig.lastResult.planName">套餐：{{ draft.usageConfig.lastResult.planName }}</span>
        <span v-if="draft.usageConfig.lastResult.extra">{{ draft.usageConfig.lastResult.extra }}</span>
      </div>
      <p v-else-if="draft.usageConfig.lastError" class="form-error">查询失败：{{ draft.usageConfig.lastError }}</p>
      <p v-if="formatError" class="form-error">{{ formatError }}</p>

      <div class="script-help">
        <strong>脚本编写说明：</strong>
        <p>整个配置必须用 () 包裹，形成对象字面量表达式。变量 <code v-pre>{{apiKey}}</code> 和 <code v-pre>{{baseUrl}}</code> 会自动替换。</p>
        <p>extractor 返回字段可包含 isValid、invalidMessage、remaining、unit、metricLabel、planName、total、used、extra。</p>
      </div>
    </template>

    <div class="panel-actions">
      <n-button v-if="draft.usageConfig.enabled" secondary :loading="usageId === draft.id" @click="$emit('test', draft)">测试脚本</n-button>
      <n-button v-if="draft.usageConfig.enabled" secondary @click="formatScript">格式化</n-button>
      <n-button secondary @click="$emit('cancel')">取消</n-button>
      <n-button type="primary" :loading="saveLoading" @click="$emit('save', { ...draft })">保存配置</n-button>
    </div>
  </div>
</template>

<script setup>
// 组件作用：编辑单个供应商的用量查询配置，包括启用开关、请求凭证、模板和脚本。
// 适用场景：线上设置页进入“配置用量查询”视图时使用，父组件负责保存和测试脚本。
import { ref } from 'vue';
import CodeEditor from './CodeEditor.vue';
import { findProviderPreset } from '../const/providerPresets';
import { getUsageTemplateScript, USAGE_TEMPLATE_OPTIONS } from '../const/usageTemplates';
import {
  formatUsageExtra,
  formatUsageMetric as formatMetric,
  formatUsageRemaining,
  hasUsageRemaining
} from '../utils/usageFormatter';

const props = defineProps({
  // 当前供应商草稿，默认包含 usageConfig 配置对象。
  draft: { type: Object, required: true },
  // 正在测试用量脚本的供应商 id，默认空字符串。
  usageId: { type: String, default: '' },
  // 保存配置按钮 loading 状态，默认 false。
  saveLoading: { type: Boolean, default: false }
});

defineEmits(['cancel', 'save', 'test']);

const formatError = ref('');

const templateOptions = USAGE_TEMPLATE_OPTIONS;

function applyTemplate(value) {
  if (value === 'custom') return;
  const preset = findProviderPreset(props.draft.presetId);
  if (preset?.usageTemplate === value && preset.usageConfig?.script) {
    props.draft.usageConfig.baseUrl ||= preset.usageConfig.baseUrl || '';
    props.draft.usageConfig.script = preset.usageConfig.script;
    return;
  }
  props.draft.usageConfig.script = getUsageTemplateScript(value);
}

function formatScript() {
  try {
    const config = Function(`"use strict"; return ${props.draft.usageConfig.script}`)();
    const request = stringifyObjectLiteral(config.request || {});
    const extractor = normalizeFunctionSource(config.extractor?.toString() || 'function(response) { return response; }');
    props.draft.usageConfig.script = `({
  request: ${indentContinuation(request, 2)},
  extractor: ${indentContinuation(extractor, 2)}
})`;
    formatError.value = '';
  } catch (error) {
    formatError.value = error.message || '脚本格式化失败';
  }
}

function stringifyObjectLiteral(value) {
  return JSON.stringify(value, null, 2).replace(/"([^"]+)":/g, '$1:');
}

function normalizeFunctionSource(source) {
  const lines = source.split('\n');
  const indentSizes = lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => line.match(/^\s*/)[0].length);
  const minIndent = indentSizes.length ? Math.min(...indentSizes) : 0;
  return lines.map((line, index) => (index === 0 ? line.trim() : line.slice(minIndent))).join('\n');
}

function indentContinuation(source, spaces) {
  const indent = ' '.repeat(spaces);
  return source.split('\n').map((line, index) => (index === 0 ? line : `${indent}${line}`)).join('\n');
}

function formatUsage(result) {
  return formatUsageRemaining(result);
}

function formatUsageMetric(result) {
  return formatMetric(result);
}

function hasRemaining(result) {
  return hasUsageRemaining(result);
}

function formatUsageMeta(result) {
  return formatUsageExtra(result);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}
</script>

<template>
  <div class="usage-config-view">
    <div class="panel-title">
      <div>
        <strong>配置用量查询</strong>
        <p>为 {{ draft.name || '当前供应商' }} 配置余额查询脚本，保存后才会在列表生效。</p>
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
          <small>返回对象需包含剩余额度等字段</small>
        </span>
        <CodeEditor
          v-model:value="draft.usageConfig.script"
        />
      </div>

      <div v-if="draft.usageConfig.lastResult" class="usage-preview">
        <strong>剩余：{{ formatUsage(draft.usageConfig.lastResult) }}</strong>
        <span v-if="draft.usageConfig.lastCheckedAt">最近刷新：{{ formatDate(draft.usageConfig.lastCheckedAt) }}</span>
        <span v-if="draft.usageConfig.lastResult.planName">套餐：{{ draft.usageConfig.lastResult.planName }}</span>
        <span v-if="draft.usageConfig.lastResult.extra">{{ draft.usageConfig.lastResult.extra }}</span>
      </div>
      <p v-else-if="draft.usageConfig.lastError" class="form-error">查询失败：{{ draft.usageConfig.lastError }}</p>
      <p v-if="formatError" class="form-error">{{ formatError }}</p>

      <div class="script-help">
        <strong>脚本编写说明：</strong>
        <p>整个配置必须用 () 包裹，形成对象字面量表达式。变量 <code v-pre>{{apiKey}}</code> 和 <code v-pre>{{baseUrl}}</code> 会自动替换。</p>
        <p>extractor 返回字段可包含 isValid、invalidMessage、remaining、unit、planName、total、used、extra。</p>
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
import { ref } from 'vue';
import CodeEditor from './CodeEditor.vue';

const props = defineProps({
  draft: { type: Object, required: true },
  usageId: { type: String, default: '' },
  saveLoading: { type: Boolean, default: false }
});

defineEmits(['cancel', 'save', 'test']);

const formatError = ref('');

const templates = {
  custom: '',
  general: `({
    request: {
      url: "{{baseUrl}}/v1/usage",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      const remaining = response?.remaining ?? response?.quota?.remaining ?? response?.balance;
      const unit = response?.unit ?? response?.quota?.unit ?? "CNY";
      return {
        isValid: response?.is_active ?? response?.isValid ?? true,
        remaining,
        unit
      };
    }
  })`,
  newapi: `({
    request: {
      url: "{{baseUrl}}/api/user/self",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      const data = response?.data ?? response;
      return {
        isValid: !response?.error,
        remaining: data?.quota ?? data?.balance,
        used: data?.used_quota,
        unit: "CNY"
      };
    }
  })`,
  tokenPlan: `({
    request: {
      url: "{{baseUrl}}/v1/dashboard/billing/usage",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      return {
        isValid: !response?.error,
        total: response?.total_granted,
        used: response?.total_used,
        remaining: response?.total_available,
        unit: "USD"
      };
    }
  })`,
  official: `({
    request: {
      url: "{{baseUrl}}/v1/usage",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      return {
        isValid: !response?.error,
        remaining: response?.balance ?? response?.remaining,
        unit: response?.unit ?? "USD"
      };
    }
  })`,
  deepseek: `({
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
  })`
};

const templateOptions = [
  { label: '自定义', value: 'custom' },
  { label: '通用模板', value: 'general' },
  { label: 'NewAPI', value: 'newapi' },
  { label: 'Token Plan', value: 'tokenPlan' },
  { label: '官方', value: 'official' },
  { label: 'DeepSeek', value: 'deepseek' }
];

function applyTemplate(value) {
  if (value === 'custom') return;
  props.draft.usageConfig.script = templates[value] || templates.general;
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
  const remaining = result.remaining ?? result.balance ?? '-';
  const unit = result.unit || 'CNY';
  return `${remaining}${unit}`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}
</script>

<template>
  <div class="provider-list-view">
    <div class="panel-title">
      <div>
        <strong>线上翻译供应商</strong>
        <p>配置多个在线翻译模型商，启动其中一个作为当前线上翻译接口。</p>
      </div>
      <n-button type="primary" @click="$emit('create')">
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
          <span v-if="endpoint.usageConfig?.lastResult" class="usage-summary">
            剩余：{{ formatUsage(endpoint.usageConfig.lastResult) }}
          </span>
          <span v-if="endpoint.usageConfig?.lastCheckedAt">
            最近刷新：{{ formatDate(endpoint.usageConfig.lastCheckedAt) }}
          </span>
        </div>

        <div class="provider-actions">
          <n-button secondary @click="$emit('edit', endpoint)">
            <template #icon><Pencil :size="16" /></template>
            编辑
          </n-button>
          <n-button v-if="activeId === endpoint.id" secondary disabled>
            <template #icon><CircleCheck :size="16" /></template>
            已启用
          </n-button>
          <n-button v-else type="primary" :loading="activatingId === endpoint.id" @click="$emit('activate', endpoint)">
            启动
          </n-button>
          <n-button secondary :loading="testingId === endpoint.id" @click="$emit('test', endpoint)">
            <template #icon><Wifi :size="16" /></template>
            测试
          </n-button>
          <n-button secondary @click="$emit('configure-usage', endpoint)">
            <template #icon><WalletCards :size="16" /></template>
            配置用量查询
          </n-button>
          <n-button quaternary :loading="removingId === endpoint.id" @click="$emit('remove', endpoint.id)">
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
</template>

<script setup>
import { CircleCheck, Pencil, Plus, Trash2, WalletCards, Wifi } from 'lucide-vue-next';

defineProps({
  endpoints: { type: Array, required: true },
  activeId: { type: String, default: '' },
  successTag: { type: Object, required: true },
  activatingId: { type: String, default: '' },
  testingId: { type: String, default: '' },
  removingId: { type: String, default: '' }
});

defineEmits(['create', 'edit', 'activate', 'test', 'configure-usage', 'remove']);

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

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
        <div class="provider-overview">
          <div class="provider-info-block">
            <div class="provider-main">
              <strong>{{ endpoint.name || '未命名供应商' }}</strong>
              <a
                v-if="endpoint.baseUrl"
                class="provider-base-url"
                :href="endpoint.baseUrl"
                target="_blank"
                rel="noreferrer"
              >
                {{ endpoint.baseUrl }}
              </a>
              <p v-else>未配置 Base URL</p>
            </div>

            <div class="provider-model-meta">
              <span>模型：{{ endpoint.model || '未选择' }}</span>
              <span>模型数：{{ endpoint.models?.length || 0 }}</span>
            </div>
          </div>

          <div
            v-if="endpoint.usageConfig?.enabled"
            class="usage-status"
          >
            <span class="usage-date">
              最近刷新：{{ endpoint.usageConfig?.lastCheckedAt ? formatDate(endpoint.usageConfig.lastCheckedAt) : '未查询' }}
            </span>
            <n-tag v-if="endpoint.usageConfig?.lastError" type="error" size="small" round>
              查询失败
            </n-tag>
            <strong v-else class="usage-summary">
              剩余：{{ formatUsage(endpoint.usageConfig?.lastResult) }}
            </strong>
            <n-button
              tertiary
              circle
              size="small"
              :loading="usageId === endpoint.id"
              @click="$emit('refresh-usage', endpoint)"
            >
              <template #icon><RefreshCw :size="14" /></template>
            </n-button>
          </div>

          <div class="provider-status-block">
            <n-tag v-if="activeId === endpoint.id" :color="successTag">已启用</n-tag>
          </div>
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
            {{ endpoint.usageConfig?.enabled ? '编辑配置' : '配置用量查询' }}
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
// 组件作用：展示线上翻译供应商列表，并提供编辑、启用、测试、用量查询配置和刷新入口。
// 适用场景：线上设置页的供应商列表视图，父组件负责传入数据和处理操作事件。
import { CircleCheck, Pencil, Plus, RefreshCw, Trash2, WalletCards, Wifi } from 'lucide-vue-next';

defineProps({
  // 供应商列表，默认由父页面从全局设置中传入。
  endpoints: { type: Array, required: true },
  // 当前已启用供应商 id，默认空字符串。
  activeId: { type: String, default: '' },
  // 已启用标签的 Naive UI 颜色配置，默认由父组件统一维护。
  successTag: { type: Object, required: true },
  // 正在启用的供应商 id，默认空字符串，用于按钮 loading。
  activatingId: { type: String, default: '' },
  // 正在测试接口的供应商 id，默认空字符串，用于按钮 loading。
  testingId: { type: String, default: '' },
  // 正在刷新用量查询的供应商 id，默认空字符串，用于刷新按钮 loading。
  usageId: { type: String, default: '' },
  // 正在删除的供应商 id，默认空字符串，用于删除按钮 loading。
  removingId: { type: String, default: '' }
});

defineEmits(['create', 'edit', 'activate', 'test', 'configure-usage', 'refresh-usage', 'remove']);

// 格式化用量查询结果，兼容 remaining 和 balance 两种字段。
function formatUsage(result) {
  const remaining = result?.remaining ?? result?.balance ?? '-';
  const unit = result?.unit || 'CNY';
  return `${remaining}${unit}`;
}

// 格式化最近刷新时间，非法日期直接返回原始值。
function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}
</script>

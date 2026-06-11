<template>
  <section class="mode-card">
    <div class="mode-left">
      <div class="capsule" role="radiogroup" aria-label="翻译模式">
        <button
          :class="{ active: mode === 'local' }"
          :disabled="modeLoading === 'local'"
          type="button"
          @click="$emit('change-mode', 'local')"
        >
          本地
        </button>
        <button
          :class="{ active: mode === 'online' }"
          :disabled="modeLoading === 'online'"
          type="button"
          @click="$emit('change-mode', 'online')"
        >
          线上
        </button>
      </div>
      <p>{{ mode === 'local' ? '当前使用本地模型翻译。' : '当前使用已启用的线上大模型接口翻译。' }}</p>
    </div>
    <div class="mode-right">
      <n-button secondary @click="$emit('go-config')">
        <template #icon><Settings2 :size="16" /></template>
        去配置
      </n-button>
    </div>
  </section>
</template>

<script setup>
import { Settings2 } from 'lucide-vue-next';

defineProps({
  mode: { type: String, required: true },
  modeLoading: { type: String, default: '' }
});

defineEmits(['change-mode', 'go-config']);
</script>

<style scoped>
.mode-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.mode-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
</style>

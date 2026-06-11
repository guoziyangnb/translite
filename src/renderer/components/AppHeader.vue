<template>
  <header class="topbar">
    <div class="title-block">
      <p class="eyebrow">TransLite</p>
      <div class="title-row">
        <h1>{{ title }}</h1>
        <n-button
          v-if="activeView === 'translate'"
          quaternary
          circle
          class="settings-icon-btn"
          title="应用设置"
          aria-label="应用设置"
          @click="$emit('open-app-settings')"
        >
          <template #icon><Settings :size="18" /></template>
        </n-button>
      </div>
    </div>
    <div class="top-actions">
      <n-tag round :bordered="false" class="shortcut-tag">
        <Keyboard :size="15" />
        {{ shortcutLabel }}
      </n-tag>
      <n-button v-if="activeView !== 'translate'" secondary @click="$emit('back-to-translate')">
        <template #icon><ArrowLeft :size="16" /></template>
        返回
      </n-button>
    </div>
  </header>
</template>

<script setup>
import { ArrowLeft, Keyboard, Settings } from 'lucide-vue-next';

defineProps({
  activeView: { type: String, required: true },
  shortcutLabel: { type: String, required: true },
  title: { type: String, required: true }
});

defineEmits(['open-app-settings', 'back-to-translate']);
</script>

<style scoped>
.title-block {
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.settings-icon-btn {
  color: var(--muted);
}

.settings-icon-btn:hover {
  color: var(--accent);
}
</style>

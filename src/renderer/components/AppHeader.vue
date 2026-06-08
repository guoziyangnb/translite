<template>
  <header class="topbar">
    <div>
      <p class="eyebrow">TransLite</p>
      <h1>{{ title }}</h1>
    </div>
    <div class="top-actions">
      <n-tag round :bordered="false" class="shortcut-tag">
        <Keyboard :size="15" />
        {{ shortcutLabel }}
      </n-tag>
      <n-button secondary @click="$emit('toggle-settings')">
        <template #icon><Settings :size="16" /></template>
        {{ activeView === 'translate' ? '翻译设置' : '返回翻译' }}
      </n-button>
    </div>
  </header>
</template>

<script setup>
import { Keyboard, Settings } from 'lucide-vue-next';

defineProps({
  activeView: { type: String, required: true },
  shortcutLabel: { type: String, required: true },
  title: { type: String, required: true }
});

defineEmits(['toggle-settings']);
</script>

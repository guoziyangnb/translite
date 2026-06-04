<template>
  <section class="mode-card">
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
  </section>
</template>

<script setup>
defineProps({
  mode: { type: String, required: true },
  modeLoading: { type: String, default: '' }
});

defineEmits(['change-mode']);
</script>

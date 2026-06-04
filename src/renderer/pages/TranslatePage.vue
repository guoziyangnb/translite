<template>
  <section class="translate-page">
    <div class="toolbar" aria-label="翻译设置">
      <label>
        <span>源语言</span>
        <n-select :value="sourceLang" :options="sourceOptions" @update:value="$emit('update:source-lang', $event)" />
      </label>
      <n-button quaternary circle class="swap-button" title="交换语言" @click="$emit('swap-languages')">
        <template #icon><ArrowLeftRight :size="18" /></template>
      </n-button>
      <label>
        <span>目标语言</span>
        <n-select :value="targetLang" :options="targetOptions" @update:value="$emit('update:target-lang', $event)" />
      </label>
    </div>

    <div class="workspace">
      <article class="pane">
        <div class="pane-heading">
          <span>原文</span>
          <n-button text size="small" @click="$emit('clear')">清空</n-button>
        </div>
        <n-input
          ref="sourceInput"
          :value="sourceText"
          type="textarea"
          placeholder="输入或粘贴需要翻译的文本"
          :autosize="false"
          @update:value="$emit('update:source-text', $event)"
          @keydown.ctrl.enter.prevent="$emit('translate')"
          @keydown.meta.enter.prevent="$emit('translate')"
        />
      </article>
      <article class="pane result-pane">
        <div class="pane-heading">
          <span>译文</span>
          <n-button text size="small" @click="$emit('copy')">复制</n-button>
        </div>
        <output>{{ translatedText }}</output>
      </article>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { ArrowLeftRight } from 'lucide-vue-next';

defineProps({
  sourceLang: { type: String, required: true },
  targetLang: { type: String, required: true },
  sourceText: { type: String, required: true },
  translatedText: { type: String, required: true },
  sourceOptions: { type: Array, required: true },
  targetOptions: { type: Array, required: true }
});

defineEmits([
  'update:source-lang',
  'update:target-lang',
  'update:source-text',
  'swap-languages',
  'clear',
  'copy',
  'translate'
]);

const sourceInput = ref(null);

defineExpose({
  focus: () => sourceInput.value?.focus()
});
</script>

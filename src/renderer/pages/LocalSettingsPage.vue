<!--
组件作用：本地模型设置页，负责配置模型 ID、模型目录，以及触发本地加载或下载加载。
适用场景：用户选择 local-trans 本地模型翻译模式时展示。
-->
<template>
  <section class="settings-page">
    <article class="settings-panel">
      <div class="panel-title">
        <div>
          <strong>本地模型</strong>
          <p>选择模型下载位置，或从已有模型目录直接加载。</p>
        </div>
        <n-tag :color="mode === 'local' ? successTag : mutedTag">
          {{ mode === 'local' ? '当前模式' : '未启用' }}
        </n-tag>
      </div>

      <div class="local-performance-tip" role="alert">
        <AlertTriangle :size="18" />
        <div>
          <strong>本地推理性能提示</strong>
          <p>
            local-trans 默认模型 HY-MT1.5-1.8B 属于 1.8B 级模型。首次加载模型、初始化 Tokenizer/ONNX Runtime，
            加载和翻译都可能非常慢；低配设备或纯 CPU 推理体验会更明显，建议优先使用线上接口。
          </p>
        </div>
      </div>

      <label>
        <span>模型 ID</span>
        <n-input v-model:value="local.modelId" />
      </label>
      <label>
        <span>模型位置</span>
        <div class="path-row">
          <n-input v-model:value="local.modelDir" />
          <n-button secondary :loading="chooseDirLoading" @click="$emit('choose-directory')">
            <template #icon><FolderOpen :size="16" /></template>
            选择目录
          </n-button>
        </div>
      </label>

      <div v-if="showDownloadProgress" class="progress-side">
        <n-progress type="line" :percentage="downloadProgress" :show-indicator="false" :processing="localBusy" />
        <span>{{ localProgressLabel }}</span>
      </div>

      <div class="panel-actions">
        <n-button secondary :loading="saveLoading" @click="$emit('save')">保存</n-button>
        <n-button secondary :loading="localLoadLoading" :disabled="localBusy" @click="$emit('load-model')">
          从本地加载
        </n-button>
        <n-button type="primary" :loading="localDownloadLoading" :disabled="localBusy" @click="$emit('download-model')">
          <template #icon><Download :size="16" /></template>
          下载并加载
        </n-button>
      </div>
    </article>
  </section>
</template>

<script setup>
import { AlertTriangle, Download, FolderOpen } from 'lucide-vue-next';

defineProps({
  // 本地模型配置对象，默认由父组件 settings.local 传入。
  local: { type: Object, required: true },
  // 当前翻译模式，用于判断本地模式是否启用，无默认值。
  mode: { type: String, required: true },
  // 当前模式标签颜色配置，无默认值。
  successTag: { type: Object, required: true },
  // 未启用标签颜色配置，无默认值。
  mutedTag: { type: Object, required: true },
  // 选择目录按钮加载态，默认 false。
  chooseDirLoading: { type: Boolean, default: false },
  // 保存按钮加载态，默认 false。
  saveLoading: { type: Boolean, default: false },
  // 从本地加载按钮加载态，默认 false。
  localLoadLoading: { type: Boolean, default: false },
  // 下载并加载按钮加载态，默认 false。
  localDownloadLoading: { type: Boolean, default: false },
  // 本地模型操作整体忙碌态，默认 false。
  localBusy: { type: Boolean, default: false },
  // 是否展示下载进度区域，默认 false。
  showDownloadProgress: { type: Boolean, default: false },
  // 下载进度百分比，默认 0。
  downloadProgress: { type: Number, default: 0 },
  // 下载进度文案，默认空字符串。
  localProgressLabel: { type: String, default: '' }
});

defineEmits(['choose-directory', 'save', 'load-model', 'download-model']);
</script>

<style scoped>
.local-performance-tip {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: start;
  padding: 12px;
  border: 1px solid #f1c56b;
  border-radius: 8px;
  background: #fff8e6;
  color: #6f4b00;
}

.local-performance-tip svg {
  margin-top: 2px;
  color: #b77900;
}

.local-performance-tip strong {
  display: block;
  margin-bottom: 4px;
  color: #5c3d00;
}

.local-performance-tip p {
  margin: 0;
  line-height: 1.55;
  color: #7a560d;
}
</style>

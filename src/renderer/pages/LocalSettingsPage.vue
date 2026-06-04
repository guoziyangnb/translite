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

      <div class="progress-side">
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
import { Download, FolderOpen } from 'lucide-vue-next';

defineProps({
  local: { type: Object, required: true },
  mode: { type: String, required: true },
  successTag: { type: Object, required: true },
  mutedTag: { type: Object, required: true },
  chooseDirLoading: { type: Boolean, default: false },
  saveLoading: { type: Boolean, default: false },
  localLoadLoading: { type: Boolean, default: false },
  localDownloadLoading: { type: Boolean, default: false },
  localBusy: { type: Boolean, default: false },
  downloadProgress: { type: Number, default: 0 },
  localProgressLabel: { type: String, default: '未加载' }
});

defineEmits(['choose-directory', 'save', 'load-model', 'download-model']);
</script>

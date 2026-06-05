<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <main class="app-shell">
      <AppHeader
        :active-view="activeView"
        :shortcut-label="shortcutLabel"
        :title="pageTitle"
        @toggle-settings="toggleSettings"
      />

      <ModeSwitch :mode="settings.mode" :mode-loading="modeLoading" @change-mode="setMode" />

      <TranslatePage
        v-if="activeView === 'translate'"
        ref="translatePage"
        :source-lang="sourceLang"
        :target-lang="targetLang"
        :source-text="sourceText"
        :translated-text="translatedText"
        :source-options="sourceOptions"
        :target-options="targetOptions"
        @update:source-lang="sourceLang = $event"
        @update:target-lang="targetLang = $event"
        @update:source-text="sourceText = $event"
        @swap-languages="swapLanguages"
        @clear="clearText"
        @copy="copyResult"
        @translate="translate"
      />

      <LocalSettingsPage
        v-else-if="settings.mode === 'local'"
        :local="settings.local"
        :mode="settings.mode"
        :success-tag="successTag"
        :muted-tag="mutedTag"
        :choose-dir-loading="chooseDirLoading"
        :save-loading="saveLoading"
        :local-load-loading="localLoadLoading"
        :local-download-loading="localDownloadLoading"
        :local-busy="localBusy"
        :download-progress="downloadProgress"
        :local-progress-label="localProgressLabel"
        @choose-directory="chooseModelDirectory"
        @save="saveSettings"
        @load-model="loadLocalModel"
        @download-model="downloadLocalModel"
      />

      <OnlineSettingsPage
        v-else
        :endpoints="settings.online.endpoints"
        :active-id="settings.online.activeId"
        :success-tag="successTag"
        :save-loading="saveLoading"
        :loading-models-id="loadingModelsId"
        :activating-id="activatingId"
        :testing-id="testingId"
        :usage-id="usageId"
        :removing-id="removingId"
        :model-options="modelOptions"
        @save-endpoint="saveEndpoint"
        @fetch-models="fetchModels"
        @activate-endpoint="activateEndpoint"
        @test-endpoint="testEndpoint"
        @fetch-usage="fetchUsage"
        @remove-endpoint="removeEndpoint"
      />

      <footer v-if="activeView === 'translate'" class="actionbar">
        <n-space>
          <n-button secondary @click="hideWindow">收起</n-button>
          <n-button type="primary" :loading="translating" @click="translate">
            翻译
          </n-button>
        </n-space>
      </footer>
    </main>
  </n-config-provider>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { createDiscreteApi } from 'naive-ui';
import AppHeader from './components/AppHeader.vue';
import ModeSwitch from './components/ModeSwitch.vue';
import LocalSettingsPage from './pages/LocalSettingsPage.vue';
import OnlineSettingsPage from './pages/OnlineSettingsPage.vue';
import TranslatePage from './pages/TranslatePage.vue';

const { message } = createDiscreteApi(['message']);

const activeView = ref('translate');
const translatePage = ref(null);
const sourceText = ref('');
const translatedText = ref('');
const sourceLang = ref('auto');
const targetLang = ref('zh');
const shortcutLabel = ref('Ctrl + Shift + T');

const translating = ref(false);
const saveLoading = ref(false);
const chooseDirLoading = ref(false);
const localLoadLoading = ref(false);
const localDownloadLoading = ref(false);
const localBusy = ref(false);
const loadingModelsId = ref('');
const activatingId = ref('');
const testingId = ref('');
const usageId = ref('');
const removingId = ref('');
const modeLoading = ref('');

const downloadProgress = ref(0);
const localProgressLabel = ref('未加载');

const settings = reactive({
  mode: 'local',
  local: {
    modelId: 'onnx-community/HY-MT1.5-1.8B-ONNX',
    modelDir: '',
    loaded: false
  },
  online: {
    activeId: '',
    endpoints: []
  }
});

const languageOptions = [
  { label: '中文', value: 'zh' },
  { label: '英语', value: 'en' },
  { label: '日语', value: 'ja' },
  { label: '韩语', value: 'ko' },
  { label: '法语', value: 'fr' },
  { label: '德语', value: 'de' },
  { label: '西班牙语', value: 'es' }
];
const sourceOptions = [{ label: '自动识别', value: 'auto' }, ...languageOptions];
const targetOptions = languageOptions;
const successTag = { color: '#1f7a5c', textColor: '#fff' };
const mutedTag = { color: '#d8ded9', textColor: '#64706a' };
const themeOverrides = {
  common: {
    primaryColor: '#1f7a5c',
    primaryColorHover: '#166348',
    primaryColorPressed: '#104d39',
    borderRadius: '8px',
    fontFamily: 'Inter, Segoe UI, system-ui, sans-serif'
  }
};

let debounceTimer;
let removeProgressListener;

const pageTitle = computed(() => {
  if (activeView.value === 'translate') return '快速翻译';
  return settings.mode === 'local' ? '本地模型设置' : '线上接口设置';
});

// Electron IPC 使用结构化克隆，不能直接传 Vue 响应式 Proxy。
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

// 旧配置和新增配置都通过这里补齐路径字段，避免页面逻辑分散判断。
function normalizeEndpoint(endpoint) {
  endpoint.modelsPath ||= '/v1/models';
  endpoint.chatPath ||= '/v1/chat/completions';
  endpoint.models ||= [];
  return endpoint;
}

function showMessage(type, content) {
  message[type](content, { duration: 3200, keepAliveOnHover: true });
}

function applySettings(nextSettings) {
  settings.mode = nextSettings.mode || 'local';
  settings.local = { ...settings.local, ...(nextSettings.local || {}) };
  settings.online = {
    activeId: nextSettings.online?.activeId || '',
    endpoints: (nextSettings.online?.endpoints || []).map(normalizeEndpoint)
  };
}

function cloneSettings() {
  return plain(settings);
}

function modelOptions(endpoint) {
  return (endpoint.models || []).map((model) => ({ label: model, value: model }));
}

function focusSourceInput() {
  window.setTimeout(() => translatePage.value?.focus(), 60);
}

function toggleSettings() {
  activeView.value = activeView.value === 'translate' ? 'settings' : 'translate';
  if (activeView.value === 'translate') focusSourceInput();
}

async function saveSettings() {
  saveLoading.value = true;
  try {
    applySettings(await window.translator.saveSettings(cloneSettings()));
    showMessage('success', '保存成功');
  } catch (error) {
    showMessage('error', error.message || '保存失败');
  } finally {
    saveLoading.value = false;
  }
}

async function setMode(mode) {
  modeLoading.value = mode;
  try {
    settings.mode = mode;
    await saveSettings();
    showMessage('success', `已切换到${mode === 'local' ? '本地' : '线上'}模式`);
  } finally {
    modeLoading.value = '';
  }
}

async function chooseModelDirectory() {
  chooseDirLoading.value = true;
  try {
    const directory = await window.translator.selectDirectory(settings.local.modelDir);
    if (!directory) {
      showMessage('warning', '未选择目录');
      return;
    }
    settings.local.modelDir = directory;
    await saveSettings();
    showMessage('success', '目录已选择');
  } catch (error) {
    showMessage('error', error.message || '选择目录失败');
  } finally {
    chooseDirLoading.value = false;
  }
}

function ensureModelPath() {
  if (!settings.local.modelDir) {
    showMessage('warning', '请先选择模型下载或加载位置');
    activeView.value = 'settings';
    settings.mode = 'local';
    return false;
  }
  return true;
}

async function downloadLocalModel() {
  if (!ensureModelPath()) return;
  localDownloadLoading.value = true;
  localBusy.value = true;
  downloadProgress.value = 0;
  localProgressLabel.value = '准备下载模型';
  try {
    await window.translator.downloadLocalModel(plain(settings.local));
    settings.local.loaded = true;
    await saveSettings();
    downloadProgress.value = 100;
    localProgressLabel.value = '模型已就绪';
    showMessage('success', '模型已下载并加载');
  } catch (error) {
    showMessage('error', error.message || '模型下载失败');
  } finally {
    localDownloadLoading.value = false;
    localBusy.value = false;
  }
}

async function loadLocalModel() {
  if (!ensureModelPath()) return;
  localLoadLoading.value = true;
  localBusy.value = true;
  localProgressLabel.value = '正在加载本地模型';
  try {
    await window.translator.loadLocalModel(plain(settings.local));
    settings.local.loaded = true;
    await saveSettings();
    downloadProgress.value = 100;
    localProgressLabel.value = '模型已就绪';
    showMessage('success', '本地模型已加载');
  } catch (error) {
    showMessage('error', error.message || '本地模型加载失败');
  } finally {
    localLoadLoading.value = false;
    localBusy.value = false;
  }
}

async function saveEndpoint(endpoint) {
  const clean = normalizeEndpoint(plain(endpoint));
  const index = settings.online.endpoints.findIndex((item) => item.id === clean.id);
  if (index >= 0) settings.online.endpoints[index] = clean;
  else settings.online.endpoints.push(clean);
  await saveSettings();
  showMessage('success', '供应商已保存');
}

async function fetchModels(endpoint) {
  loadingModelsId.value = endpoint.id;
  try {
    const result = await window.translator.fetchOnlineModels(plain(endpoint));
    endpoint.models = result.models;
    if (!endpoint.model && result.models.length > 0) endpoint.model = result.models[0];
    showMessage('success', `已获取 ${result.models.length} 个模型`);
  } catch (error) {
    showMessage('error', error.message || '获取模型列表失败');
  } finally {
    loadingModelsId.value = '';
  }
}

async function activateEndpoint(endpoint) {
  activatingId.value = endpoint.id;
  try {
    const saved = await window.translator.activateOnlineEndpoint(plain(endpoint));
    applySettings(saved);
    showMessage('success', '接口已启用');
  } catch (error) {
    showMessage('error', error.message || '启动接口失败');
  } finally {
    activatingId.value = '';
  }
}

async function removeEndpoint(id) {
  removingId.value = id;
  try {
    settings.online.endpoints = settings.online.endpoints.filter((endpoint) => endpoint.id !== id);
    if (settings.online.activeId === id) settings.online.activeId = settings.online.endpoints[0]?.id || '';
    await saveSettings();
    showMessage('warning', '接口已删除');
  } finally {
    removingId.value = '';
  }
}

async function testEndpoint(endpoint) {
  testingId.value = endpoint.id;
  try {
    await window.translator.testOnlineEndpoint(plain(endpoint));
    showMessage('success', '接口测试通过');
  } catch (error) {
    showMessage('error', error.message || '接口测试失败');
  } finally {
    testingId.value = '';
  }
}

async function fetchUsage(endpoint) {
  if (!endpoint.usagePath?.trim()) {
    showMessage('warning', '请先填写用量查询路径');
    return;
  }
  usageId.value = endpoint.id;
  try {
    const result = await window.translator.fetchUsage(plain(endpoint));
    showMessage('success', `用量查询成功：${String(result.usage).slice(0, 120)}`);
  } catch (error) {
    showMessage('error', error.message || '用量查询失败');
  } finally {
    usageId.value = '';
  }
}

async function translate() {
  const text = sourceText.value.trim();
  if (!text) {
    translatedText.value = '';
    showMessage('warning', '请输入需要翻译的文本');
    focusSourceInput();
    return;
  }
  translating.value = true;
  try {
    const payload = {
      text,
      sourceLang: sourceLang.value,
      targetLang: targetLang.value,
      modelId: settings.local.modelId,
      modelDir: settings.local.modelDir
    };
    const response =
      settings.mode === 'local'
        ? await window.translator.translateLocal(plain(payload))
        : await window.translator.translateOnline(plain(payload));
    translatedText.value = response.translatedText;
    showMessage('success', '翻译完成');
  } catch (error) {
    showMessage('error', error.message || '翻译失败');
  } finally {
    translating.value = false;
  }
}

function scheduleTranslate() {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    if (activeView.value === 'translate' && sourceText.value.trim()) translate();
  }, 750);
}

function clearText() {
  sourceText.value = '';
  translatedText.value = '';
  showMessage('warning', '内容已清空');
  focusSourceInput();
}

async function copyResult() {
  const text = translatedText.value.trim();
  if (!text) {
    showMessage('warning', '没有可复制的译文');
    return;
  }
  await navigator.clipboard.writeText(text);
  showMessage('success', '译文已复制');
}

function swapLanguages() {
  if (sourceLang.value === 'auto') sourceLang.value = targetLang.value;
  const oldSource = sourceLang.value;
  sourceLang.value = targetLang.value;
  targetLang.value = oldSource;
  focusSourceInput();
  showMessage('warning', '语言已交换');
  if (sourceText.value.trim()) translate();
}

function hideWindow() {
  window.translator.hide();
}

function onKeydown(event) {
  if (event.key === 'Escape') hideWindow();
}

watch(sourceText, scheduleTranslate);

onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  window.translator.onFocusInput(focusSourceInput);
  removeProgressListener = window.translator.onLocalProgress((messageData) => {
    if (messageData.type === 'progress') {
      downloadProgress.value = messageData.progress || 0;
      localProgressLabel.value = messageData.file
        ? `${messageData.status || '处理中'}：${messageData.file}`
        : messageData.status || '处理中';
    } else if (messageData.type === 'status') {
      showMessage('warning', messageData.message);
    }
  });
  const [shortcut, savedSettings] = await Promise.all([
    window.translator.getShortcut(),
    window.translator.getSettings()
  ]);
  shortcutLabel.value = shortcut.replace('Control', 'Ctrl').replaceAll('+', ' + ');
  applySettings(savedSettings);
  focusSourceInput();
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  removeProgressListener?.();
});
</script>

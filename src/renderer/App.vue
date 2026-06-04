<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <main class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Light Translator</p>
          <h1>{{ activeView === 'translate' ? '快速翻译' : '设置' }}</h1>
        </div>
        <div class="top-actions">
          <n-tag round :bordered="false" class="shortcut-tag">
            <Keyboard :size="15" />
            {{ shortcutLabel }}
          </n-tag>
          <n-button secondary @click="activeView = activeView === 'translate' ? 'settings' : 'translate'">
            <template #icon><Settings :size="16" /></template>
            {{ activeView === 'translate' ? '设置' : '返回翻译' }}
          </n-button>
        </div>
      </header>

      <section class="mode-card">
        <div class="capsule" role="radiogroup" aria-label="翻译模式">
          <button :class="{ active: settings.mode === 'local' }" type="button" @click="setMode('local')">本地</button>
          <button :class="{ active: settings.mode === 'online' }" type="button" @click="setMode('online')">线上</button>
        </div>
        <p>{{ settings.mode === 'local' ? '使用本机模型目录推理，默认优先本地。' : '使用已启用的大模型接口，本地设置暂时置灰。' }}</p>
      </section>

      <template v-if="activeView === 'translate'">
        <section class="toolbar" aria-label="翻译设置">
          <label>
            <span>源语言</span>
            <n-select v-model:value="sourceLang" :options="sourceOptions" />
          </label>
          <n-button quaternary circle class="swap-button" title="交换语言" @click="swapLanguages">
            <template #icon><ArrowLeftRight :size="18" /></template>
          </n-button>
          <label>
            <span>目标语言</span>
            <n-select v-model:value="targetLang" :options="targetOptions" />
          </label>
        </section>

        <section class="workspace">
          <article class="pane">
            <div class="pane-heading">
              <span>原文</span>
              <n-button text size="small" @click="clearText">清空</n-button>
            </div>
            <n-input
              ref="sourceInput"
              v-model:value="sourceText"
              type="textarea"
              placeholder="输入或粘贴需要翻译的文本"
              :autosize="false"
              @keydown.ctrl.enter.prevent="translate"
              @keydown.meta.enter.prevent="translate"
            />
          </article>
          <article class="pane result-pane">
            <div class="pane-heading">
              <span>译文</span>
              <n-button text size="small" @click="copyResult">复制</n-button>
            </div>
            <output>{{ translatedText }}</output>
          </article>
        </section>
      </template>

      <section v-else class="settings-layout">
        <article class="settings-panel" :class="{ disabled: settings.mode !== 'local' }">
          <div class="panel-title">
            <div>
              <strong>本地模型</strong>
              <p>选择下载位置，或直接选择已有模型目录加载。</p>
            </div>
            <n-tag :color="settings.mode === 'local' ? successTag : mutedTag">默认</n-tag>
          </div>
          <label>
            <span>模型 ID</span>
            <n-input v-model:value="settings.local.modelId" :disabled="settings.mode !== 'local'" />
          </label>
          <label>
            <span>模型位置</span>
            <div class="path-row">
              <n-input v-model:value="settings.local.modelDir" :disabled="settings.mode !== 'local'" />
              <n-button secondary :disabled="settings.mode !== 'local'" @click="chooseModelDirectory">
                <template #icon><FolderOpen :size="16" /></template>
                选择
              </n-button>
            </div>
          </label>
          <div class="progress-side">
            <n-progress type="line" :percentage="downloadProgress" :show-indicator="false" :processing="localBusy" />
            <span>{{ localProgressLabel }}</span>
          </div>
          <div class="panel-actions">
            <n-button secondary :disabled="settings.mode !== 'local' || localBusy" @click="loadLocalModel">
              从本地加载
            </n-button>
            <n-button type="primary" :disabled="settings.mode !== 'local' || localBusy" :loading="localBusy" @click="downloadLocalModel">
              <template #icon><Download :size="16" /></template>
              下载并加载
            </n-button>
          </div>
        </article>

        <article class="settings-panel online-panel">
          <div class="panel-title">
            <div>
              <strong>线上大模型接口</strong>
              <p>支持 OpenAI-compatible 接口，例如 DeepSeek、GLM、GPT 和自部署网关。</p>
            </div>
            <n-button secondary @click="addEndpoint">
              <template #icon><Plus :size="16" /></template>
              添加接口
            </n-button>
          </div>

          <div class="endpoint-list">
            <div v-for="endpoint in settings.online.endpoints" :key="endpoint.id" class="endpoint-item">
              <div class="endpoint-header">
                <strong>{{ endpoint.name || '未命名接口' }}</strong>
                <n-tag v-if="settings.online.activeId === endpoint.id" :color="successTag">已启用</n-tag>
              </div>

              <div class="endpoint-fields">
                <label>
                  <span>名称</span>
                  <n-input v-model:value="endpoint.name" placeholder="DeepSeek / GLM / OpenAI" />
                </label>
                <label>
                  <span>Base URL</span>
                  <n-input v-model:value="endpoint.baseUrl" placeholder="https://api.deepseek.com" />
                </label>
                <label>
                  <span>API Key</span>
                  <n-input v-model:value="endpoint.apiKey" type="password" show-password-on="click" />
                </label>
                <label>
                  <span>模型</span>
                  <div class="path-row">
                    <n-select
                      v-model:value="endpoint.model"
                      filterable
                      tag
                      placeholder="先获取模型列表，或手动输入模型名"
                      :options="modelOptions(endpoint)"
                    />
                    <n-button secondary :loading="loadingModelsId === endpoint.id" @click="fetchModels(endpoint)">
                      获取模型列表
                    </n-button>
                  </div>
                </label>
                <div class="advanced-grid">
                  <label>
                    <span>模型列表路径</span>
                    <n-input v-model:value="endpoint.modelsPath" placeholder="/v1/models" />
                  </label>
                  <label>
                    <span>Chat 路径</span>
                    <n-input v-model:value="endpoint.chatPath" placeholder="/v1/chat/completions" />
                  </label>
                  <label>
                    <span>用量查询路径</span>
                    <n-input v-model:value="endpoint.usagePath" placeholder="/v1/dashboard/billing/usage，可留空" />
                  </label>
                </div>
              </div>

              <div class="endpoint-actions">
                <n-button secondary @click="saveSettings">保存</n-button>
                <n-button type="primary" @click="activateEndpoint(endpoint)">启动</n-button>
                <n-button secondary :loading="testingId === endpoint.id" @click="testEndpoint(endpoint)">
                  <template #icon><Wifi :size="16" /></template>
                  测试接口
                </n-button>
                <n-button secondary :loading="usageId === endpoint.id" @click="fetchUsage(endpoint)">
                  查询用量
                </n-button>
                <n-button quaternary @click="removeEndpoint(endpoint.id)">
                  <template #icon><Trash2 :size="16" /></template>
                </n-button>
              </div>

              <p v-if="endpoint.testResult" :class="['test-result', { error: endpoint.testResult.startsWith('失败') }]">
                {{ endpoint.testResult }}
              </p>
              <pre v-if="endpoint.usageResult" class="usage-box">{{ endpoint.usageResult }}</pre>
            </div>
            <p v-if="settings.online.endpoints.length === 0" class="empty-state">还没有在线接口。</p>
          </div>
        </article>
      </section>

      <footer class="actionbar">
        <p :class="{ error: hasError }">{{ status }}</p>
        <n-space>
          <n-button secondary @click="hideWindow">收起</n-button>
          <n-button v-if="activeView === 'translate'" type="primary" :loading="translating" @click="translate">
            <template #icon><Languages :size="17" /></template>
            翻译
          </n-button>
          <n-button v-else type="primary" @click="saveSettings">保存设置</n-button>
        </n-space>
      </footer>
    </main>
  </n-config-provider>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import {
  ArrowLeftRight,
  Download,
  FolderOpen,
  Keyboard,
  Languages,
  Plus,
  Settings,
  Trash2,
  Wifi
} from 'lucide-vue-next';

const activeView = ref('translate');
const sourceInput = ref(null);
const sourceText = ref('');
const translatedText = ref('');
const sourceLang = ref('auto');
const targetLang = ref('zh');
const shortcutLabel = ref('Ctrl + Shift + T');
const status = ref('准备就绪');
const hasError = ref(false);
const translating = ref(false);
const localBusy = ref(false);
const downloadProgress = ref(0);
const localProgressLabel = ref('未加载');
const testingId = ref('');
const loadingModelsId = ref('');
const usageId = ref('');

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

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeEndpoint(endpoint) {
  endpoint.modelsPath ||= '/v1/models';
  endpoint.chatPath ||= '/v1/chat/completions';
  endpoint.models ||= [];
  endpoint.testResult ||= '';
  endpoint.usageResult ||= '';
  return endpoint;
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

function setStatus(message, isError = false) {
  status.value = message;
  hasError.value = isError;
}

async function saveSettings() {
  applySettings(await window.translator.saveSettings(cloneSettings()));
  setStatus('设置已保存');
}

async function setMode(mode) {
  settings.mode = mode;
  await saveSettings();
}

async function chooseModelDirectory() {
  const directory = await window.translator.selectDirectory(settings.local.modelDir);
  if (!directory) return;
  settings.local.modelDir = directory;
  await saveSettings();
}

function ensureModelPath() {
  if (!settings.local.modelDir) {
    setStatus('请先选择模型下载或加载位置', true);
    activeView.value = 'settings';
    return false;
  }
  return true;
}

async function downloadLocalModel() {
  if (!ensureModelPath()) return;
  localBusy.value = true;
  downloadProgress.value = 0;
  localProgressLabel.value = '准备下载模型';
  setStatus('正在下载并加载模型...');
  try {
    await window.translator.downloadLocalModel(plain(settings.local));
    settings.local.loaded = true;
    await saveSettings();
    downloadProgress.value = 100;
    localProgressLabel.value = '模型已就绪';
    setStatus('模型已下载并加载');
  } catch (error) {
    setStatus(error.message || '模型下载失败', true);
  } finally {
    localBusy.value = false;
  }
}

async function loadLocalModel() {
  if (!ensureModelPath()) return;
  localBusy.value = true;
  localProgressLabel.value = '正在加载本地模型';
  setStatus('正在加载本地模型...');
  try {
    await window.translator.loadLocalModel(plain(settings.local));
    settings.local.loaded = true;
    await saveSettings();
    downloadProgress.value = 100;
    localProgressLabel.value = '模型已就绪';
    setStatus('本地模型已加载');
  } catch (error) {
    setStatus(error.message || '本地模型加载失败', true);
  } finally {
    localBusy.value = false;
  }
}

function addEndpoint() {
  const id = `endpoint-${Date.now()}`;
  settings.online.endpoints.push(normalizeEndpoint({
    id,
    name: `接口 ${settings.online.endpoints.length + 1}`,
    baseUrl: '',
    apiKey: '',
    model: ''
  }));
}

async function fetchModels(endpoint) {
  loadingModelsId.value = endpoint.id;
  endpoint.testResult = '';
  try {
    const result = await window.translator.fetchOnlineModels(plain(endpoint));
    endpoint.models = result.models;
    if (!endpoint.model && result.models.length > 0) endpoint.model = result.models[0];
    endpoint.testResult = `已获取 ${result.models.length} 个模型`;
  } catch (error) {
    endpoint.testResult = `失败：${error.message || '获取模型列表失败'}`;
  } finally {
    loadingModelsId.value = '';
  }
}

async function activateEndpoint(endpoint) {
  try {
    const saved = await window.translator.activateOnlineEndpoint(plain(endpoint));
    applySettings(saved);
    setStatus('线上接口已生效');
  } catch (error) {
    setStatus(error.message || '启动接口失败', true);
  }
}

async function removeEndpoint(id) {
  settings.online.endpoints = settings.online.endpoints.filter((endpoint) => endpoint.id !== id);
  if (settings.online.activeId === id) {
    settings.online.activeId = settings.online.endpoints[0]?.id || '';
  }
  await saveSettings();
}

async function testEndpoint(endpoint) {
  testingId.value = endpoint.id;
  endpoint.testResult = '测试中...';
  try {
    const result = await window.translator.testOnlineEndpoint(plain(endpoint));
    endpoint.testResult = `通过：${result.translatedText || '接口可用'}`;
  } catch (error) {
    endpoint.testResult = `失败：${error.message || '接口不可用'}`;
  } finally {
    testingId.value = '';
  }
}

async function fetchUsage(endpoint) {
  usageId.value = endpoint.id;
  try {
    const result = await window.translator.fetchUsage(plain(endpoint));
    endpoint.usageResult = result.usage;
  } catch (error) {
    endpoint.usageResult = `查询失败：${error.message || '接口不支持用量查询'}`;
  } finally {
    usageId.value = '';
  }
}

async function translate() {
  const text = sourceText.value.trim();
  if (!text) {
    translatedText.value = '';
    setStatus('输入文本后开始翻译');
    sourceInput.value?.focus();
    return;
  }
  translating.value = true;
  setStatus(settings.mode === 'local' ? '正在调用本地模型...' : '正在调用线上接口...');
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
    setStatus(settings.mode === 'local' ? '本地翻译完成' : '线上翻译完成');
  } catch (error) {
    setStatus(error.message || '翻译失败', true);
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
  setStatus('已清空');
  sourceInput.value?.focus();
}

async function copyResult() {
  const text = translatedText.value.trim();
  if (!text) {
    setStatus('没有可复制的译文');
    return;
  }
  await navigator.clipboard.writeText(text);
  setStatus('译文已复制');
}

function swapLanguages() {
  if (sourceLang.value === 'auto') sourceLang.value = targetLang.value;
  const oldSource = sourceLang.value;
  sourceLang.value = targetLang.value;
  targetLang.value = oldSource;
  sourceInput.value?.focus();
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
  window.translator.onFocusInput(() => {
    window.setTimeout(() => sourceInput.value?.focus(), 60);
  });
  removeProgressListener = window.translator.onLocalProgress((message) => {
    if (message.type === 'progress') {
      downloadProgress.value = message.progress || 0;
      localProgressLabel.value = message.file
        ? `${message.status || '处理中'}：${message.file}`
        : message.status || '处理中';
    } else if (message.type === 'status') {
      setStatus(message.message);
    }
  });
  const [shortcut, savedSettings] = await Promise.all([
    window.translator.getShortcut(),
    window.translator.getSettings()
  ]);
  shortcutLabel.value = shortcut.replace('Control', 'Ctrl').replaceAll('+', ' + ');
  applySettings(savedSettings);
  sourceInput.value?.focus();
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  removeProgressListener?.();
});
</script>

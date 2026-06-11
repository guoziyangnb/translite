<!--
组件作用：应用全局设置弹窗。提供通用设置、隐私、关于三个分页，采用左右分栏布局。
适用场景：在翻译首页点击标题右侧的齿轮图标后弹出。
-->
<template>
  <n-modal
    :show="show"
    :mask-closable="false"
    :auto-focus="false"
    preset="card"
    class="app-settings-modal"
    :style="{ width: '760px', maxWidth: '94vw' }"
    title="应用设置"
    :bordered="false"
    @update:show="(value) => $emit('update:show', value)"
  >
    <div class="settings-shell">
      <aside class="settings-nav" role="tablist">
        <button
          v-for="item in navItems"
          :key="item.key"
          :class="['nav-item', { active: activeTab === item.key }]"
          type="button"
          role="tab"
          :aria-selected="activeTab === item.key"
          @click="activeTab = item.key"
        >
          <component :is="item.icon" :size="16" />
          <span>{{ item.label }}</span>
        </button>
      </aside>

      <section class="settings-content">
        <div v-show="activeTab === 'general'" class="settings-scroll">
          <div class="settings-section">
            <header class="settings-section__head">
              <strong>启动</strong>
              <p>控制应用的启动方式与更新检测。</p>
            </header>
            <div class="switch-row">
              <div>
                <span>开机自启</span>
                <p>登录系统后自动启动 TransLite。</p>
              </div>
              <n-switch :value="form.autoStart" @update:value="(value) => updateField('autoStart', value)" />
            </div>
            <div class="switch-row">
              <div>
                <span>启动时静默运行</span>
                <p>启动后不弹出主窗口，等待快捷键唤起。</p>
              </div>
              <n-switch
                :value="form.silentStartup"
                :disabled="!form.autoStart"
                @update:value="(value) => updateField('silentStartup', value)"
              />
            </div>
            <div class="switch-row">
              <div>
                <span>自动检查更新</span>
                <p>启动时尝试连接更新源，发现新版本时提示。</p>
              </div>
              <n-switch :value="form.autoCheckUpdate" @update:value="(value) => updateField('autoCheckUpdate', value)" />
            </div>
          </div>

          <div class="settings-section">
            <header class="settings-section__head">
              <strong>快捷键</strong>
              <p>用于快速唤起或收起翻译窗口，点击录入按钮后按下组合键。</p>
            </header>
            <div class="shortcut-row">
              <n-input
                :value="shortcutLabel(form.shortcut)"
                readonly
                placeholder="点击右侧按钮开始录入"
              />
              <n-button v-if="!recording" secondary @click="startRecording">录入新快捷键</n-button>
              <n-button v-else type="warning" secondary @click="stopRecording">取消录入</n-button>
              <n-button quaternary @click="resetShortcut">还原默认</n-button>
            </div>
            <p v-if="recording" class="hint">请按下要使用的组合键（需包含 Ctrl / Alt / Shift 之一加一个键），按 Esc 取消。</p>
          </div>

          <div class="settings-section">
            <header class="settings-section__head">
              <strong>界面语言</strong>
              <p>切换 UI 显示语言，部分文案需要重启后生效。</p>
            </header>
            <n-radio-group :value="form.language" @update:value="(value) => updateField('language', value)">
              <n-space vertical>
                <n-radio value="system">跟随系统</n-radio>
                <n-radio value="zh">简体中文</n-radio>
                <n-radio value="en">English</n-radio>
                <n-radio value="ja">日本語</n-radio>
                <n-radio value="ko">한국어</n-radio>
              </n-space>
            </n-radio-group>
          </div>
        </div>

        <div v-show="activeTab === 'privacy'" class="settings-scroll">
          <div class="settings-section">
            <header class="settings-section__head">
              <strong>配置文件位置</strong>
              <p>所有偏好与供应商配置保存在以下文件中，可手动备份。</p>
            </header>
            <div class="path-box">
              <code>{{ configPath || '读取中…' }}</code>
              <n-space>
                <n-button size="small" secondary :disabled="!configPath" @click="copyPath">复制路径</n-button>
                <n-button size="small" secondary :disabled="!configPath" @click="openConfigDir">打开所在目录</n-button>
              </n-space>
            </div>
            <p class="hint">仅在本机存储；不会上传任何文本到 TransLite 服务器。</p>
          </div>
        </div>

        <div v-show="activeTab === 'about'" class="settings-scroll">
          <div class="settings-section">
            <div class="about-version">
              <div class="about-version__left">
                <img class="about-icon" :src="iconUrl" alt="TransLite" />
                <div>
                  <strong>TransLite</strong>
                  <p>版本 {{ appInfo.version || '—' }}</p>
                </div>
              </div>
              <div class="about-version__actions">
                <n-button
                  v-if="!isUpdateInProgress && updateStage !== 'ready'"
                  type="primary"
                  :loading="updateLoading"
                  @click="onCheckUpdate"
                >检查更新</n-button>
                <n-button
                  v-if="updateStage === 'available'"
                  type="primary"
                  :loading="downloadStarting"
                  @click="onStartUpdateDownload"
                >现在更新</n-button>
                <n-button
                  v-if="updateStage === 'ready'"
                  type="primary"
                  :loading="installing"
                  @click="onInstallUpdate"
                >立即重启安装</n-button>
                <n-button
                  v-if="updateStage === 'ready' && !installing"
                  quaternary
                  @click="resetUpdateState"
                >稍后再说</n-button>
              </div>
            </div>
            <div v-if="updateStage === 'available' && availableVersion" class="update-info">
              <strong>已发现新版本 {{ availableVersion }}</strong>
              <p>当前版本 {{ appInfo.version || '—' }}，点击「现在更新」即可下载并自动重启。</p>
              <p v-if="currentMirror" class="mirror-line">将通过镜像源 <code>{{ currentMirror }}</code> 加速下载</p>
            </div>
            <div v-if="updateStage === 'downloading'" class="update-progress">
              <n-progress
                type="line"
                :percentage="downloadPercent"
                :show-indicator="true"
                indicator-placement="inside"
                :height="14"
              />
              <p class="hint">{{ downloadStatusLabel }}</p>
            </div>
            <div v-if="updateStage === 'ready'" class="update-info">
              <strong>新版本已下载完成</strong>
              <p>正在准备重启安装；如未自动启动，可点击「立即重启安装」。</p>
            </div>
            <p v-if="updateMessage" class="hint">{{ updateMessage }}</p>
          </div>

          <div class="settings-section">
            <header class="settings-section__head">
              <strong>文档与链接</strong>
              <p>点击在默认浏览器中打开。</p>
            </header>
            <div class="link-list">
              <div v-for="link in links" :key="link.url" class="link-card">
                <div class="link-card__info">
                  <component :is="link.icon" :size="18" />
                  <div>
                    <span class="link-title">{{ link.title }}</span>
                    <p>{{ link.description }}</p>
                  </div>
                </div>
                <n-button secondary size="small" @click="openUrl(link.url)">
                  <template #icon><ExternalLink :size="14" /></template>
                  跳转
                </n-button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="footer-row">
        <span v-if="dirty" class="dirty-tag">有未保存的修改</span>
        <n-space>
          <n-button @click="onClose">关闭</n-button>
          <n-button type="primary" :loading="saveLoading" :disabled="!dirty || saveLoading" @click="onSave">保存</n-button>
        </n-space>
      </div>
    </template>
  </n-modal>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { BookOpen, ExternalLink, Github, Info, Lock, Settings as SettingsIcon } from 'lucide-vue-next';
import iconUrl from '../assets/translite-icon.svg';

const props = defineProps({
  show: { type: Boolean, required: true },
  preferences: { type: Object, required: true },
  saveLoading: { type: Boolean, default: false }
});

const emit = defineEmits(['update:show', 'save', 'message']);

const navItems = [
  { key: 'general', label: '通用设置', icon: SettingsIcon },
  { key: 'privacy', label: '隐私', icon: Lock },
  { key: 'about', label: '关于', icon: Info }
];

const activeTab = ref('general');
const recording = ref(false);
const updateLoading = ref(false);
const updateMessage = ref('');
const updateStage = ref('idle'); // idle | available | downloading | ready
const availableVersion = ref('');
const currentMirror = ref('');
const downloadPercent = ref(0);
const downloadSpeed = ref(0);
const downloadStarting = ref(false);
const installing = ref(false);
const configPath = ref('');
const appInfo = reactive({ name: '', version: '', platform: '', electron: '', node: '' });

let removeUpdateListener = null;

const isUpdateInProgress = computed(() =>
  updateStage.value === 'available' || updateStage.value === 'downloading'
);

const defaultShortcut = navigator.platform.toLowerCase().includes('mac')
  ? 'Command+Shift+T'
  : 'Control+Shift+T';

const links = [
  {
    title: 'GitHub 仓库',
    description: '查看源码、提交反馈或贡献代码。',
    icon: Github,
    url: 'https://github.com/guoziyangnb/translite'
  },
  {
    title: '使用文档',
    description: '配置说明、常见问题与使用技巧。',
    icon: BookOpen,
    url: 'https://github.com/guoziyangnb/translite#readme'
  }
];

const form = reactive({
  autoStart: false,
  silentStartup: false,
  autoCheckUpdate: true,
  shortcut: defaultShortcut,
  language: 'system'
});

const baseSnapshot = ref(snapshotForm());

const dirty = computed(() => JSON.stringify(snapshotForm()) !== JSON.stringify(baseSnapshot.value));

function snapshotForm() {
  return {
    autoStart: form.autoStart,
    silentStartup: form.silentStartup,
    autoCheckUpdate: form.autoCheckUpdate,
    shortcut: form.shortcut,
    language: form.language
  };
}

function applyFromProps() {
  const prefs = props.preferences || {};
  form.autoStart = Boolean(prefs.autoStart);
  form.silentStartup = Boolean(prefs.silentStartup);
  form.autoCheckUpdate = prefs.autoCheckUpdate !== false;
  form.shortcut = prefs.shortcut || defaultShortcut;
  form.language = prefs.language || 'system';
  baseSnapshot.value = snapshotForm();
  updateMessage.value = '';
}

function shortcutLabel(value) {
  return (value || '')
    .replace(/Control/g, 'Ctrl')
    .replace(/Command/g, 'Cmd')
    .replaceAll('+', ' + ');
}

function updateField(field, value) {
  form[field] = value;
  if (field === 'autoStart' && !value && form.silentStartup) {
    form.silentStartup = false;
  }
}

function startRecording() {
  recording.value = true;
  window.addEventListener('keydown', captureKey, true);
}

function stopRecording() {
  recording.value = false;
  window.removeEventListener('keydown', captureKey, true);
}

function captureKey(event) {
  if (!recording.value) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.key === 'Escape') {
    stopRecording();
    return;
  }
  const modifiers = [];
  if (event.ctrlKey) modifiers.push('Control');
  if (event.shiftKey) modifiers.push('Shift');
  if (event.altKey) modifiers.push('Alt');
  if (event.metaKey) modifiers.push(navigator.platform.toLowerCase().includes('mac') ? 'Command' : 'Super');
  const mainKey = normalizeMainKey(event.key, event.code);
  if (!mainKey || ['Control', 'Shift', 'Alt', 'Meta'].includes(mainKey)) return;
  if (modifiers.length === 0) {
    emit('message', { type: 'warning', content: '请至少包含 Ctrl / Alt / Shift 中的一个修饰键' });
    return;
  }
  form.shortcut = [...modifiers, mainKey].join('+');
  stopRecording();
}

function normalizeMainKey(key, code) {
  if (!key) return '';
  if (key.length === 1) return key.toUpperCase();
  const map = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ' ': 'Space',
    Spacebar: 'Space',
    Enter: 'Return',
    Escape: 'Esc'
  };
  if (map[key]) return map[key];
  if (/^F\d{1,2}$/.test(key)) return key;
  if (code?.startsWith('Key')) return code.slice(3);
  if (code?.startsWith('Digit')) return code.slice(5);
  return key;
}

function resetShortcut() {
  form.shortcut = defaultShortcut;
}

async function refreshConfigPath() {
  if (!window.translator?.getConfigPath) return;
  try {
    configPath.value = await window.translator.getConfigPath();
  } catch {
    configPath.value = '';
  }
}

async function refreshAppInfo() {
  if (!window.translator?.getAppInfo) return;
  try {
    Object.assign(appInfo, await window.translator.getAppInfo());
  } catch {}
}

async function copyPath() {
  try {
    await navigator.clipboard.writeText(configPath.value);
    emit('message', { type: 'success', content: '路径已复制' });
  } catch {
    emit('message', { type: 'error', content: '复制失败' });
  }
}

async function openConfigDir() {
  if (!configPath.value) return;
  await window.translator?.revealConfig?.();
}

async function openUrl(url) {
  await window.translator?.openExternal?.(url);
}

const downloadStatusLabel = computed(() => {
  if (updateStage.value !== 'downloading') return '';
  const speed = downloadSpeed.value;
  const speedText = speed > 0 ? `（${formatSpeed(speed)}）` : '';
  const mirrorText = currentMirror.value ? `通过 ${currentMirror.value} ` : '';
  return `${mirrorText}下载中 ${downloadPercent.value}%${speedText}`;
});

function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond) return '';
  if (bytesPerSecond > 1024 * 1024) return `${(bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s`;
  if (bytesPerSecond > 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${Math.round(bytesPerSecond)} B/s`;
}

function resetUpdateState() {
  updateStage.value = 'idle';
  availableVersion.value = '';
  downloadPercent.value = 0;
  downloadSpeed.value = 0;
  downloadStarting.value = false;
  updateMessage.value = '';
}

function handleUpdateEvent(message) {
  if (!message || typeof message !== 'object') return;
  const { event, payload = {} } = message;
  switch (event) {
    case 'checking':
      if (payload.mirror) currentMirror.value = payload.mirror;
      break;
    case 'available':
      availableVersion.value = payload.version || '';
      currentMirror.value = payload.mirror || currentMirror.value;
      updateStage.value = 'available';
      updateMessage.value = '';
      break;
    case 'not-available':
      if (updateStage.value === 'idle') {
        updateMessage.value = `当前已是最新版本（${payload.version || appInfo.version || '—'}）`;
      }
      break;
    case 'download-progress':
      updateStage.value = 'downloading';
      downloadStarting.value = false;
      downloadPercent.value = payload.percent ?? 0;
      downloadSpeed.value = payload.bytesPerSecond ?? 0;
      if (payload.mirror) currentMirror.value = payload.mirror;
      break;
    case 'mirror-switch':
      if (payload.to) {
        currentMirror.value = payload.to;
        updateMessage.value = `镜像 ${payload.from || ''} 失败，尝试切换到 ${payload.to}…`;
      }
      break;
    case 'downloaded':
      availableVersion.value = payload.version || availableVersion.value;
      downloadPercent.value = 100;
      updateStage.value = 'ready';
      downloadStarting.value = false;
      updateMessage.value = '';
      break;
    case 'error':
      downloadStarting.value = false;
      installing.value = false;
      updateMessage.value = payload.message || '更新过程中发生错误';
      if (updateStage.value === 'downloading') updateStage.value = 'available';
      break;
    default:
      break;
  }
}

async function onCheckUpdate() {
  if (!window.translator?.checkUpdate) {
    updateMessage.value = '当前环境不支持检查更新';
    return;
  }
  updateLoading.value = true;
  updateMessage.value = '正在检查更新…';
  try {
    const result = await window.translator.checkUpdate();
    if (result?.devMode) {
      updateMessage.value = result.message || '开发环境不会进行更新检测。';
      return;
    }
    currentMirror.value = result?.mirror || currentMirror.value;
    if (result?.hasUpdate) {
      availableVersion.value = result.latestVersion || '';
      updateStage.value = 'available';
      updateMessage.value = '';
    } else {
      updateStage.value = 'idle';
      updateMessage.value = result?.message || `当前已是最新版本（${result?.currentVersion || appInfo.version}）`;
    }
  } catch (error) {
    updateMessage.value = error?.message || '检查更新失败';
  } finally {
    updateLoading.value = false;
  }
}

async function onStartUpdateDownload() {
  if (!window.translator?.downloadUpdate) {
    updateMessage.value = '当前环境不支持自动下载更新';
    return;
  }
  downloadStarting.value = true;
  updateMessage.value = '';
  updateStage.value = 'downloading';
  downloadPercent.value = 0;
  downloadSpeed.value = 0;
  try {
    const result = await window.translator.downloadUpdate();
    if (result?.mirror) currentMirror.value = result.mirror;
    updateStage.value = 'ready';
    downloadPercent.value = 100;
    // 下载完成立即触发重启安装，符合"点击现在更新即可完成升级"的体验。
    await onInstallUpdate();
  } catch (error) {
    updateMessage.value = error?.message || '更新下载失败';
    updateStage.value = 'available';
  } finally {
    downloadStarting.value = false;
  }
}

async function onInstallUpdate() {
  if (!window.translator?.installUpdate) return;
  installing.value = true;
  updateMessage.value = '正在退出并启动安装程序…';
  try {
    await window.translator.installUpdate();
  } catch (error) {
    installing.value = false;
    updateMessage.value = error?.message || '安装更新失败';
  }
}

function onSave() {
  emit('save', snapshotForm());
}

function onClose() {
  if (recording.value) stopRecording();
  emit('update:show', false);
}

watch(
  () => props.show,
  (value) => {
    if (value) {
      applyFromProps();
      refreshConfigPath();
      refreshAppInfo();
    } else if (recording.value) {
      stopRecording();
    }
  }
);

watch(
  () => props.preferences,
  () => {
    applyFromProps();
  },
  { deep: true }
);

onMounted(() => {
  if (window.translator?.onUpdateEvent) {
    removeUpdateListener = window.translator.onUpdateEvent(handleUpdateEvent);
  }
});

onUnmounted(() => {
  removeUpdateListener?.();
  removeUpdateListener = null;
});
</script>

<style scoped>
.settings-shell {
  display: grid;
  grid-template-columns: 168px 1fr;
  height: 480px;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 8px;
  border-right: 1px solid var(--line);
  background: #f7f9f7;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.nav-item:hover {
  background: rgba(31, 122, 92, 0.08);
  color: var(--text);
}

.nav-item.active {
  background: var(--accent);
  color: #fff;
}

.settings-content {
  min-width: 0;
  min-height: 0;
  background: #fff;
}

.settings-scroll {
  height: 100%;
  padding: 18px 20px;
  overflow: auto;
}

.settings-section {
  display: grid;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--line);
}

.settings-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: 0;
}

.settings-section__head strong {
  display: block;
  margin-bottom: 2px;
}

.settings-section__head p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fbfcfb;
}

.switch-row span {
  display: block;
  font-weight: 700;
}

.switch-row p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shortcut-row .n-input {
  flex: 1;
}

.hint {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.path-box {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fbfcfb;
}

.path-box code {
  display: block;
  padding: 8px;
  border-radius: 4px;
  background: #f3f6f4;
  font-family: 'Consolas', 'Menlo', monospace;
  font-size: 12px;
  word-break: break-all;
}

.about-version {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fbfcfb;
}

.about-version__left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.about-version__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.update-info {
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  background: #f6faf7;
}

.update-info strong {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
}

.update-info p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.update-info .mirror-line {
  margin-top: 4px;
}

.update-info code {
  padding: 1px 6px;
  background: rgba(31, 122, 92, 0.12);
  border-radius: 4px;
  font-family: 'Consolas', 'Menlo', monospace;
  font-size: 12px;
  color: var(--text);
}

.update-progress {
  display: grid;
  gap: 6px;
}

.about-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
}

.about-version strong {
  display: block;
  font-size: 16px;
  margin-bottom: 2px;
}

.about-version p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.link-list {
  display: grid;
  gap: 10px;
}

.link-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fbfcfb;
}

.link-card__info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.link-card__info > svg {
  flex-shrink: 0;
  color: var(--accent);
}

.link-title {
  display: block;
  font-weight: 700;
  margin-bottom: 2px;
}

.link-card__info p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dirty-tag {
  color: #b77900;
  font-size: 12px;
}
</style>

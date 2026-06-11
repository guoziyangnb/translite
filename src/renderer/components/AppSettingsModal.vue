<!--
组件作用：应用全局设置弹窗。提供通用设置、隐私、关于三个分页。
适用场景：在翻译首页点击标题右侧的齿轮图标后弹出。
-->
<template>
  <n-modal
    :show="show"
    :mask-closable="false"
    :auto-focus="false"
    preset="card"
    class="app-settings-modal"
    :style="{ width: '720px', maxWidth: '92vw' }"
    :title="'应用设置'"
    :bordered="false"
    @update:show="(value) => $emit('update:show', value)"
  >
    <div class="settings-layout-wrap">
      <n-tabs type="line" :value="activeTab" animated @update:value="(value) => (activeTab = value)">
        <n-tab-pane name="general" tab="通用设置">
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
              <p>用于快速唤起或收起翻译窗口，按键时录入。</p>
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
        </n-tab-pane>

        <n-tab-pane name="privacy" tab="隐私">
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
        </n-tab-pane>

        <n-tab-pane name="about" tab="关于">
          <div class="settings-section about-card">
            <div class="about-head">
              <div>
                <strong>TransLite</strong>
                <p>当前版本：{{ appInfo.version || '—' }}</p>
              </div>
              <n-button type="primary" secondary :loading="updateLoading" @click="onCheckUpdate">检查更新</n-button>
            </div>
            <p v-if="updateMessage" class="hint">{{ updateMessage }}</p>
          </div>

          <div class="settings-section">
            <header class="settings-section__head">
              <strong>文档与链接</strong>
              <p>点击在默认浏览器中打开。</p>
            </header>
            <div class="link-list">
              <a v-for="link in links" :key="link.url" class="link-item" @click.prevent="openUrl(link.url)" href="#">
                <span class="link-title">{{ link.title }}</span>
                <span class="link-url">{{ link.url }}</span>
              </a>
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
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
import { computed, reactive, ref, watch } from 'vue';

const props = defineProps({
  show: { type: Boolean, required: true },
  preferences: { type: Object, required: true },
  saveLoading: { type: Boolean, default: false }
});

const emit = defineEmits(['update:show', 'save', 'message']);

const activeTab = ref('general');
const recording = ref(false);
const updateLoading = ref(false);
const updateMessage = ref('');
const configPath = ref('');
const appInfo = reactive({ name: '', version: '', platform: '', electron: '', node: '' });

const defaultShortcut = navigator.platform.toLowerCase().includes('mac')
  ? 'Command+Shift+T'
  : 'Control+Shift+T';

const links = [
  { title: 'GitHub 仓库', url: 'https://github.com/guoziyangnb/translite' },
  { title: '使用文档', url: 'https://github.com/guoziyangnb/translite#readme' },
  { title: '问题反馈', url: 'https://github.com/guoziyangnb/translite/issues' }
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

async function onCheckUpdate() {
  if (!window.translator?.checkUpdate) {
    updateMessage.value = '当前环境不支持检查更新';
    return;
  }
  updateLoading.value = true;
  updateMessage.value = '';
  try {
    const result = await window.translator.checkUpdate();
    updateMessage.value = result.hasUpdate
      ? `发现新版本 ${result.latestVersion}，当前版本 ${result.currentVersion}`
      : result.message || `当前已是最新版本（${result.currentVersion}）`;
  } catch (error) {
    updateMessage.value = error?.message || '检查更新失败';
  } finally {
    updateLoading.value = false;
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
</script>

<style scoped>
.settings-layout-wrap {
  max-height: 60vh;
  overflow: auto;
  padding-right: 4px;
}

.settings-section {
  display: grid;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}

.settings-section:last-child {
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

.about-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.about-head strong {
  display: block;
  font-size: 16px;
  margin-bottom: 2px;
}

.about-head p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.link-list {
  display: grid;
  gap: 8px;
}

.link-item {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fbfcfb;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}

.link-item:hover {
  background: rgba(31, 122, 92, 0.06);
  border-color: var(--accent);
}

.link-title {
  font-weight: 700;
}

.link-url {
  color: var(--muted);
  font-size: 12px;
  word-break: break-all;
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

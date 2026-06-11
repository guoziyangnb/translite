const { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, shell } = require('electron');
const { Worker } = require('worker_threads');
const { autoUpdater } = require('electron-updater');
const fs = require('fs/promises');
const path = require('path');
const vm = require('vm');

// GitHub Release 的 latest 直链——所有镜像都把这个 URL 当后缀拼接。
const GITHUB_RELEASE_BASE = 'https://github.com/guoziyangnb/translite/releases/latest/download';

// 国内访问 GitHub 速度普遍偏慢，这里按优先级排列了一组镜像源前缀。
// 第一个能正常返回 latest.yml 的源就用，失败时自动切到下一个；最后一项为空表示直连 GitHub 兜底。
const UPDATE_MIRRORS = [
  { name: 'gh-proxy', prefix: 'https://gh-proxy.com/' },
  { name: 'moeyy', prefix: 'https://github.moeyy.xyz/' },
  { name: 'ghproxy.net', prefix: 'https://ghproxy.net/' },
  { name: 'github', prefix: '' }
];

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const defaultShortcut = isMac ? 'Command+Shift+T' : 'Control+Shift+T';
const defaultModelId = 'onnx-community/HY-MT1.5-1.8B-ONNX';
const defaultUsageTemplate = 'officialStatus';
const assetsDir = path.join(__dirname, 'renderer', 'assets');
const preferredIcon = isWin
  ? path.join(assetsDir, 'translite-icon.ico')
  : isMac
    ? path.join(assetsDir, 'translite-icon.icns')
    : path.join(assetsDir, 'translite-icon.png');
const appIconPath = require('node:fs').existsSync(preferredIcon)
  ? preferredIcon
  : path.join(assetsDir, 'translite-icon.png');

let mainWindow;
let settingsPath;
let settings;
let localWorker;
let nextRequestId = 1;
let registeredShortcut = '';
const pendingRequests = new Map();

let updaterInitialized = false;
let currentMirrorIndex = 0;
let cachedUpdateInfo = null;
let updateDownloadCompleted = false;

function getDefaultPreferences() {
  return {
    autoStart: false,
    silentStartup: false,
    autoCheckUpdate: true,
    shortcut: defaultShortcut,
    language: 'system'
  };
}

function getDefaultSettings() {
  return {
    mode: 'local',
    local: {
      modelId: defaultModelId,
      modelDir: path.join(app.getPath('userData'), 'models', 'hy-mt'),
      loaded: false
    },
    online: {
      activeId: '',
      endpoints: []
    },
    preferences: getDefaultPreferences()
  };
}

function normalizePreferences(input = {}) {
  const defaults = getDefaultPreferences();
  return {
    autoStart: Boolean(input.autoStart ?? defaults.autoStart),
    silentStartup: Boolean(input.silentStartup ?? defaults.silentStartup),
    autoCheckUpdate: Boolean(input.autoCheckUpdate ?? defaults.autoCheckUpdate),
    shortcut: typeof input.shortcut === 'string' && input.shortcut.trim() ? input.shortcut.trim() : defaults.shortcut,
    language: ['system', 'zh', 'en', 'ja', 'ko'].includes(input.language) ? input.language : defaults.language
  };
}

function normalizeEndpoint(endpoint = {}) {
  return {
    id: endpoint.id || `endpoint-${Date.now()}`,
    presetId: endpoint.presetId || '',
    name: endpoint.name || '未命名接口',
    baseUrl: endpoint.baseUrl || endpoint.url || '',
    apiKey: endpoint.apiKey || endpoint.key || '',
    apiFormat: endpoint.apiFormat || 'openai',
    model: endpoint.model || '',
    modelsPath: endpoint.modelsPath || '/models',
    chatPath: endpoint.chatPath || '/chat/completions',
    usageConfig: normalizeUsageConfig(endpoint.usageConfig),
    models: Array.isArray(endpoint.models) ? endpoint.models : [],
    testResult: endpoint.testResult || '',
    usageResult: endpoint.usageResult || ''
  };
}

function normalizeUsageConfig(config = {}) {
  const template = config.template || defaultUsageTemplate;
  const script = migrateUsageScript(config.script || '', template);
  return {
    enabled: config.enabled ?? Boolean(config.lastCheckedAt || config.lastResult || config.lastError),
    baseUrl: config.baseUrl || '',
    apiKey: config.apiKey || '',
    template,
    timeoutSeconds: Number(config.timeoutSeconds ?? 10),
    intervalMinutes: Number(config.intervalMinutes ?? 0),
    script,
    lastCheckedAt: config.lastCheckedAt || '',
    lastResult: config.lastResult || null,
    lastError: config.lastError || ''
  };
}

function migrateUsageScript(script, template) {
  if (!script?.trim() && template === 'mimoUsage') {
    return `({
    request: {
      url: "{{baseUrl}}/chat/completions",
      method: "POST",
      headers: {
        "api-key": "{{apiKey}}",
        "Content-Type": "application/json"
      },
      body: {
        model: "mimo-v2.5-pro",
        messages: [
          { role: "user", content: "Hi" }
        ],
        max_completion_tokens: 8,
        stream: false,
        thinking: {
          type: "disabled"
        }
      }
    },
    extractor: function(response) {
      const usage = response?.usage || {};
      const prompt = usage.prompt_tokens ?? usage.promptTokens;
      const completion = usage.completion_tokens ?? usage.completionTokens;
      const total = usage.total_tokens ?? usage.totalTokens;
      const hasTokenUsage = total !== undefined || prompt !== undefined || completion !== undefined;
      return {
        isValid: !response?.error,
        planName: "小米 MiMo 官方用量",
        metricLabel: "本次请求用量",
        used: total,
        unit: "tokens",
        extra: hasTokenUsage
          ? "Prompt：" + (prompt ?? "-") + "，Completion：" + (completion ?? "-")
          : "接口调用成功，但响应中没有返回 usage 字段。"
      };
    }
  })`;
  }
  if (!script?.trim() && ['officialStatus', 'openaiStatus', 'geminiStatus'].includes(template)) {
    return `({
    request: {
      url: "{{baseUrl}}/models",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      const models = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.models)
          ? response.models
          : [];
      const names = models.map((item) => typeof item === "string" ? item : item.id || item.name || item.model).filter(Boolean);
      return {
        isValid: !response?.error,
        planName: "官方接口",
        extra: names.length
          ? "模型接口可用；官方暂未公开余额查询 API。可用模型：" + names.slice(0, 3).join("、")
          : "模型接口可用；官方暂未公开余额查询 API。"
      };
    }
  })`;
  }
  if (!script?.trim() && template === 'anthropicStatus') {
    return `({
    request: {
      url: "{{baseUrl}}/models",
      method: "GET",
      headers: {
        "x-api-key": "{{apiKey}}",
        "anthropic-version": "2023-06-01"
      }
    },
    extractor: function(response) {
      const models = Array.isArray(response?.data) ? response.data : [];
      const names = models.map((item) => typeof item === "string" ? item : item.id || item.name).filter(Boolean);
      return {
        isValid: !response?.error,
        planName: "Claude 官方接口",
        extra: names.length
          ? "模型接口可用；官方余额需通过控制台查看。可用模型：" + names.slice(0, 3).join("、")
          : "模型接口可用；官方余额需通过控制台查看。"
      };
    }
  })`;
  }
  if (template === 'deepseek' && script.includes('{{baseUrl}}/v1/usage')) {
    return `({
    request: {
      url: "{{baseUrl}}/user/balance",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      const balances = response?.balance_infos || [];
      const cny = balances.find((item) => item.currency === "CNY") || balances[0] || {};
      const remaining = cny.total_balance ?? cny.granted_balance ?? cny.topped_up_balance;
      return {
        isValid: response?.is_available ?? true,
        remaining,
        unit: cny.currency || "CNY"
      };
    }
  })`;
  }
  return script;
}

function normalizeSettings(nextSettings = {}) {
  const defaults = getDefaultSettings();
  return {
    mode: nextSettings.mode || defaults.mode,
    local: { ...defaults.local, ...(nextSettings.local || {}) },
    online: {
      activeId: nextSettings.online?.activeId || '',
      endpoints: (nextSettings.online?.endpoints || []).map(normalizeEndpoint)
    },
    preferences: normalizePreferences(nextSettings.preferences)
  };
}

async function readSettings() {
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    settings = normalizeSettings(JSON.parse(raw));
  } catch {
    settings = getDefaultSettings();
    await writeSettings(settings);
  }
  return settings;
}

async function writeSettings(nextSettings) {
  settings = normalizeSettings(nextSettings);
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  return settings;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 900,
    minHeight: 660,
    show: false,
    title: 'TransLite',
    icon: appIconPath,
    backgroundColor: '#f6f7f4',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'));
  }

  const startHidden = settings?.preferences?.silentStartup && process.argv.includes('--hidden');
  mainWindow.once('ready-to-show', () => {
    if (startHidden) return;
    showTranslator();
  });
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function showTranslator() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('translator:focus-input');
}

function toggleTranslator() {
  if (!mainWindow) return;
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
    return;
  }
  showTranslator();
}

function getLocalWorker() {
  if (localWorker) return localWorker;

  localWorker = new Worker(path.join(__dirname, 'localTranslator.node.js'));
  localWorker.on('error', (error) => {
    const message = error?.message === 'fetch failed'
      ? '本地模型下载失败：无法连接模型下载源。请检查网络、代理或稍后重试。'
      : error?.message || '本地模型处理失败';
    for (const pending of pendingRequests.values()) {
      pending.reject(new Error(message));
    }
    pendingRequests.clear();
    localWorker = null;
  });
  localWorker.on('message', (message) => {
    if (message.type === 'progress' || message.type === 'status') {
      mainWindow?.webContents.send('translator:local-progress', message);
      return;
    }

    const pending = pendingRequests.get(message.id);
    if (!pending) return;
    pendingRequests.delete(message.id);

    if (message.type === 'error') {
      pending.reject(new Error(message.message || '本地模型处理失败'));
      return;
    }
    pending.resolve(message.payload);
  });
  localWorker.on('exit', () => {
    localWorker = null;
  });
  return localWorker;
}

function callLocalWorker(command, payload) {
  const id = nextRequestId++;
  const worker = getLocalWorker();
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({ id, command, payload });
  });
}

function joinEndpoint(baseUrl, pathValue) {
  if (!baseUrl) throw new Error('Base URL 不能为空。');
  if (/^https?:\/\//i.test(pathValue || '')) return pathValue;

  const cleanBase = baseUrl.replace(/\/$/, '');
  let cleanPath = (pathValue || '').startsWith('/') ? pathValue : `/${pathValue || ''}`;

  // 兼容两种常见填写方式，避免拼出 /v1/v1/models。
  if (/\/v\d+$/i.test(cleanBase) && /^\/v\d+\//i.test(cleanPath)) {
    cleanPath = cleanPath.replace(/^\/v\d+/i, '');
  }

  return `${cleanBase}${cleanPath}`;
}

function getHeaders(endpoint) {
  if (endpoint.apiFormat === 'anthropic') {
    return {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      ...(endpoint.apiKey ? { 'x-api-key': endpoint.apiKey } : {})
    };
  }

  return {
    'Content-Type': 'application/json',
    ...(endpoint.apiKey ? { Authorization: `Bearer ${endpoint.apiKey}` } : {})
  };
}

function getActiveEndpoint(config = settings) {
  return (config.online.endpoints || []).find((endpoint) => endpoint.id === config.online.activeId);
}

async function readJsonResponse(response, requestUrl, purpose) {
  const text = await response.text();
  const preview = text.slice(0, 220).replace(/\s+/g, ' ').trim();

  if (!response.ok) {
    throw new Error(`${purpose}失败 ${response.status}。请求地址：${requestUrl}。响应：${preview}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    // 很多用户会误填控制台网页域名，服务端会返回 HTML，这里给出可操作错误。
    const looksLikeHtml = /^<!doctype|^<html|<body/i.test(preview);
    if (looksLikeHtml) {
      throw new Error(`${purpose}失败：接口返回的是 HTML 页面，不是 JSON。请检查 Base URL 和路径。实际请求地址：${requestUrl}`);
    }
    throw new Error(`${purpose}失败：接口返回内容不是合法 JSON。实际请求地址：${requestUrl}。响应：${preview}`);
  }
}

async function fetchOnlineModels(endpointInput) {
  const endpoint = normalizeEndpoint(endpointInput);
  const requestUrl = joinEndpoint(endpoint.baseUrl, endpoint.modelsPath);
  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: getHeaders(endpoint)
  });
  const data = await readJsonResponse(response, requestUrl, '获取模型列表');
  const list = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
  const models = list.map((item) => (typeof item === 'string' ? item : item.id || item.name || item.model)).filter(Boolean);
  if (models.length === 0) {
    throw new Error(`接口返回成功，但没有识别到模型列表 data[].id。实际请求地址：${requestUrl}`);
  }
  return { models, requestUrl };
}

async function requestLLMTranslation(endpointInput, { text, sourceLang, targetLang }) {
  const endpoint = normalizeEndpoint(endpointInput);
  const trimmed = String(text || '').trim();
  if (!trimmed) return { translatedText: '', provider: 'empty' };
  if (!endpoint.model) throw new Error('请先选择模型并保存。');

  const requestUrl = joinEndpoint(endpoint.baseUrl, endpoint.chatPath);
  if (endpoint.apiFormat === 'anthropic') {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: getHeaders(endpoint),
      body: JSON.stringify({
        model: endpoint.model,
        max_tokens: 1200,
        system: `You are a translation engine. Translate the user's text to ${targetLang || 'zh'}. Return only the translated text.`,
        messages: [
          {
            role: 'user',
            content: sourceLang && sourceLang !== 'auto'
              ? `Source language: ${sourceLang}\nText:\n${trimmed}`
              : trimmed
          }
        ]
      })
    });
    const data = await readJsonResponse(response, requestUrl, '调用大模型接口');
    const translatedText = Array.isArray(data.content)
      ? data.content.map((item) => item.text || '').join('').trim()
      : '';
    return {
      translatedText,
      provider: endpoint.name || endpoint.baseUrl
    };
  }

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: getHeaders(endpoint),
    body: JSON.stringify({
      model: endpoint.model,
      messages: [
        {
          role: 'system',
          content: `You are a translation engine. Translate the user's text to ${targetLang || 'zh'}. Return only the translated text.`
        },
        {
          role: 'user',
          content: sourceLang && sourceLang !== 'auto'
            ? `Source language: ${sourceLang}\nText:\n${trimmed}`
            : trimmed
        }
      ]
    })
  });
  const data = await readJsonResponse(response, requestUrl, '调用大模型接口');
  return {
    translatedText: data.choices?.[0]?.message?.content?.trim() || '',
    provider: endpoint.name || endpoint.baseUrl
  };
}

async function translateOnline(payload) {
  const endpoint = getActiveEndpoint();
  if (!endpoint) throw new Error('未启用线上接口，请先在设置页启动一个接口。');
  return requestLLMTranslation(endpoint, payload);
}

function replaceUsageVariables(value, endpoint, context) {
  const usageConfig = context ? null : normalizeUsageConfig(endpoint.usageConfig);
  const currentContext = context || {
    baseUrl: usageConfig.baseUrl || endpoint.baseUrl || '',
    apiKey: usageConfig.apiKey || endpoint.apiKey || ''
  };
  if (typeof value === 'string') {
    return value
      .replaceAll('{{baseUrl}}', currentContext.baseUrl.replace(/\/$/, ''))
      .replaceAll('{{apiKey}}', currentContext.apiKey);
  }
  if (Array.isArray(value)) return value.map((item) => replaceUsageVariables(item, endpoint, currentContext));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceUsageVariables(item, endpoint, currentContext)])
    );
  }
  return value;
}

function evaluateUsageScript(script) {
  if (!script?.trim()) throw new Error('请先填写用量查询脚本。');
  const context = vm.createContext(Object.freeze({}));
  const config = vm.runInContext(`"use strict";\n${script}`, context, { timeout: 1000 });
  if (!config || typeof config !== 'object') throw new Error('脚本必须返回配置对象。');
  if (!config.request || typeof config.request !== 'object') throw new Error('脚本缺少 request 配置。');
  if (typeof config.extractor !== 'function') throw new Error('脚本缺少 extractor 函数。');
  return config;
}

async function testUsageConfig(endpointInput) {
  const endpoint = normalizeEndpoint(endpointInput);
  const usageConfig = normalizeUsageConfig(endpoint.usageConfig);
  const config = evaluateUsageScript(usageConfig.script);
  const request = replaceUsageVariables(config.request, endpoint);
  if (!request.url) throw new Error('用量查询脚本缺少 request.url。');

  const controller = new AbortController();
  const timeout = Math.max(1, Number(usageConfig.timeoutSeconds) || 10) * 1000;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(request.url, {
      method: request.method || 'GET',
      headers: request.headers || {},
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: controller.signal
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = text;
    }
    if (!response.ok) {
      throw new Error(`用量查询失败 ${response.status}。请求地址：${request.url}。响应：${String(text).slice(0, 200)}`);
    }
    const usage = config.extractor(data);
    if (!usage || typeof usage !== 'object') throw new Error('extractor 必须返回对象。');
    return { usage, checkedAt: new Date().toISOString() };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`用量查询超时，超过 ${timeout / 1000} 秒。`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function selectDirectory(defaultPath) {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择模型目录',
    defaultPath,
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return '';
  return result.filePaths[0];
}

function applyAutoStart(preferences) {
  try {
    if (process.platform === 'linux') return;
    app.setLoginItemSettings({
      openAtLogin: Boolean(preferences.autoStart),
      openAsHidden: Boolean(preferences.silentStartup),
      args: preferences.silentStartup ? ['--hidden'] : []
    });
  } catch (error) {
    console.warn('setLoginItemSettings failed:', error?.message || error);
  }
}

function applyShortcut(preferences) {
  const next = preferences.shortcut || defaultShortcut;
  if (registeredShortcut && registeredShortcut !== next) {
    try { globalShortcut.unregister(registeredShortcut); } catch {}
    registeredShortcut = '';
  }
  if (registeredShortcut === next) return { shortcut: next, registered: true };
  try {
    const ok = globalShortcut.register(next, toggleTranslator);
    if (ok) {
      registeredShortcut = next;
      return { shortcut: next, registered: true };
    }
  } catch (error) {
    console.warn('shortcut register failed:', error?.message || error);
  }
  if (next !== defaultShortcut) {
    try {
      const ok = globalShortcut.register(defaultShortcut, toggleTranslator);
      if (ok) {
        registeredShortcut = defaultShortcut;
        return { shortcut: defaultShortcut, registered: true, fallback: true };
      }
    } catch {}
  }
  return { shortcut: next, registered: false };
}

function isNewerVersion(latest, current) {
  if (!latest || !current) return false;
  const parse = (value) => String(value).split('-')[0].split('.').map((part) => parseInt(part, 10) || 0);
  const a = parse(latest);
  const b = parse(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

function broadcastUpdateEvent(event, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('translator:update-event', { event, payload });
}

function buildFeedUrl(mirrorIndex) {
  const entry = UPDATE_MIRRORS[mirrorIndex] || UPDATE_MIRRORS[UPDATE_MIRRORS.length - 1];
  return entry.prefix ? `${entry.prefix}${GITHUB_RELEASE_BASE}` : GITHUB_RELEASE_BASE;
}

function applyFeedUrl(mirrorIndex) {
  currentMirrorIndex = mirrorIndex;
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: buildFeedUrl(mirrorIndex),
    channel: 'latest',
    useMultipleRangeRequest: false
  });
}

function initAutoUpdater() {
  if (updaterInitialized) return;
  updaterInitialized = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (...args) => console.log('[updater]', ...args),
    warn: (...args) => console.warn('[updater]', ...args),
    error: (...args) => console.error('[updater]', ...args),
    debug: () => {}
  };

  autoUpdater.on('download-progress', (progress) => {
    broadcastUpdateEvent('download-progress', {
      percent: Math.max(0, Math.min(100, Math.round(progress?.percent || 0))),
      transferred: progress?.transferred || 0,
      total: progress?.total || 0,
      bytesPerSecond: progress?.bytesPerSecond || 0,
      mirror: UPDATE_MIRRORS[currentMirrorIndex]?.name || ''
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    cachedUpdateInfo = info;
    updateDownloadCompleted = true;
    broadcastUpdateEvent('downloaded', {
      version: info?.version || '',
      releaseDate: info?.releaseDate || '',
      mirror: UPDATE_MIRRORS[currentMirrorIndex]?.name || ''
    });
  });

  applyFeedUrl(0);
}

async function runSingleCheck(mirrorIndex) {
  applyFeedUrl(mirrorIndex);
  broadcastUpdateEvent('checking', { mirror: UPDATE_MIRRORS[mirrorIndex]?.name || '' });
  const result = await autoUpdater.checkForUpdates();
  const latestVersion = result?.updateInfo?.version || '';
  if (!latestVersion) throw new Error('未能解析远端版本信息。');
  return result.updateInfo;
}

async function performUpdateCheck() {
  const currentVersion = app.getVersion();
  if (!app.isPackaged) {
    return {
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      checkedAt: new Date().toISOString(),
      message: '开发环境不会进行更新检测，请使用打包后的版本。',
      devMode: true
    };
  }
  initAutoUpdater();

  let lastError = null;
  for (let i = 0; i < UPDATE_MIRRORS.length; i++) {
    try {
      const updateInfo = await runSingleCheck(i);
      const latestVersion = updateInfo.version;
      const hasUpdate = isNewerVersion(latestVersion, currentVersion);
      const mirrorName = UPDATE_MIRRORS[i]?.name || '';
      cachedUpdateInfo = hasUpdate ? updateInfo : null;
      updateDownloadCompleted = false;
      const eventPayload = {
        version: latestVersion,
        releaseDate: updateInfo.releaseDate || '',
        releaseNotes: updateInfo.releaseNotes || '',
        mirror: mirrorName
      };
      broadcastUpdateEvent(hasUpdate ? 'available' : 'not-available', eventPayload);
      return {
        currentVersion,
        latestVersion,
        hasUpdate,
        releaseDate: updateInfo.releaseDate || '',
        releaseNotes: updateInfo.releaseNotes || '',
        mirror: mirrorName,
        checkedAt: new Date().toISOString(),
        message: hasUpdate
          ? `发现新版本 ${latestVersion}`
          : `当前已是最新版本（${currentVersion}）`
      };
    } catch (error) {
      lastError = error;
      console.warn(`[updater] 镜像 ${UPDATE_MIRRORS[i]?.name} 检查失败：`, error?.message || error);
    }
  }

  const message = lastError?.message || '所有更新源均不可用，请检查网络。';
  broadcastUpdateEvent('error', { message });
  throw new Error(message);
}

async function startUpdateDownload() {
  if (!app.isPackaged) {
    throw new Error('开发环境无法下载更新，请使用打包后的版本。');
  }
  initAutoUpdater();
  if (updateDownloadCompleted) {
    return {
      version: cachedUpdateInfo?.version || '',
      releaseDate: cachedUpdateInfo?.releaseDate || ''
    };
  }

  let lastError = null;
  for (let i = currentMirrorIndex; i < UPDATE_MIRRORS.length; i++) {
    try {
      applyFeedUrl(i);
      // 重新走一次 check，确保 autoUpdater 内部状态与当前镜像一致。
      await autoUpdater.checkForUpdates();
      await autoUpdater.downloadUpdate();
      // update-downloaded 事件里已经把 cachedUpdateInfo 更新好了。
      return {
        version: cachedUpdateInfo?.version || '',
        releaseDate: cachedUpdateInfo?.releaseDate || '',
        mirror: UPDATE_MIRRORS[i]?.name || ''
      };
    } catch (error) {
      lastError = error;
      console.warn(`[updater] 镜像 ${UPDATE_MIRRORS[i]?.name} 下载失败：`, error?.message || error);
      broadcastUpdateEvent('mirror-switch', {
        from: UPDATE_MIRRORS[i]?.name || '',
        to: UPDATE_MIRRORS[i + 1]?.name || ''
      });
    }
  }

  const message = lastError?.message || '所有更新源均下载失败，请稍后重试。';
  broadcastUpdateEvent('error', { message });
  throw new Error(message);
}

function quitAndInstallUpdate() {
  if (!app.isPackaged) {
    throw new Error('开发环境无法安装更新。');
  }
  if (!updateDownloadCompleted) {
    throw new Error('更新尚未下载完成，请稍候再试。');
  }
  app.isQuitting = true;
  setImmediate(() => {
    try {
      // 第一参数请求静默安装；NSIS 在 oneClick=false 时仍会短暂弹窗，但会自动重启。
      autoUpdater.quitAndInstall(true, true);
    } catch (error) {
      broadcastUpdateEvent('error', { message: error?.message || '安装更新失败' });
    }
  });
}

function scheduleStartupUpdateCheck() {
  if (!settings?.preferences?.autoCheckUpdate) return;
  if (!app.isPackaged) return;
  // 延迟一会儿，避免和窗口加载、模型预热抢资源。
  setTimeout(() => {
    performUpdateCheck().catch((error) => {
      console.warn('[updater] startup check failed:', error?.message || error);
    });
  }, 4000);
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  if (isMac) app.dock?.setIcon(appIconPath);
  await readSettings();
  applyAutoStart(settings.preferences);
  createWindow();

  const result = applyShortcut(settings.preferences);
  if (!result.registered) console.warn(`Global shortcut registration failed: ${settings.preferences.shortcut}`);

  ipcMain.handle('translator:get-settings', () => settings);
  ipcMain.handle('translator:save-settings', async (_event, nextSettings) => {
    const prevPrefs = settings.preferences;
    const saved = await writeSettings(nextSettings);
    if (saved.preferences.shortcut !== prevPrefs.shortcut) applyShortcut(saved.preferences);
    if (saved.preferences.autoStart !== prevPrefs.autoStart
      || saved.preferences.silentStartup !== prevPrefs.silentStartup) {
      applyAutoStart(saved.preferences);
    }
    return saved;
  });
  ipcMain.handle('translator:save-preferences', async (_event, prefs) => {
    const prevPrefs = settings.preferences;
    settings.preferences = normalizePreferences({ ...prevPrefs, ...(prefs || {}) });
    await writeSettings(settings);
    if (settings.preferences.shortcut !== prevPrefs.shortcut) applyShortcut(settings.preferences);
    if (settings.preferences.autoStart !== prevPrefs.autoStart
      || settings.preferences.silentStartup !== prevPrefs.silentStartup) {
      applyAutoStart(settings.preferences);
    }
    return settings.preferences;
  });
  ipcMain.handle('translator:get-config-path', () => settingsPath || '');
  ipcMain.handle('translator:open-external', (_event, url) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
    shell.openExternal(url);
    return true;
  });
  ipcMain.handle('translator:reveal-config', () => {
    if (!settingsPath) return false;
    shell.showItemInFolder(settingsPath);
    return true;
  });
  ipcMain.handle('translator:check-update', () => performUpdateCheck());
  ipcMain.handle('translator:download-update', () => startUpdateDownload());
  ipcMain.handle('translator:install-update', () => {
    quitAndInstallUpdate();
    return true;
  });
  ipcMain.handle('translator:get-app-info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    node: process.versions.node
  }));
  ipcMain.handle('translator:select-directory', (_event, defaultPath) => selectDirectory(defaultPath));
  ipcMain.handle('translator:get-shortcut', () => settings.preferences.shortcut || defaultShortcut);
  ipcMain.handle('translator:translate-online', (_event, payload) => translateOnline(payload));
  ipcMain.handle('translator:fetch-online-models', (_event, endpoint) => fetchOnlineModels(endpoint));
  ipcMain.handle('translator:test-online-endpoint', (_event, endpoint) =>
    requestLLMTranslation(endpoint, { text: 'Hello', sourceLang: 'en', targetLang: 'zh' })
  );
  ipcMain.handle('translator:test-usage-config', (_event, endpoint) => testUsageConfig(endpoint));
  ipcMain.handle('translator:activate-online-endpoint', async (_event, endpoint) => {
    const clean = normalizeEndpoint(endpoint);
    if (!clean.model) throw new Error('请先选择模型。');
    const next = normalizeSettings(settings);
    const index = next.online.endpoints.findIndex((item) => item.id === clean.id);
    if (index >= 0) next.online.endpoints[index] = clean;
    else next.online.endpoints.push(clean);
    next.online.activeId = clean.id;
    next.mode = 'online';
    return writeSettings(next);
  });
  ipcMain.handle('translator:translate-local', (_event, payload) => callLocalWorker('translate', payload));
  ipcMain.handle('translator:load-local-model', async (_event, payload) => {
    const result = await callLocalWorker('load', { ...payload, allowRemote: false });
    settings.local.loaded = true;
    settings.local.modelDir = payload.modelDir;
    await writeSettings(settings);
    return result;
  });
  ipcMain.handle('translator:download-local-model', async (_event, payload) => {
    await fs.mkdir(payload.modelDir, { recursive: true });
    const result = await callLocalWorker('load', { ...payload, allowRemote: true });
    settings.local.loaded = true;
    settings.local.modelDir = payload.modelDir;
    await writeSettings(settings);
    return result;
  });
  ipcMain.handle('translator:hide', () => {
    mainWindow?.hide();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showTranslator();
  });

  scheduleStartupUpdateCheck();
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

app.on('will-quit', () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
  localWorker?.terminate();
});

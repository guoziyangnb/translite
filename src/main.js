const { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, shell } = require('electron');
const { Worker } = require('worker_threads');
const fs = require('fs/promises');
const path = require('path');
const vm = require('vm');

const isMac = process.platform === 'darwin';
const shortcut = isMac ? 'Command+Shift+T' : 'Control+Shift+T';
const defaultModelId = 'onnx-community/HY-MT1.5-1.8B-ONNX';

let mainWindow;
let settingsPath;
let settings;
let localWorker;
let nextRequestId = 1;
const pendingRequests = new Map();

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
    }
  };
}

function normalizeEndpoint(endpoint = {}) {
  return {
    id: endpoint.id || `endpoint-${Date.now()}`,
    name: endpoint.name || '未命名接口',
    baseUrl: endpoint.baseUrl || endpoint.url || '',
    apiKey: endpoint.apiKey || endpoint.key || '',
    model: endpoint.model || '',
    modelsPath: endpoint.modelsPath || '/v1/models',
    chatPath: endpoint.chatPath || '/v1/chat/completions',
    usageConfig: normalizeUsageConfig(endpoint.usageConfig),
    models: Array.isArray(endpoint.models) ? endpoint.models : [],
    testResult: endpoint.testResult || '',
    usageResult: endpoint.usageResult || ''
  };
}

function normalizeUsageConfig(config = {}) {
  const script = migrateUsageScript(config.script || '', config.template || 'deepseek');
  return {
    enabled: config.enabled ?? Boolean(config.lastCheckedAt || config.lastResult || config.lastError),
    template: config.template || 'deepseek',
    timeoutSeconds: Number(config.timeoutSeconds ?? 10),
    intervalMinutes: Number(config.intervalMinutes ?? 0),
    script,
    lastCheckedAt: config.lastCheckedAt || '',
    lastResult: config.lastResult || null,
    lastError: config.lastError || ''
  };
}

function migrateUsageScript(script, template) {
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
    }
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
    title: 'Light Translator',
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

  mainWindow.once('ready-to-show', showTranslator);
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
  const models = Array.isArray(data.data)
    ? data.data.map((item) => item.id || item.name).filter(Boolean)
    : [];
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

function replaceUsageVariables(value, endpoint) {
  if (typeof value === 'string') {
    return value
      .replaceAll('{{baseUrl}}', (endpoint.baseUrl || '').replace(/\/$/, ''))
      .replaceAll('{{apiKey}}', endpoint.apiKey || '');
  }
  if (Array.isArray(value)) return value.map((item) => replaceUsageVariables(item, endpoint));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceUsageVariables(item, endpoint)])
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

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await readSettings();
  createWindow();

  const registered = globalShortcut.register(shortcut, toggleTranslator);
  if (!registered) console.warn(`Global shortcut registration failed: ${shortcut}`);

  ipcMain.handle('translator:get-settings', () => settings);
  ipcMain.handle('translator:save-settings', (_event, nextSettings) => writeSettings(nextSettings));
  ipcMain.handle('translator:select-directory', (_event, defaultPath) => selectDirectory(defaultPath));
  ipcMain.handle('translator:get-shortcut', () => shortcut);
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
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

app.on('will-quit', () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
  localWorker?.terminate();
});

const { parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');

const defaultModelId = 'onnx-community/HY-MT1.5-1.8B-ONNX';

let tokenizer;
let model;
let activeKey = '';

function post(message) {
  parentPort.postMessage(message);
}

function normalizeLanguage(code) {
  if (!code || code === 'auto') return 'auto';
  return code;
}

function buildPrompt(text, sourceLang, targetLang) {
  const source = normalizeLanguage(sourceLang);
  const target = normalizeLanguage(targetLang);
  if (source === 'auto') return `Translate the following text to ${target}:\n${text}`;
  return `Translate from ${source} to ${target}:\n${text}`;
}

function hasDirectModelFiles(modelDir) {
  return modelDir && fs.existsSync(path.join(modelDir, 'config.json'));
}

async function loadModel({ modelId = defaultModelId, modelDir, allowRemote }) {
  const { AutoModelForSeq2SeqLM, AutoTokenizer, env } = await import('@huggingface/transformers');

  env.allowLocalModels = true;
  env.allowRemoteModels = Boolean(allowRemote);
  env.useFSCache = true;

  const modelKey = `${modelId}|${modelDir || ''}`;
  if (model && tokenizer && activeKey === modelKey) {
    return { modelId, modelDir, cached: true };
  }

  const modelRef = hasDirectModelFiles(modelDir) ? modelDir : modelId;
  const options = {
    dtype: 'q4',
    device: 'wasm',
    local_files_only: !allowRemote,
    ...(modelDir && !hasDirectModelFiles(modelDir) ? { cache_dir: modelDir } : {}),
    progress_callback: (progress) => {
      post({
        type: 'progress',
        status: progress.status,
        file: progress.file,
        progress: Math.round(progress.progress || 0)
      });
    }
  };

  post({ type: 'status', message: allowRemote ? '正在下载并加载本地模型...' : '正在从本地目录加载模型...' });
  tokenizer = await AutoTokenizer.from_pretrained(modelRef, options);
  model = await AutoModelForSeq2SeqLM.from_pretrained(modelRef, options);
  activeKey = modelKey;

  return { modelId, modelDir, cached: false };
}

async function translate(payload) {
  const trimmed = String(payload.text || '').trim();
  if (!trimmed) return { translatedText: '' };

  await loadModel({
    modelId: payload.modelId,
    modelDir: payload.modelDir,
    allowRemote: false
  });

  post({ type: 'status', message: '正在本地推理...' });
  const inputs = await tokenizer(buildPrompt(trimmed, payload.sourceLang, payload.targetLang));
  const output = await model.generate({ ...inputs, max_new_tokens: 512 });
  const decoded = tokenizer.batch_decode(output, { skip_special_tokens: true });
  return { translatedText: decoded[0] || '', provider: 'local' };
}

parentPort.on('message', async ({ id, command, payload }) => {
  try {
    if (command === 'load') {
      const result = await loadModel(payload);
      post({ id, type: 'result', payload: result });
      return;
    }

    if (command === 'translate') {
      const result = await translate(payload);
      post({ id, type: 'result', payload: result });
    }
  } catch (error) {
    post({ id, type: 'error', message: error?.message || '本地模型处理失败' });
  }
});

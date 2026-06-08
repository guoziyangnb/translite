const { parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');

const defaultModelId = 'onnx-community/HY-MT1.5-1.8B-ONNX';
const defaultRemoteHost = 'https://huggingface.co/';
const mirrorRemoteHost = 'https://hf-mirror.com/';
const onnxRuntimeDist = path.dirname(require.resolve('onnxruntime-web'));
const languageNames = {
  zh: 'Chinese',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  es: 'Spanish'
};

let generator;
let activeKey = '';

function post(message) {
  parentPort.postMessage(message);
}

function normalizeLanguage(code) {
  if (!code || code === 'auto') return 'auto';
  return languageNames[code] || code;
}

function buildPrompt(text, sourceLang, targetLang) {
  const source = normalizeLanguage(sourceLang);
  const target = normalizeLanguage(targetLang);
  if (source === 'auto') {
    return `Translate the following segment into ${target}, without additional explanation.\n\n${text}`;
  }
  return `Translate the following segment from ${source} into ${target}, without additional explanation.\n\n${text}`;
}

function hasDirectModelFiles(modelDir) {
  return modelDir && fs.existsSync(path.join(modelDir, 'config.json'));
}

function configureOnnxRuntime(env) {
  env.useWasmCache = false;
  env.backends.onnx.wasm ??= {};
  env.backends.onnx.wasm.wasmPaths = {
    mjs: path.join(onnxRuntimeDist, 'ort-wasm-simd-threaded.asyncify.mjs'),
    wasm: path.join(onnxRuntimeDist, 'ort-wasm-simd-threaded.asyncify.wasm')
  };
}

function getGeneratedText(result) {
  const first = Array.isArray(result) ? result[0] : result;
  const generatedText = first?.generated_text ?? first?.summary_text ?? first?.text ?? first;

  if (typeof generatedText === 'string') return generatedText.trim();
  if (Array.isArray(generatedText)) {
    const last = generatedText[generatedText.length - 1];
    return String(last?.content ?? last?.text ?? '').trim();
  }
  return String(generatedText?.content ?? generatedText?.text ?? '').trim();
}

function isRemoteFetchError(error) {
  const message = error?.message || String(error);
  return message.includes('fetch failed') || Boolean(error?.cause?.code);
}

function toLocalModelError(error, { allowRemote, modelDir }) {
  const rawMessage = error?.message || String(error);
  const causeMessage = error?.cause?.message || '';
  const causeCode = error?.cause?.code || '';

  if (allowRemote && (rawMessage.includes('fetch failed') || causeCode || causeMessage)) {
    const detail = [causeCode, causeMessage].filter(Boolean).join(' ');
    return new Error(`本地模型下载失败：无法连接模型下载源。请检查网络、代理或稍后重试。${detail ? `详情：${detail}` : ''}`);
  }

  if (rawMessage.includes('tokenizer_class')) {
    return new Error('本地模型加载失败：当前模型需要按 text-generation/chat pipeline 加载，请重新下载或选择完整的 local-trans 模型目录。');
  }

  if (!allowRemote) {
    return new Error(`本地模型加载失败：未在所选目录找到完整模型文件或缓存。请先点击“下载并加载”，或选择包含 config.json、tokenizer.json 和 onnx 文件的模型目录。目录：${modelDir || '未选择'}`);
  }

  return new Error(`本地模型下载或加载失败：${rawMessage}`);
}

async function createTextGenerationPipeline(pipeline, modelRef, options, env, allowRemote) {
  try {
    env.remoteHost = process.env.HF_ENDPOINT || (allowRemote ? mirrorRemoteHost : defaultRemoteHost);
    return await pipeline('text-generation', modelRef, options);
  } catch (error) {
    if (!allowRemote || process.env.HF_ENDPOINT || env.remoteHost === mirrorRemoteHost || !isRemoteFetchError(error)) {
      throw error;
    }

    post({ type: 'status', message: '默认下载源连接失败，正在切换镜像源下载模型...' });
    env.remoteHost = mirrorRemoteHost;
    return pipeline('text-generation', modelRef, options);
  }
}

async function loadModel({ modelId = defaultModelId, modelDir, allowRemote }) {
  const { pipeline, env } = await import('@huggingface/transformers');

  env.allowLocalModels = true;
  env.allowRemoteModels = Boolean(allowRemote);
  env.useFSCache = true;
  configureOnnxRuntime(env);
  if (modelDir && !hasDirectModelFiles(modelDir)) env.cacheDir = modelDir;

  const modelKey = `${modelId}|${modelDir || ''}`;
  if (generator && activeKey === modelKey) {
    return { modelId, modelDir, cached: true };
  }

  const modelRef = hasDirectModelFiles(modelDir) ? modelDir : modelId;
  const options = {
    dtype: 'q4',
    device: 'cpu',
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

  try {
    post({ type: 'status', message: allowRemote ? '正在下载并加载本地模型...' : '正在从本地目录加载模型...' });
    generator = await createTextGenerationPipeline(pipeline, modelRef, options, env, allowRemote);
    activeKey = modelKey;
  } catch (error) {
    throw toLocalModelError(error, { allowRemote, modelDir });
  }

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
  const prompt = buildPrompt(trimmed, payload.sourceLang, payload.targetLang);
  const output = await generator([{ role: 'user', content: prompt }], {
    max_new_tokens: 512,
    do_sample: false
  });

  return { translatedText: getGeneratedText(output), provider: 'local' };
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

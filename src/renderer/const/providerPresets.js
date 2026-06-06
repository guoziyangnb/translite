// 常量作用：维护线上官方供应商预设，点击按钮后可自动填充接口地址、路径、默认模型和用量模板。
// 适用场景：添加/编辑线上供应商时快速选择国内官方模型商，以及 GPT、Claude、Gemini 三个国外官方入口。
import {
  createAnthropicStatusScript,
  createMiMoUsageScript,
  createOpenAIStatusScript,
  DEFAULT_USAGE_TEMPLATE_ID,
  getUsageTemplateScript
} from './usageTemplates.js';

const openAIPaths = {
  apiFormat: 'openai',
  modelsPath: '/models',
  chatPath: '/chat/completions'
};

// 生成供应商默认用量配置；不主动启用，用户进入配置页打开开关并保存后才生效。
function createUsagePreset(template = DEFAULT_USAGE_TEMPLATE_ID, overrides = {}) {
  return {
    enabled: false,
    baseUrl: '',
    apiKey: '',
    template,
    timeoutSeconds: '10',
    intervalMinutes: '0',
    script: getUsageTemplateScript(template),
    lastCheckedAt: '',
    lastResult: null,
    lastError: '',
    ...overrides
  };
}

function createOfficialStatusPreset(providerName, template = 'officialStatus') {
  return createUsagePreset(template, {
    script: createOpenAIStatusScript(providerName)
  });
}

function createAnthropicStatusPreset(providerName) {
  return createUsagePreset('anthropicStatus', {
    script: createAnthropicStatusScript(providerName)
  });
}

export const PROVIDER_PRESET_GROUPS = [
  {
    label: '国内官方',
    presets: [
      {
        id: 'deepseek',
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-flash',
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        usageTemplate: 'deepseek',
        usageConfig: createUsagePreset('deepseek')
      },
      {
        id: 'glm',
        name: 'GLM 智谱',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        model: 'glm-4.6',
        models: ['glm-4.6', 'glm-4.5', 'glm-4-plus', 'glm-4-air'],
        usageTemplate: 'zhipuTokenPlan',
        usageConfig: createUsagePreset('zhipuTokenPlan', {
          baseUrl: 'https://open.bigmodel.cn'
        })
      },
      {
        id: 'kimi',
        name: 'Kimi',
        baseUrl: 'https://api.moonshot.cn/v1',
        model: 'kimi-k2.6',
        models: ['kimi-k2.6', 'kimi-k2.5', 'kimi-latest'],
        usageTemplate: 'kimi',
        usageConfig: createUsagePreset('kimi', {
          baseUrl: 'https://api.kimi.com/coding'
        })
      },
      {
        id: 'bailian',
        name: '阿里百炼',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen3-coder-plus',
        models: ['qwen3-coder-plus', 'qwen3-max', 'qwen-plus', 'qwen-max'],
        usageTemplate: 'officialStatus',
        usageConfig: createOfficialStatusPreset('阿里百炼官方接口')
      },
      {
        id: 'qwen',
        name: '通义千问',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-plus',
        models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long'],
        usageTemplate: 'officialStatus',
        usageConfig: createOfficialStatusPreset('通义千问官方接口')
      },
      {
        id: 'doubao-seed',
        name: '豆包 Seed',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        model: 'doubao-seed-2-0-code-preview-latest',
        models: ['doubao-seed-2-0-code-preview-latest'],
        usageTemplate: 'officialStatus',
        usageConfig: createOfficialStatusPreset('豆包 Seed 官方接口')
      },
      {
        id: 'huoshan-agentplan',
        name: '火山 AgentPlan',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
        model: 'ark-code-latest',
        models: ['ark-code-latest'],
        usageTemplate: 'officialStatus',
        usageConfig: createOfficialStatusPreset('火山 AgentPlan 官方接口')
      },
      {
        id: 'doubao',
        name: '豆包',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        model: '',
        models: [],
        usageTemplate: 'officialStatus',
        usageConfig: createOfficialStatusPreset('豆包官方接口')
      },
      {
        id: 'minimax',
        name: 'MiniMax',
        baseUrl: 'https://api.minimaxi.com/v1',
        model: 'MiniMax-M2.7',
        models: ['MiniMax-M2.7', 'abab6.5s-chat', 'abab6.5g-chat'],
        usageTemplate: 'minimaxTokenPlan',
        usageConfig: createUsagePreset('minimaxTokenPlan')
      },
      {
        id: 'mimo',
        name: '小米 MiMo',
        baseUrl: 'https://api.xiaomimimo.com/v1',
        model: 'mimo-v2.5-pro',
        models: ['mimo-v2.5-pro'],
        usageTemplate: 'mimoUsage',
        usageConfig: createUsagePreset('mimoUsage', {
          script: createMiMoUsageScript()
        })
      },
      {
        id: 'mimo-token-plan',
        name: '小米 MiMo Token Plan',
        baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
        model: 'mimo-v2.5-pro',
        models: ['mimo-v2.5-pro', 'mimo-v2.5'],
        usageTemplate: 'mimoTokenPlan',
        usageConfig: createUsagePreset('mimoTokenPlan')
      },
      {
        id: 'stepfun',
        name: '阶跃星辰',
        baseUrl: 'https://api.stepfun.com/v1',
        model: 'step-3.5-flash',
        models: ['step-3.5-flash', 'step-2-mini', 'step-2-16k'],
        usageTemplate: 'stepfun',
        usageConfig: createUsagePreset('stepfun')
      },
      {
        id: 'baichuan',
        name: '百川智能',
        baseUrl: 'https://api.baichuan-ai.com/v1',
        model: 'Baichuan4',
        models: ['Baichuan4', 'Baichuan3-Turbo'],
        usageTemplate: 'officialStatus',
        usageConfig: createOfficialStatusPreset('百川智能官方接口')
      },
      {
        id: 'yi',
        name: '零一万物',
        baseUrl: 'https://api.lingyiwanwu.com/v1',
        model: 'yi-large',
        models: ['yi-large', 'yi-medium', 'yi-spark'],
        usageTemplate: 'officialStatus',
        usageConfig: createOfficialStatusPreset('零一万物官方接口')
      },
      {
        id: 'siliconflow',
        name: '硅基流动',
        baseUrl: 'https://api.siliconflow.cn/v1',
        model: 'deepseek-ai/DeepSeek-V3.2',
        models: ['deepseek-ai/DeepSeek-V3.2', 'Qwen/Qwen3-Coder-480B-A35B-Instruct'],
        usageTemplate: 'siliconflow',
        usageConfig: createUsagePreset('siliconflow')
      },
      {
        id: 'qianfan',
        name: '百度千帆',
        baseUrl: 'https://qianfan.baidubce.com/v2',
        model: 'ernie-4.5-turbo-128k',
        models: ['ernie-4.5-turbo-128k', 'ernie-4.5-turbo-vl-32k'],
        usageTemplate: 'officialStatus',
        usageConfig: createOfficialStatusPreset('百度千帆官方接口')
      },
      {
        id: 'qianfan-coding',
        name: '百度千帆 Coding Plan',
        baseUrl: 'https://qianfan.baidubce.com/v2/coding',
        model: 'qianfan-code-latest',
        models: ['qianfan-code-latest'],
        usageTemplate: 'officialStatus',
        usageConfig: createOfficialStatusPreset('百度千帆 Coding Plan 官方接口')
      },
      {
        id: 'hunyuan',
        name: '腾讯混元',
        baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
        model: 'hunyuan-turbos-latest',
        models: ['hunyuan-turbos-latest', 'hunyuan-lite'],
        usageTemplate: 'officialStatus',
        usageConfig: createOfficialStatusPreset('腾讯混元官方接口')
      },
      {
        id: 'sensenova',
        name: '商汤日日新',
        baseUrl: 'https://api.sensenova.cn/compatible-mode/v1',
        model: '',
        models: [],
        usageTemplate: 'officialStatus',
        usageConfig: createOfficialStatusPreset('商汤日日新官方接口')
      },
      {
        id: 'modelscope',
        name: 'ModelScope',
        baseUrl: 'https://api-inference.modelscope.cn/v1',
        model: 'ZhipuAI/GLM-5.1',
        models: ['ZhipuAI/GLM-5.1', 'Qwen/Qwen3-Coder-480B-A35B-Instruct'],
        usageTemplate: 'officialStatus',
        usageConfig: createOfficialStatusPreset('ModelScope 官方接口')
      },
      {
        id: 'longcat',
        name: 'LongCat',
        baseUrl: 'https://api.longcat.chat/openai/v1',
        model: 'LongCat-Flash-Chat',
        models: ['LongCat-Flash-Chat'],
        usageTemplate: 'officialStatus',
        usageConfig: createOfficialStatusPreset('LongCat 官方接口')
      },
      {
        id: 'bailing',
        name: '百灵',
        baseUrl: 'https://api.tbox.cn/api/llm/v1',
        model: 'Ling-2.5-1T',
        models: ['Ling-2.5-1T'],
        usageTemplate: 'officialStatus',
        usageConfig: createOfficialStatusPreset('百灵官方接口')
      }
    ]
  },
  {
    label: '国外官方',
    presets: [
      {
        id: 'gpt',
        name: 'GPT / OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5-mini',
        models: ['gpt-5-mini', 'gpt-5.2', 'gpt-5.1', 'gpt-4.1-mini'],
        usageTemplate: 'openaiStatus',
        usageConfig: createUsagePreset('openaiStatus')
      },
      {
        id: 'claude',
        name: 'Claude',
        baseUrl: 'https://api.anthropic.com/v1',
        apiFormat: 'anthropic',
        modelsPath: '/models',
        chatPath: '/messages',
        model: 'claude-sonnet-4-6',
        models: ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'],
        usageTemplate: 'anthropicStatus',
        usageConfig: createAnthropicStatusPreset('Claude 官方接口')
      },
      {
        id: 'gemini',
        name: 'Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-2.5-flash',
        models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
        usageTemplate: 'geminiStatus',
        usageConfig: createUsagePreset('geminiStatus')
      }
    ]
  }
];

export const PROVIDER_PRESETS = PROVIDER_PRESET_GROUPS.flatMap((group) => group.presets);

export function findProviderPreset(presetId) {
  return PROVIDER_PRESETS.find((preset) => preset.id === presetId);
}

// 把预设转换成 endpoint 字段；保留用户当前 API Key，避免切换预设时误清空。
export function applyProviderPresetToEndpoint(endpoint, preset) {
  return {
    ...endpoint,
    presetId: preset.id,
    name: preset.name,
    baseUrl: preset.baseUrl,
    apiFormat: preset.apiFormat || openAIPaths.apiFormat,
    modelsPath: preset.modelsPath || openAIPaths.modelsPath,
    chatPath: preset.chatPath || openAIPaths.chatPath,
    model: preset.model || '',
    models: Array.isArray(preset.models) ? [...preset.models] : [],
    usageConfig: {
      ...(preset.usageConfig || createUsagePreset(preset.usageTemplate)),
      enabled: false,
      apiKey: endpoint.usageConfig?.apiKey || '',
      lastCheckedAt: '',
      lastResult: null,
      lastError: ''
    }
  };
}

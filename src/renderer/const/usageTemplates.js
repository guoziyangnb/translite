// 常量作用：集中维护用量查询脚本模板，供应商预设和用量配置页共用同一份模板。
// 适用场景：新增供应商时自动带出默认用量脚本、用户在用量配置页切换模板。

export const DEFAULT_USAGE_TEMPLATE_ID = 'officialStatus';

function toScriptString(value) {
  return JSON.stringify(String(value || '官方接口'));
}

// 生成 OpenAI-compatible 官方状态脚本；只验证 /models 可用，不伪造余额。
export function createOpenAIStatusScript(providerName = '官方接口') {
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
        planName: ${toScriptString(providerName)},
        extra: names.length
          ? "模型接口可用；官方暂未公开余额查询 API。可用模型：" + names.slice(0, 3).join("、")
          : "模型接口可用；官方暂未公开余额查询 API。"
      };
    }
  })`;
}

// 生成 Anthropic 官方状态脚本；Claude 使用 x-api-key 和 anthropic-version 头。
export function createAnthropicStatusScript(providerName = 'Claude 官方接口') {
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
        planName: ${toScriptString(providerName)},
        extra: names.length
          ? "模型接口可用；官方余额需通过控制台查看。可用模型：" + names.slice(0, 3).join("、")
          : "模型接口可用；官方余额需通过控制台查看。"
      };
    }
  })`;
}

// 生成小米 MiMo 官方用量脚本；官方响应的 usage 是本次请求 token 用量，不是账户余额。
export function createMiMoUsageScript() {
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

export const USAGE_TEMPLATES = {
  custom: {
    label: '自定义',
    script: ''
  },
  officialStatus: {
    label: '官方接口状态',
    script: createOpenAIStatusScript('官方接口')
  },
  openaiStatus: {
    label: 'GPT 官方接口',
    script: createOpenAIStatusScript('GPT 官方接口')
  },
  geminiStatus: {
    label: 'Gemini 官方接口',
    script: createOpenAIStatusScript('Gemini 官方接口')
  },
  anthropicStatus: {
    label: 'Claude 官方接口',
    script: createAnthropicStatusScript('Claude 官方接口')
  },
  mimoUsage: {
    label: '小米 MiMo 用量',
    script: createMiMoUsageScript()
  },
  general: {
    label: '通用模板',
    script: `({
    request: {
      url: "{{baseUrl}}/v1/usage",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      const remaining = response?.remaining ?? response?.quota?.remaining ?? response?.balance;
      const unit = response?.unit ?? response?.quota?.unit ?? "CNY";
      return {
        isValid: response?.is_active ?? response?.isValid ?? true,
        remaining,
        unit
      };
    }
  })`
  },
  newapi: {
    label: 'NewAPI',
    script: `({
    request: {
      url: "{{baseUrl}}/api/user/self",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      const data = response?.data ?? response;
      return {
        isValid: !response?.error,
        remaining: data?.quota ?? data?.balance,
        used: data?.used_quota,
        unit: "CNY"
      };
    }
  })`
  },
  tokenPlan: {
    label: 'Token Plan',
    script: `({
    request: {
      url: "{{baseUrl}}/v1/dashboard/billing/usage",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      return {
        isValid: !response?.error,
        total: response?.total_granted,
        used: response?.total_used,
        remaining: response?.total_available,
        unit: "USD"
      };
    }
  })`
  },
  official: {
    label: '官方',
    script: `({
    request: {
      url: "{{baseUrl}}/v1/usage",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      return {
        isValid: !response?.error,
        remaining: response?.balance ?? response?.remaining,
        unit: response?.unit ?? "USD"
      };
    }
  })`
  },
  deepseek: {
    label: 'DeepSeek',
    script: `({
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
  })`
  },
  kimi: {
    label: 'Kimi',
    script: `({
    request: {
      url: "{{baseUrl}}/v1/usages",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      const limits = Array.isArray(response?.limits) ? response.limits : [];
      const fiveHour = limits
        .map((item) => item?.detail || item)
        .find((item) => item?.limit !== undefined || item?.remaining !== undefined);
      const weekly = response?.usage || {};
      const limit = Number(fiveHour?.limit);
      const remainingCount = Number(fiveHour?.remaining);
      const remaining = Number.isFinite(limit) && limit > 0 && Number.isFinite(remainingCount)
        ? Math.max(0, (remainingCount / limit) * 100).toFixed(1)
        : undefined;
      const weeklyLimit = Number(weekly?.limit);
      const weeklyRemaining = Number(weekly?.remaining);
      const weeklyText = Number.isFinite(weeklyLimit) && weeklyLimit > 0 && Number.isFinite(weeklyRemaining)
        ? "周剩余：" + Math.max(0, (weeklyRemaining / weeklyLimit) * 100).toFixed(1) + "%"
        : "";
      return {
        isValid: !response?.error,
        remaining,
        unit: "%",
        planName: "Kimi Coding Plan",
        extra: weeklyText
      };
    }
  })`
  },
  zhipuTokenPlan: {
    label: '智谱 Token Plan',
    script: `({
    request: {
      url: "{{baseUrl}}/api/monitor/usage/quota/limit",
      method: "GET",
      headers: {
        "Authorization": "{{apiKey}}",
        "Content-Type": "application/json",
        "Accept-Language": "en-US,en"
      }
    },
    extractor: function(response) {
      const data = response?.data ?? {};
      const limits = Array.isArray(data.limits) ? data.limits : [];
      const tokenLimits = limits
        .filter((item) => String(item?.type || "").toLowerCase() === "tokens_limit")
        .map((item) => ({
          percentage: Number(item?.percentage) || 0,
          nextResetTime: Number(item?.nextResetTime) || 0
        }));
      const fiveHour = tokenLimits[0];
      const weekly = tokenLimits[1];
      const remaining = fiveHour ? Math.max(0, 100 - fiveHour.percentage) : undefined;
      return {
        isValid: response?.success !== false,
        remaining,
        unit: "%",
        planName: data?.level || "GLM Token Plan",
        extra: weekly ? "周剩余：" + Math.max(0, 100 - weekly.percentage) + "%" : ""
      };
    }
  })`
  },
  minimaxTokenPlan: {
    label: 'MiniMax Token Plan',
    script: `({
    request: {
      url: "{{baseUrl}}/api/openplatform/coding_plan/remains",
      method: "GET",
      headers: {
        "Authorization": "Bearer {{apiKey}}",
        "Content-Type": "application/json"
      }
    },
    extractor: function(response) {
      const remains = Array.isArray(response?.model_remains) ? response.model_remains : [];
      const general = remains.find((item) => item?.model_name === "general") || {};
      const fiveHour = general.current_interval_remaining_percent;
      const weekly = general.current_weekly_status === 1
        ? general.current_weekly_remaining_percent
        : undefined;
      return {
        isValid: response?.base_resp?.status_code === undefined || response.base_resp.status_code === 0,
        remaining: fiveHour,
        unit: "%",
        planName: "MiniMax Token Plan",
        extra: weekly === undefined ? "" : "周剩余：" + weekly + "%"
      };
    }
  })`
  },
  mimoTokenPlan: {
    label: 'MiMo Token Plan',
    script: `({
    request: {
      url: "{{baseUrl}}/models",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      const models = Array.isArray(response?.data) ? response.data : [];
      return {
        isValid: true,
        planName: "MiMo Token Plan",
        extra: models.length
          ? "模型接口可用；官方暂未公开余额查询 API。可用模型：" + models.map((item) => typeof item === "string" ? item : item.id || item.name).filter(Boolean).slice(0, 3).join("、")
          : "模型接口可用；官方暂未公开余额查询 API。"
      };
    }
  })`
  },
  stepfun: {
    label: 'StepFun',
    script: `({
    request: {
      url: "{{baseUrl}}/accounts",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      return {
        isValid: true,
        remaining: response?.balance,
        total: response?.total_cash_balance,
        extra: response?.type ? "账户类型：" + response.type : "",
        unit: "CNY"
      };
    }
  })`
  },
  siliconflow: {
    label: 'SiliconFlow',
    script: `({
    request: {
      url: "{{baseUrl}}/user/info",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      const data = response?.data ?? response;
      return {
        isValid: data?.status === undefined ? true : Boolean(data.status),
        remaining: data?.totalBalance ?? data?.balance ?? data?.chargeBalance,
        unit: "CNY"
      };
    }
  })`
  }
};

export const USAGE_TEMPLATE_OPTIONS = Object.entries(USAGE_TEMPLATES).map(([value, template]) => ({
  label: template.label,
  value
}));

// 根据模板 id 返回脚本；未知模板回退到通用模板，避免页面出现空脚本。
export function getUsageTemplateScript(templateId = DEFAULT_USAGE_TEMPLATE_ID) {
  return USAGE_TEMPLATES[templateId]?.script || USAGE_TEMPLATES[DEFAULT_USAGE_TEMPLATE_ID].script;
}

// 旧配置可能保存了已删除或手输的模板 id，这里统一归一化。
export function resolveUsageTemplateId(templateId = DEFAULT_USAGE_TEMPLATE_ID) {
  return USAGE_TEMPLATES[templateId] ? templateId : DEFAULT_USAGE_TEMPLATE_ID;
}

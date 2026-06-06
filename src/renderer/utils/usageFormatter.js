// 工具作用：统一格式化用量查询结果，避免不同页面各自拼接出不准确的余额文案。
// 适用场景：供应商列表、用量配置页、Message 提示中展示 extractor 返回的用量结果。

const EMPTY_REMAINING_VALUES = new Set(['-', '--', '—', 'n/a', 'na', 'null', 'undefined']);

// 将 extractor 返回的余额字段归一化，过滤掉 “-” 这类占位符，避免被误判为有效余额。
export function getUsageRemainingValue(result) {
  const remaining = result?.remaining ?? result?.balance;
  if (remaining === undefined || remaining === null) return null;
  if (typeof remaining === 'number') return Number.isFinite(remaining) ? remaining : null;

  const text = String(remaining).trim();
  if (!text || EMPTY_REMAINING_VALUES.has(text.toLowerCase())) return null;
  if (!/\d/.test(text)) return null;
  return text;
}

// 判断 extractor 是否返回了可展示的余额字段；0 是有效余额，不能被当成空值。
export function hasUsageRemaining(result) {
  return getUsageRemainingValue(result) !== null;
}

// 判断 extractor 是否返回了非余额类数值，例如 MiMo 官方响应里的本次请求 token 用量。
export function hasUsageMetric(result) {
  if (!result?.metricLabel) return false;
  const value = result.used ?? result.total;
  if (value === undefined || value === null) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  const text = String(value).trim();
  return Boolean(text) && !EMPTY_REMAINING_VALUES.has(text.toLowerCase());
}

// 某些官方接口只能确认套餐/模型接口可用，没有公开余额字段；这些仍然是有效状态信息。
export function hasUsageStatus(result) {
  return hasUsageRemaining(result) || hasUsageMetric(result) || Boolean(result?.planName || result?.extra);
}

// 格式化剩余额度，缺少 remaining/balance 时给出明确提示，避免显示“剩余 -CNY”。
export function formatUsageRemaining(result) {
  const remaining = getUsageRemainingValue(result);
  if (remaining === null) return '未提取到剩余额度';

  const unit = String(result?.unit || 'CNY').trim();
  const remainingText = String(remaining);
  if (!unit || remainingText.toLowerCase().endsWith(unit.toLowerCase())) return remainingText;
  if (unit === '%' && remainingText.endsWith('%')) return remainingText;
  return `${remainingText}${unit}`;
}

// 格式化非余额类用量指标；例如“本次请求用量：129tokens”。
export function formatUsageMetric(result) {
  if (!hasUsageMetric(result)) return '';
  const label = String(result.metricLabel || '用量').trim();
  const value = String(result.used ?? result.total).trim();
  const unit = String(result.unit || '').trim();
  const text = unit && !value.toLowerCase().endsWith(unit.toLowerCase()) ? `${value}${unit}` : value;
  return `${label}：${text}`;
}

// 格式化用量状态的补充信息，用于官方套餐、周限额等非余额字段。
export function formatUsageExtra(result) {
  return [result?.planName, result?.extra].filter(Boolean).join(' · ');
}

// 用于 Message 的短文案：优先显示余额，其次显示官方状态信息。
export function formatUsageMessage(result) {
  if (hasUsageRemaining(result)) return `剩余 ${formatUsageRemaining(result)}`;
  if (hasUsageMetric(result)) return formatUsageMetric(result);
  return formatUsageExtra(result) || '未提取到剩余额度';
}

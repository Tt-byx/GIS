/**
 * 分级断点计算（FR-M3-02 处理规则 2；任务 T-045）。
 *
 * 唯一版本：
 * 1. 样本数 ≥ 5：自然断点法（Jenks）分 5 级；
 * 2. 样本数 < 5：等间距分 5 级；
 * 3. 返回断点长度恒为 6（首尾为 min/max），图例据此渲染 5 个数值区间。
 */

/** 分级数（FR-M3-02 处理规则 2：5 级） */
export const CLASS_BREAK_LEVELS = 5

/**
 * 等间距断点（样本 < 5 时的降级路径）。
 * @param {number[]} values 有效样本
 * @returns {number[]} 长度 6 的严格递增断点
 */
export function equalIntervalBreaks(values) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const levels = CLASS_BREAK_LEVELS
  const breaks = []
  for (let i = 0; i <= levels; i += 1) {
    breaks.push(min + ((max - min) * i) / levels)
  }
  return breaks
}

/**
 * 自然断点法（Jenks/Fisher-Jenks）。
 * 动态规划求组内方差和（SDC）最小的 5 分组；n 较小时（街道数 ≤ 200）复杂度可接受。
 * @param {number[]} values 样本（升序内部处理）
 * @returns {number[]} 长度 6 的断点（首=min，尾=max）
 */
export function jenksBreaks(values) {
  const n = values.length
  const k = CLASS_BREAK_LEVELS
  const sorted = [...values].sort((a, b) => a - b)

  // S[i][j]：前 i 个样本分 j 组的最小方差和；D[v][m]：候选断点累计方差
  const S = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(Infinity))
  const D = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0))
  for (let i = 1; i <= n; i += 1) {
    S[i][1] = sumSquaredDeviation(sorted, 0, i - 1)
  }
  for (let j = 2; j <= k; j += 1) {
    for (let i = j; i <= n; i += 1) {
      S[i][j] = Infinity
      for (let m = j - 1; m <= i - 1; m += 1) {
        const cost = S[m][j - 1] + sumSquaredDeviation(sorted, m, i - 1)
        if (cost < S[i][j]) {
          S[i][j] = cost
          D[i][j] = m
        }
      }
    }
  }

  // 回溯断点
  const cuts = []
  let i = n
  for (let j = k; j >= 2; j -= 1) {
    cuts.unshift(sorted[D[i][j] - 1])
    i = D[i][j]
  }
  return [sorted[0], ...cuts, sorted[n - 1]]
}

/** 闭区间 [from, to] 的组内平方偏差和 */
function sumSquaredDeviation(sorted, from, to) {
  let sum = 0
  let sumSq = 0
  for (let v = from; v <= to; v += 1) {
    sum += sorted[v]
    sumSq += sorted[v] * sorted[v]
  }
  const count = to - from + 1
  return sumSq - (sum * sum) / count
}

/**
 * 计算 5 级断点（FR-M3-02 处理规则 2 的唯一入口）。
 * null 值（分母为 0，A-23）不参与分级计算。
 * @param {number[]} values 指标样本（可含 null）
 * @returns {number[]} 长度 6、严格递增断点；样本为空时返回 null
 */
export function calcClassBreaks(values) {
  const valid = (values || []).filter((v) => typeof v === 'number' && Number.isFinite(v))
  if (valid.length === 0) {
    return null
  }
  const uniqueCount = new Set(valid).size
  // 全部样本相同或样本数不足以分组时，退化为等间距（数值上仍是 min..max 的 6 断点）
  if (valid.length < CLASS_BREAK_LEVELS || uniqueCount === 1) {
    return equalIntervalBreaks(valid)
  }
  return jenksBreaks(valid)
}

/**
 * 把数值落到断点区间，返回 1–5 的级别（与 API-06 level 语义一致）。
 * 区间为左闭右开：[b0,b1)→1，[b1,b2)→2，…，最大值兜底为 5。
 * @param {number} value 指标值
 * @param {number[]} breaks 长度 6 的断点
 * @returns {number} 1–5
 */
export function levelOf(value, breaks) {
  for (let level = 1; level <= CLASS_BREAK_LEVELS; level += 1) {
    if (value < breaks[level]) {
      return level
    }
  }
  return CLASS_BREAK_LEVELS
}

/**
 * 覆盖率统计模块（T-050 / FR-M4-05）
 * 依据：SPEC/01-requirements.md FR-M4-05
 */

/**
 * 设施中类判定阈值映射表（FR-M4-05 规则 2，强制约束，禁止自定义）
 */
export const CATEGORY_THRESHOLD_RULES = {
  // 5 分钟
  KIN: { threshold: 5, mode: 'WALK', name: '幼儿园' },
  CHS: { threshold: 5, mode: 'WALK', name: '社区卫生服务站' },
  STA: { threshold: 5, mode: 'WALK', name: '社区服务站' },
  // 10 分钟
  PRI: { threshold: 10, mode: 'WALK', name: '小学' },
  CCC: { threshold: 10, mode: 'WALK', name: '文化馆站' },
  // 15 分钟（步行）
  CHC: { threshold: 15, mode: 'WALK', name: '社区卫生服务中心' },
  NUR: { threshold: 15, mode: 'WALK', name: '养老院' },
  JUN: { threshold: 15, mode: 'WALK', name: '初中' },
  SEN: { threshold: 15, mode: 'WALK', name: '高中' },
  STD: { threshold: 15, mode: 'WALK', name: '体育场馆' },
  FIT: { threshold: 15, mode: 'WALK', name: '全民健身中心' },
  // 15 分钟（车行）
  HGE: { threshold: 15, mode: 'DRIVE', name: '综合医院' },
  HSP: { threshold: 15, mode: 'DRIVE', name: '专科医院' },
  HTM: { threshold: 15, mode: 'DRIVE', name: '中医医院' },
  MUS: { threshold: 15, mode: 'DRIVE', name: '博物馆' },
}

/**
 * 格式化覆盖率为 3 位小数（FR-M4-05 规则 4）
 * @param {number} rate
 * @returns {number}
 */
export function formatCoverageRate(rate) {
  if (!Number.isFinite(rate)) return 0
  const clamped = Math.min(Math.max(rate, 0), 1)
  return Number(clamped.toFixed(3))
}

/**
 * 构建街道级覆盖率统计报表
 * @param {object} params
 * @param {string} params.categoryL2 设施中类编码
 * @param {Array<object>} params.streetStats 街道统计原始数据集合
 *   [{ streetName, totalCommunities, coveredCommunities, targetRate = 0.8 }]
 * @returns {Array<object>} 规范化后的表格行
 *   [{ streetName, categoryL2, coverageRate, qualified, shortfallCount }]
 */
export function buildCoverageReport({ categoryL2, streetStats = [] } = {}) {
  const rule = CATEGORY_THRESHOLD_RULES[categoryL2] || { threshold: 15, mode: 'WALK' }

  return streetStats.map((item) => {
    const total = Number(item.totalCommunities ?? item.total ?? 0)
    const covered = Number(item.coveredCommunities ?? item.covered ?? 0)
    const rawRate = total > 0 ? covered / total : 0
    const coverageRate = formatCoverageRate(rawRate)

    // 达标判定：若有预设 targetRate 则对比，默认标准为 coverageRate >= 0.85 或 100% 覆盖
    const targetRate = item.targetRate ?? 0.8
    // FR-M4-05 规则 3/验收标准 AC-M4-05-2: 严格为布尔值 true/false
    const qualified = Boolean(coverageRate >= targetRate)

    const shortfallCount = Math.max(0, total - covered)

    return {
      streetName: String(item.streetName || item.street || '未知街道'),
      categoryL2,
      coverageRate,
      qualified,
      shortfallCount,
      thresholdMinutes: rule.threshold,
      travelMode: rule.mode,
    }
  })
}

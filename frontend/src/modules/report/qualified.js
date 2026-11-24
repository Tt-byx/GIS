/**
 * 达标率矩阵表模块（T-052 / FR-M5-03）
 * 依据：SPEC/01-requirements.md FR-M5-03
 */
import { CATEGORY_ORDER, CATEGORY_SYMBOLS } from '@/config/symbols'

/** 警示色标记（FR-M5-03 规则 2 / AC-M5-03-2） */
export const ALERT_COLOR = '#E05252'

/** 默认达标率阈值 */
export const DEFAULT_QUALIFIED_THRESHOLD = 0.8

/**
 * 构建达标率矩阵
 * @param {object} param
 * @param {Array<string>} param.units 统计单元名称列表 ['单元1', '单元2']
 * @param {Array<string>} [param.categories] 设施类别编码列表，默认五大类
 * @param {Array<object>} param.matrixData 原始矩阵数据 [{ unit: '单元1', EDU: 0.85, MED: 0.65, ... }]
 * @param {number} [param.targetRate=0.8] 达标阈值
 * @returns {object} { columns, rows }
 */
export function buildQualifiedMatrix({
  units = [],
  categories = CATEGORY_ORDER,
  matrixData = [],
  targetRate = DEFAULT_QUALIFIED_THRESHOLD,
} = {}) {
  const columns = [
    { key: 'unitName', label: '统计单元' },
    ...categories.map((cat) => ({
      key: cat,
      label: CATEGORY_SYMBOLS[cat]?.l1Name || cat,
      categoryCode: cat,
    })),
  ]

  const rows = units.map((unitName) => {
    const rawRow =
      matrixData.find((d) => d.unit === unitName || d.unitName === unitName) || {}

    const rowObj = { unitName, cells: {} }

    categories.forEach((cat) => {
      const val = rawRow[cat]
      if (val === undefined || val === null || val === '未覆盖') {
        rowObj.cells[cat] = {
          value: null,
          text: '未覆盖',
          qualified: false,
          isAlert: true,
          alertColor: ALERT_COLOR,
        }
      } else {
        const numRate = Number(val)
        const rateFormatted = (numRate * 100).toFixed(1) + '%'
        const isQualified = numRate >= targetRate
        rowObj.cells[cat] = {
          value: numRate,
          text: rateFormatted,
          qualified: isQualified,
          isAlert: !isQualified,
          alertColor: !isQualified ? ALERT_COLOR : 'transparent',
        }
      }
    })

    return rowObj
  })

  return { columns, rows }
}

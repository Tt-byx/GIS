/**
 * CHK-TEST-M5-03 · FR-M5-03 达标率矩阵表测试
 * 依据：SPEC/01-requirements.md FR-M5-03, SPEC/06-testing.md CHK-TEST-M5-03
 */
import { describe, it, expect } from 'vitest'
import { buildQualifiedMatrix, ALERT_COLOR } from '../qualified'

describe('FR-M5-03 达标率矩阵表', () => {
  it('AC-M5-03-1: 行数 = 统计单元数，列数 = 统计单元列 + 设施类别数', () => {
    const units = ['红钢城街道', '新沟桥街道', '青山镇街道']
    const categories = ['EDU', 'MED', 'CUL', 'WEL', 'COM']
    const matrixData = [
      { unit: '红钢城街道', EDU: 0.9, MED: 0.85, CUL: 0.7, WEL: 0.8, COM: 0.95 },
      { unit: '新沟桥街道', EDU: 0.85, MED: 0.75, CUL: 0.8, WEL: 0.8, COM: 0.8 },
      { unit: '青山镇街道', EDU: 0.6, MED: '未覆盖', CUL: 0.5, WEL: 0.6, COM: 0.7 },
    ]

    const matrix = buildQualifiedMatrix({ units, categories, matrixData })
    expect(matrix.rows.length).toBe(3)
    // 单元列 + 5 类别列 = 6 列
    expect(matrix.columns.length).toBe(6)
  })

  it('AC-M5-03-2: 未达标单元格使用警示色 #E05252 底纹标记', () => {
    const units = ['青山镇街道']
    const categories = ['MED', 'EDU']
    const matrixData = [
      { unit: '青山镇街道', MED: 0.65, EDU: 0.95 }, // 设定 0.8 达标，0.65 未达标
    ]

    const matrix = buildQualifiedMatrix({ units, categories, matrixData, targetRate: 0.8 })
    const row = matrix.rows[0]

    expect(row.cells.MED.qualified).toBe(false)
    expect(row.cells.MED.isAlert).toBe(true)
    expect(row.cells.MED.alertColor).toBe(ALERT_COLOR)
    expect(ALERT_COLOR).toBe('#E05252')

    expect(row.cells.EDU.qualified).toBe(true)
    expect(row.cells.EDU.isAlert).toBe(false)
  })
})

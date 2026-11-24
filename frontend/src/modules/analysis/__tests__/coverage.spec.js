/**
 * CHK-TEST-M4-05 · FR-M4-05 覆盖率统计测试
 * 依据：SPEC/01-requirements.md FR-M4-05, SPEC/06-testing.md CHK-TEST-M4-05
 */
import { describe, it, expect } from 'vitest'
import {
  buildCoverageReport,
  CATEGORY_THRESHOLD_RULES,
  formatCoverageRate,
} from '../coverage'

describe('FR-M4-05 覆盖率统计', () => {
  it('AC-M4-05-1: 统计 CHC 时，表格行数 = 街道数', () => {
    const streets = [
      { streetName: '红钢城街道', total: 20, covered: 18 },
      { streetName: '新沟桥街道', total: 15, covered: 12 },
      { streetName: '青山镇街道', total: 10, covered: 5 },
    ]

    const report = buildCoverageReport({ categoryL2: 'CHC', streetStats: streets })
    expect(report.length).toBe(3)
    expect(report[0].streetName).toBe('红钢城街道')
    expect(report[1].streetName).toBe('新沟桥街道')
    expect(report[2].streetName).toBe('青山镇街道')
  })

  it('AC-M4-05-2: 检查达标列仅为 true/false 两个布尔值，无“部分达标”或模糊判定', () => {
    const streets = [
      { streetName: '街道A', total: 100, covered: 90, targetRate: 0.8 }, // 达标 (0.9 >= 0.8)
      { streetName: '街道B', total: 100, covered: 75, targetRate: 0.8 }, // 未达标 (0.75 < 0.8)
    ]

    const report = buildCoverageReport({ categoryL2: 'CHC', streetStats: streets })
    expect(report[0].qualified).toBe(true)
    expect(report[1].qualified).toBe(false)
    expect(typeof report[0].qualified).toBe('boolean')
    expect(typeof report[1].qualified).toBe('boolean')
  })

  it('AC-M4-05-3: 覆盖率全部 ∈ [0, 1]，保留 3 位小数', () => {
    const streets = [
      { streetName: '街道A', total: 300, covered: 219 }, // 219/300 = 0.730
      { streetName: '街道B', total: 27, covered: 19 },   // 19/27 ≈ 0.7037... -> 0.704
    ]

    const report = buildCoverageReport({ categoryL2: 'KIN', streetStats: streets })
    report.forEach((row) => {
      expect(row.coverageRate).toBeGreaterThanOrEqual(0)
      expect(row.coverageRate).toBeLessThanOrEqual(1)
      const decimalPart = String(row.coverageRate).split('.')[1] || ''
      expect(decimalPart.length).toBeLessThanOrEqual(3)
    })
    expect(report[1].coverageRate).toBe(0.704)
  })

  it('严格对齐规范阈值表（KIN=5分, PRI=10分, CHC=15分步行, HGE=15分车行）', () => {
    expect(CATEGORY_THRESHOLD_RULES.KIN.threshold).toBe(5)
    expect(CATEGORY_THRESHOLD_RULES.PRI.threshold).toBe(10)
    expect(CATEGORY_THRESHOLD_RULES.CHC.threshold).toBe(15)
    expect(CATEGORY_THRESHOLD_RULES.CHC.mode).toBe('WALK')
    expect(CATEGORY_THRESHOLD_RULES.HGE.threshold).toBe(15)
    expect(CATEGORY_THRESHOLD_RULES.HGE.mode).toBe('DRIVE')
  })
})

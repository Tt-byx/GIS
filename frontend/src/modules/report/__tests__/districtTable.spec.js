/**
 * CHK-TEST-M5-01 · FR-M5-01 分区统计表测试
 * 依据：SPEC/01-requirements.md FR-M5-01, SPEC/06-testing.md CHK-TEST-M5-01
 */
import { describe, it, expect } from 'vitest'
import {
  buildDistrictTableRows,
  sortDistrictTable,
  filterDistrictTable,
  DISTRICT_TABLE_COLUMNS,
} from '../districtTable'

describe('FR-M5-01 分区统计表', () => {
  it('AC-M5-01-1: 表格列定义与规范完全一致（单元名称、设施数、设施密度、常住人口、每万人设施数）', () => {
    const keys = DISTRICT_TABLE_COLUMNS.map((c) => c.key)
    expect(keys).toEqual([
      'unitName',
      'facilityCount',
      'facilityDensity',
      'population',
      'perCapita',
    ])
    expect(DISTRICT_TABLE_COLUMNS.length).toBe(5)
  })

  it('AC-M5-01-2 & DoD 2: 人口为 0 或缺失时显示“—”，绝无 Infinity、NaN 或 null 字样', () => {
    const rawList = [
      { unitName: '正常街道', facCount: 15, areaKm2: 5, popTotal: 30000 },
      { unitName: '无人街道', facCount: 8, areaKm2: 4, popTotal: 0 },
      { unitName: '缺人街道', facCount: 5, areaKm2: 2, popTotal: null },
    ]

    const rows = buildDistrictTableRows(rawList)
    const zeroPopRow = rows.find((r) => r.unitName === '无人街道')
    const nullPopRow = rows.find((r) => r.unitName === '缺人街道')

    expect(zeroPopRow.perCapitaDisplay).toBe('—')
    expect(nullPopRow.perCapitaDisplay).toBe('—')

    // 扫描全部展示文本，验证绝无非法字样
    rows.forEach((r) => {
      const text = JSON.stringify(r)
      expect(text).not.toContain('Infinity')
      expect(text).not.toContain('NaN')
    })
  })

  it('AC-M5-01-3: 按“设施数”列排序时按数值大小排序（非字典序）', () => {
    const rawList = [
      { unitName: '街道A', facCount: 9 },
      { unitName: '街道B', facCount: 105 },
      { unitName: '街道C', facCount: 22 },
    ]

    const rows = buildDistrictTableRows(rawList)
    const ascSorted = sortDistrictTable(rows, 'facilityCount', 'asc')
    expect(ascSorted.map((r) => r.facilityCount)).toEqual([9, 22, 105])

    const descSorted = sortDistrictTable(rows, 'facilityCount', 'desc')
    expect(descSorted.map((r) => r.facilityCount)).toEqual([105, 22, 9])
  })

  it('支持按行政区筛选街道数据 (FR-M5-01 规则 4)', () => {
    const rawList = [
      { unitName: '红钢城', districtCode: '420107' },
      { unitName: '关山', districtCode: '420111' },
    ]

    const rows = buildDistrictTableRows(rawList)
    const filtered = filterDistrictTable(rows, '420107')
    expect(filtered.length).toBe(1)
    expect(filtered[0].unitName).toBe('红钢城')
  })
})

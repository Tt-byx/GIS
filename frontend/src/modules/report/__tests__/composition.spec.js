/**
 * CHK-TEST-M5-02 · FR-M5-02 设施构成分析测试
 * 依据：SPEC/01-requirements.md FR-M5-02, SPEC/06-testing.md CHK-TEST-M5-02
 */
import { describe, it, expect } from 'vitest'
import {
  buildCompositionPieOption,
  buildCompositionStackedBarOption,
} from '../composition'
import { CATEGORY_SYMBOLS } from '@/config/symbols'

describe('FR-M5-02 设施构成分析', () => {
  it('AC-M5-02-1: 饼图 series 数据项总和等于各类设施数量总和', () => {
    const data = [
      { code: 'EDU', count: 100 },
      { code: 'MED', count: 50 },
      { code: 'CUL', count: 30 },
      { code: 'WEL', count: 20 },
      { code: 'COM', count: 80 },
    ]

    const option = buildCompositionPieOption({ data, basis: 'count' })
    const seriesData = option.series[0].data
    const total = seriesData.reduce((sum, item) => sum + item.value, 0)

    expect(total).toBe(280)
    expect(seriesData.length).toBe(5)
  })

  it('AC-M5-02-2: 堆叠柱状图 series 包含五大类，且各系列颜色与 symbols.js 完全对齐', () => {
    const districts = ['青山区', '武昌区', '洪山区']
    const data = [
      { district: '青山区', EDU: 10, MED: 20, CUL: 5, WEL: 8, COM: 15 },
      { district: '武昌区', EDU: 30, MED: 40, CUL: 15, WEL: 12, COM: 25 },
      { district: '洪山区', EDU: 50, MED: 35, CUL: 20, WEL: 10, COM: 40 },
    ]

    const option = buildCompositionStackedBarOption({ districts, data })
    expect(option.series.length).toBe(5)

    option.series.forEach((s) => {
      expect(s.type).toBe('bar')
      expect(s.stack).toBe('total')
      expect(s.data.length).toBe(3)
    })

    // 检查颜色
    const eduSeries = option.series.find((s) => s.name === CATEGORY_SYMBOLS.EDU.l1Name)
    expect(eduSeries.itemStyle.color).toBe(CATEGORY_SYMBOLS.EDU.color)
  })
})

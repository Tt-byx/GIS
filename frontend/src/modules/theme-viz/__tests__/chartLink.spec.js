/**
 * CHK-TEST-M3-05 · FR-M3-05 统计图表联动（3 断言，对应 AC-M3-05-1..3）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { fetchDistrictStatsMock, getMapMock } = vi.hoisted(() => ({
  fetchDistrictStatsMock: vi.fn(),
  getMapMock: vi.fn(),
}))

vi.mock('@/api/stats', () => ({ fetchDistrictStats: fetchDistrictStatsMock }))

vi.mock('@/core/mapInstance', () => ({
  getMap: getMapMock,
  setMap: vi.fn(),
  isMapReady: vi.fn(() => true),
}))

import {
  loadChartData,
  resetChartDataCache,
  buildPieOption,
  buildBarOption,
  highlightCategory,
  locateDistrict,
  DIMMED_OPACITY,
  CHART_HEIGHT_PX,
} from '../index'
import { registerLayer, removeFromMap } from '@/core/layerRegistry'
import { eventBus, EVENTS } from '@/core/eventBus'
import { CATEGORY_SYMBOLS } from '@/config/symbols'

const CATEGORY_CODES = ['EDU', 'MED', 'CUL', 'WEL', 'COM']

function districtStats(categoryL1, facCount) {
  return {
    level: 'district',
    metric: 'count',
    unit: '个',
    dataDate: '2026-11-05',
    list: [
      { unitCode: '420111', unitName: '洪山区', value: facCount, popTotal: 1406000, facCount },
      { unitCode: '420106', unitName: '武昌区', value: Math.round(facCount / 2), popTotal: 1097000, facCount: Math.round(facCount / 2) },
      { unitCode: '420105', unitName: '汉阳区', value: Math.round(facCount / 3), popTotal: 837000, facCount: Math.round(facCount / 3) },
    ],
  }
}

describe('FR-M3-05 统计图表联动', () => {
  beforeEach(() => {
    resetChartDataCache()
    fetchDistrictStatsMock.mockReset()
    getMapMock.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-M3-05-3：数据来自 API-04 且仅请求 1 次（重复调用命中缓存）', async () => {
    // 五类各 1 次 + ALL 1 次 = 6 次底层请求，但对外 loadChartData 只暴露一次语义；
    // 关键契约：上层组件第二次调用不再发任何网络请求
    fetchDistrictStatsMock.mockImplementation(({ categoryL1 }) =>
      districtStats(categoryL1, { EDU: 120, MED: 90, CUL: 60, WEL: 40, COM: 50, ALL: 360 }[categoryL1] || 0))

    await loadChartData()
    const callsAfterFirst = fetchDistrictStatsMock.mock.calls.length
    const second = await loadChartData()

    expect(callsAfterFirst).toBe(6)
    expect(fetchDistrictStatsMock.mock.calls.length).toBe(callsAfterFirst)
    // 数据结构：饼图 5 项配色与 symbols.js 一致（AC-M3-05-2 联合断言）
    expect(second.pie.map((item) => item.color)).toEqual(CATEGORY_CODES.map((code) => CATEGORY_SYMBOLS[code].color))
    expect(second.bar).toHaveLength(3)
  })

  it('AC-M3-05-1：点击扇区后该类高亮、其余透明度 ≤ 0.3；再次点击恢复', () => {
    const layers = {}
    for (const code of CATEGORY_CODES) {
      layers[code] = { setOpacity: vi.fn(), options: { opacity: 1 } }
      registerLayer(`category-${code}`, layers[code])
    }
    getMapMock.mockReturnValue({ hasLayer: vi.fn(() => true), removeLayer: vi.fn() })
    const visibilityEvents = []
    const onVisibility = (payload) => visibilityEvents.push(payload)
    eventBus.on(EVENTS.LAYER_VISIBILITYCHANGE, onVisibility)

    // 点击"教育"扇区
    const first = highlightCategory('EDU')
    expect(first.highlighted).toBe('EDU')
    expect(layers.EDU.setOpacity).toHaveBeenCalledWith(1)
    for (const code of ['MED', 'CUL', 'WEL', 'COM']) {
      const calls = layers[code].setOpacity.mock.calls.map((call) => call[0])
      const minOpacity = Math.min(...calls)
      expect(minOpacity).toBeLessThanOrEqual(0.3)
      expect(minOpacity).toBe(DIMMED_OPACITY)
    }
    // 图层树状态同步（AR-18）
    expect(visibilityEvents.some((event) => event.layerId === 'EDU' && event.visible === true)).toBe(true)

    // 再次点击同类别 → 取消高亮，全部恢复不透明
    const second = highlightCategory('EDU')
    expect(second.highlighted).toBeNull()
    for (const code of CATEGORY_CODES) {
      const calls = layers[code].setOpacity.mock.calls.map((call) => call[0])
      expect(calls[calls.length - 1]).toBe(1)
    }

    eventBus.off(EVENTS.LAYER_VISIBILITYCHANGE, onVisibility)
    for (const code of CATEGORY_CODES) {
      removeFromMap(`category-${code}`)
    }
  })

  it('饼图/柱状 option 配色与 symbols.js 一致，柱图点击定位到该区', () => {
    const pie = CATEGORY_CODES.map((code) => ({
      code,
      name: CATEGORY_SYMBOLS[code].l1Name,
      value: 10,
      color: CATEGORY_SYMBOLS[code].color,
    }))
    const pieOption = buildPieOption(pie)
    expect(pieOption.series[0].data.map((d) => d.itemStyle.color)).toEqual(CATEGORY_CODES.map((code) => CATEGORY_SYMBOLS[code].color))
    expect(pieOption.height).toBe(CHART_HEIGHT_PX)

    const barOption = buildBarOption([
      { code: '420111', name: '洪山区', value: 360 },
      { code: '420106', name: '武昌区', value: 180 },
      { code: '420105', name: '汉阳区', value: 120 },
    ])
    expect(barOption.series[0].data).toHaveLength(3)

    // 柱图点击 → 地图定位该区（FR-M3-05 规则 3）
    const fakeMap = { flyTo: vi.fn() }
    getMapMock.mockReturnValue(fakeMap)
    const selectSpy = vi.fn()
    eventBus.on(EVENTS.FEATURE_SELECT, selectSpy)
    locateDistrict('420111', { lon: 114.32, lat: 30.52 })
    expect(fakeMap.flyTo).toHaveBeenCalledWith([30.52, 114.32], 11)
    expect(selectSpy).toHaveBeenCalledWith({ districtCode: '420111' })
    eventBus.off(EVENTS.FEATURE_SELECT, selectSpy)
  })

  it('未选中类别层未登记时联动静默跳过（R3 未就绪不阻塞）', () => {
    getMapMock.mockReturnValue({ hasLayer: vi.fn(() => false) })
    const result = highlightCategory('MED')
    expect(result.highlighted).toBe('MED')
  })
})

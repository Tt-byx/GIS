/**
 * CHK-TEST-M3-02 · FR-M3-02 分级设色图（3 断言，对应 AC-M3-02-1..3）。
 * 断点算法为纯函数直接断言；编排走 mock 的统计接口与要素服务。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { fetchDistrictStatsMock, createFeatureServerMock, getMapMock } = vi.hoisted(() => ({
  fetchDistrictStatsMock: vi.fn(),
  createFeatureServerMock: vi.fn(),
  getMapMock: vi.fn(),
}))

vi.mock('@/api/stats', () => ({ fetchDistrictStats: fetchDistrictStatsMock }))

vi.mock('@/core/serviceFactory', () => ({
  createFeatureServer: createFeatureServerMock,
  createQueryPolygon: vi.fn(),
  createQueryPoint: vi.fn(),
  buildFeatureServerUrl: vi.fn(),
  buildMapServerUrl: vi.fn(),
  createFeatureLayer: vi.fn(),
  createTileLayer: vi.fn(),
}))

vi.mock('@/core/mapInstance', () => ({
  getMap: getMapMock,
  setMap: vi.fn(),
  isMapReady: vi.fn(() => true),
}))

import { applyClassBreaks, buildClassBreakLegend } from '../index'
import { calcClassBreaks, levelOf, equalIntervalBreaks } from '../classBreaks'
import { removeFromMap } from '@/core/layerRegistry'

/** 8 条街道的 count 统计（Jenks 分级样本） */
const STREET_STATS = {
  level: 'street',
  metric: 'count',
  unit: '个',
  dataDate: '2026-11-05',
  list: [
    { unitCode: '420111001', unitName: '关山街道', value: 43, facCount: 43, popTotal: 186000 },
    { unitCode: '420111002', unitName: '珞南街道', value: 31, facCount: 31, popTotal: 150000 },
    { unitCode: '420111003', unitName: '狮子山街道', value: 12, facCount: 12, popTotal: 90000 },
    { unitCode: '420106001', unitName: '水果湖街道', value: 28, facCount: 28, popTotal: 120000 },
    { unitCode: '420106002', unitName: '积玉桥街道', value: 9, facCount: 9, popTotal: 80000 },
    { unitCode: '420105001', unitName: '建桥街道', value: 15, facCount: 15, popTotal: 70000 },
    { unitCode: '420105002', unitName: '晴川街道', value: 5, facCount: 5, popTotal: 60000 },
    { unitCode: '420105003', unitName: '四新街道', value: 22, facCount: 22, popTotal: 95000 },
  ],
}

function makeStreetFeature(unitCode, unitName) {
  return {
    attributes: { STREET_CODE: unitCode, STREET: unitName },
    geometry: {
      type: 'Polygon',
      coordinates: [[[114.0, 30.4], [114.6, 30.4], [114.6, 30.7], [114.0, 30.7], [114.0, 30.4]]],
    },
  }
}

function setupMock({ stats = STREET_STATS, boundaryFeatures = null } = {}) {
  fetchDistrictStatsMock.mockResolvedValue(stats)
  const features = boundaryFeatures || stats.list.map((row) => makeStreetFeature(row.unitCode, row.unitName))
  const bindTooltips = []
  globalThis.L = {
    geoJSON: vi.fn((fc, opts) => {
      const layers = fc.features.map((feature) => {
        const featureLayer = {
          bindTooltip: vi.fn((text) => bindTooltips.push(text)),
          addTo: vi.fn(),
        }
        if (opts.onEachFeature) {
          opts.onEachFeature(feature, featureLayer)
        }
        return featureLayer
      })
      return { addTo: vi.fn(), options: opts, layers }
    }),
  }
  createFeatureServerMock.mockReturnValue({
    queryFeatures: vi.fn().mockResolvedValue({ data: { featureSet: { features } } }),
  })
  const fakeMap = { removeLayer: vi.fn(), addLayer: vi.fn() }
  getMapMock.mockReturnValue(fakeMap)
  return { bindTooltips, fakeMap }
}

describe('分级断点算法（FR-M3-02 规则 2）', () => {
  it('Jenks 断点长度 6、严格递增、首尾为 min/max', () => {
    const breaks = calcClassBreaks(STREET_STATS.list.map((row) => row.value))
    expect(breaks).toHaveLength(6)
    expect(breaks[0]).toBe(5)
    expect(breaks[5]).toBe(43)
    for (let i = 1; i < breaks.length; i += 1) {
      expect(breaks[i]).toBeGreaterThan(breaks[i - 1])
    }
  })

  it('样本 < 5 时退化为等间距；null 值不参与分级（A-23）', () => {
    const breaks = calcClassBreaks([1, 2, 3, 4])
    expect(breaks).toEqual(equalIntervalBreaks([1, 2, 3, 4]))
    const withNull = calcClassBreaks([10, 20, 30, 40, 50, null, 60])
    expect(withNull[0]).toBe(10)
    expect(withNull[5]).toBe(60)
    expect(calcClassBreaks([null, null])).toBeNull()
  })

  it('levelOf 把数值落到 1–5 级', () => {
    const breaks = [0, 2, 4, 6, 8, 10]
    expect(levelOf(0, breaks)).toBe(1)
    expect(levelOf(2, breaks)).toBe(2)
    expect(levelOf(10, breaks)).toBe(5)
  })
})

describe('FR-M3-02 分级设色编排', () => {
  beforeEach(() => {
    removeFromMap('theme-class-breaks')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-M3-02-1：street+count 下图例含 5 个区间，区间端点覆盖数据 min/max', async () => {
    setupMock()
    const result = await applyClassBreaks({ level: 'street', categoryL1: 'ALL', metric: 'count' })

    expect(fetchDistrictStatsMock).toHaveBeenCalledWith({ level: 'street', categoryL1: 'ALL', metric: 'count' })
    expect(result.legendItems).toHaveLength(5)
    expect(result.legendItems[0].rangeText).toContain('5.00')
    expect(result.legendItems[4].rangeText).toContain('43.00')
    // 区间必须递增且无"只显示颜色不给数值"（FR-M3-02 规则 4）
    for (const item of result.legendItems) {
      expect(item.rangeText).toMatch(/\d+\.\d{2} – \d+\.\d{2}/)
    }
  })

  it('AC-M3-02-2：切换指标时先清除旧设色图层，不残留', async () => {
    const { fakeMap } = setupMock()
    await applyClassBreaks({ level: 'street', categoryL1: 'ALL', metric: 'count' })
    const callsAfterFirst = fakeMap.removeLayer.mock.calls.length

    await applyClassBreaks({ level: 'street', categoryL1: 'ALL', metric: 'density' })
    // 第二次 apply 前必须移除第一次的设色层
    expect(fakeMap.removeLayer.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })

  it('AC-M3-02-3：悬停 tooltip 含单元名称、指标值、设施数三项', async () => {
    const { bindTooltips } = setupMock()
    await applyClassBreaks({ level: 'street', categoryL1: 'ALL', metric: 'count' })

    expect(bindTooltips.length).toBe(STREET_STATS.list.length)
    const guanshan = bindTooltips.find((text) => text.includes('关山街道'))
    expect(guanshan).toContain('43')
    expect(guanshan).toContain('设施数 43')
  })

  it('level 越界直接抛错（API-04：非枚举 → 1002，前端防御）', async () => {
    setupMock()
    await expect(applyClassBreaks({ level: 'city' })).rejects.toThrow('level')
  })

  it('buildClassBreakLegend 输出 5 项且区间严格递增', () => {
    const legend = buildClassBreakLegend([0, 2, 4, 6, 8, 10])
    expect(legend.map((item) => item.rangeText)).toEqual([
      '0.00 – 2.00', '2.00 – 4.00', '4.00 – 6.00', '6.00 – 8.00', '8.00 – 10.00',
    ])
  })
})

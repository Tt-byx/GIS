/**
 * CHK-TEST-M3-01 · FR-M3-01 分类符号图（2 断言，对应 AC-M3-01-1/2）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getMapMock } = vi.hoisted(() => ({ getMapMock: vi.fn() }))

vi.mock('@/core/mapInstance', () => ({
  getMap: getMapMock,
  setMap: vi.fn(),
  isMapReady: vi.fn(() => true),
}))

import { applySymbols, buildCategoryLegend, shapeToHtml } from '../index'
import { CATEGORY_SYMBOLS } from '@/config/symbols'
import { eventBus, EVENTS } from '@/core/eventBus'
import { removeFromMap } from '@/core/layerRegistry'

/** 02 §5 DICT_CATEGORY 的五类颜色（唯一权威，逐字） */
const DICT_COLORS = {
  EDU: '#4A90D9',
  MED: '#E05252',
  CUL: '#8B5CF6',
  WEL: '#F59E0B',
  COM: '#10B981',
}

describe('FR-M3-01 分类符号图', () => {
  beforeEach(() => {
    getMapMock.mockReturnValue({ addLayer: vi.fn(), removeLayer: vi.fn() })
    removeFromMap('theme-category-symbols')
  })

  it('AC-M3-01-2：symbols 颜色与 02 字典 COLOR_HEX 完全一致，且形状互不相同', () => {
    for (const [code, dictColor] of Object.entries(DICT_COLORS)) {
      expect(CATEGORY_SYMBOLS[code].color).toBe(dictColor)
    }
    const shapes = Object.values(CATEGORY_SYMBOLS).map((item) => item.shape)
    expect(new Set(shapes).size).toBe(shapes.length)
  })

  it('AC-M3-01-1：图例数据恰为 5 项，文案与字典 L1_NAME 一致、顺序按 SORT_NO', () => {
    const legend = buildCategoryLegend()
    expect(legend.map((item) => item.label)).toEqual(['教育设施', '医疗卫生', '文化体育', '社会福利', '社区服务'])
    expect(legend.map((item) => item.color)).toEqual(Object.values(DICT_COLORS))
  })

  it('applySymbols 按类别渲染不同形状与颜色的点，并广播 theme:change', () => {
    const markerCalls = []
    globalThis.L = {
      geoJSON: vi.fn((fc, opts) => {
        // 用 pointToLayer 逐点构造，验证符号配置
        for (const feature of fc.features) {
          markerCalls.push(opts.pointToLayer(feature, { lat: feature.properties.lat, lng: feature.properties.lon }))
        }
        return { addTo: vi.fn() }
      }),
      marker: vi.fn((latlng, options) => ({ addTo: vi.fn(), latlng, options })),
      divIcon: vi.fn((options) => options),
    }
    const themeSpy = vi.fn()
    eventBus.on(EVENTS.THEME_CHANGE, themeSpy)

    const facilities = Object.keys(DICT_COLORS).map((code, i) => ({
      facCode: `F${i}`,
      categoryL1: code,
      name: `设施${i}`,
      lon: 114.3 + i * 0.01,
      lat: 30.5,
    }))
    applySymbols(facilities)

    expect(markerCalls).toHaveLength(5)
    const htmls = markerCalls.map((marker) => marker.options.icon.html)
    expect(htmls[0]).toContain(DICT_COLORS.EDU)
    expect(htmls[1]).toContain(DICT_COLORS.MED)
    // 形状互不相同：五段 html 两两不同
    expect(new Set(htmls).size).toBe(5)
    expect(themeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'category', params: expect.objectContaining({ legendItems: expect.any(Array) }) }),
    )
    eventBus.off(EVENTS.THEME_CHANGE, themeSpy)
  })

  it('shapeToHtml 对五种形状产出互不相同的片段；未知形状回退圆形', () => {
    const htmls = ['circle', 'square', 'triangle', 'diamond', 'pentagon'].map((shape) => shapeToHtml(shape, '#123456'))
    expect(new Set(htmls).size).toBe(5)
    expect(shapeToHtml('unknown', '#123456')).toBe(shapeToHtml('circle', '#123456'))
  })
})

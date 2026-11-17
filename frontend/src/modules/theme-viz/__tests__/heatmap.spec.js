/**
 * CHK-TEST-M3-03 · FR-M3-03 热力图（4 断言，对应 AC-M3-03-1..4）。
 * 真实像素绘制依赖 canvas 2d（jsdom 无实现），单测聚焦图层管理逻辑与色带；
 * 像素级效果由手工验收（06-testing §7）覆盖。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getMapMock } = vi.hoisted(() => ({ getMapMock: vi.fn() }))

vi.mock('@/core/mapInstance', () => ({
  getMap: getMapMock,
  setMap: vi.fn(),
  isMapReady: vi.fn(() => true),
}))

import {
  applyHeatmap,
  clearHeatmap,
  normalizeHeatOptions,
  ensureHeatPane,
  buildColorRamp,
  HEAT_LAYER_ID,
  HEAT_PANE_ID,
  HEAT_PANE_Z_INDEX,
} from '../index'
import { hasLayer } from '@/core/layerRegistry'
import { HEAT_GRADIENT } from '@/config/symbols'
import { removeFromMap } from '@/core/layerRegistry'

/** 造 N 个有效点位 */
function makePoints(n) {
  return Array.from({ length: n }, (_, i) => ({ lon: 114.3 + (i % 50) * 0.001, lat: 30.5 + i * 0.0005 }))
}

/** Leaflet Layer.extend 桩：模拟 initialize 构造流程，提供 addTo 行为 */
function installLeafletStub() {
  class FakeHeatLayer {
    constructor(...args) {
      this.options = {}
      if (this._proto && typeof this._proto.initialize === 'function') {
        this._proto.initialize.apply(this, args)
      }
    }
    addTo(map) {
      map.addLayer(this)
      return this
    }
  }
  globalThis.L = {
    Layer: {
      extend: vi.fn((proto) => {
        const Cls = class extends FakeHeatLayer {}
        Cls.prototype._proto = proto
        return Cls
      }),
    },
    DomUtil: {
      create: vi.fn(() => ({ style: {}, getContext: () => null, parentNode: { removeChild: vi.fn() } })),
    },
  }
}

describe('FR-M3-03 热力图', () => {
  let fakeMap
  let pane

  beforeEach(() => {
    installLeafletStub()
    pane = { style: {} }
    fakeMap = {
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      getPane: vi.fn((id) => (id === HEAT_PANE_ID ? pane : null)),
      createPane: vi.fn(() => pane),
      getSize: vi.fn(() => ({ x: 800, y: 600 })),
    }
    getMapMock.mockReturnValue(fakeMap)
    // 先清上一用例登记的热力层，再清空调用计数，保证断言只反映本用例
    removeFromMap(HEAT_LAYER_ID)
    fakeMap.removeLayer.mockClear()
    fakeMap.addLayer.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-M3-03-1：1000 个 MED 点调用 applyHeatmap 后热力层数量 = 1', () => {
    const layer = applyHeatmap(makePoints(1000), { categoryL1: 'MED' })

    expect(layer._points).toHaveLength(1000)
    expect(hasLayer(HEAT_LAYER_ID)).toBe(true)
    expect(fakeMap.addLayer).toHaveBeenCalledTimes(1)
  })

  it('AC-M3-03-2：MED 切换 EDU 后热力层数量仍 = 1（旧的被移除）', () => {
    const first = applyHeatmap(makePoints(500), { categoryL1: 'MED' })
    applyHeatmap(makePoints(300), { categoryL1: 'EDU' })

    // 旧层先移除：removeLayer 恰好收到第一层实例
    expect(fakeMap.removeLayer).toHaveBeenCalledTimes(1)
    expect(fakeMap.removeLayer).toHaveBeenCalledWith(first)
    expect(hasLayer(HEAT_LAYER_ID)).toBe(true)
    expect(fakeMap.addLayer).toHaveBeenCalledTimes(2)
  })

  it('AC-M3-03-3：clearHeatmap 后热力层数量 = 0，且重复清除幂等', () => {
    applyHeatmap(makePoints(10))
    expect(clearHeatmap()).toBe(true)
    expect(hasLayer(HEAT_LAYER_ID)).toBe(false)
    expect(fakeMap.removeLayer).toHaveBeenCalledTimes(1)
    expect(clearHeatmap()).toBe(false)
  })

  it('AC-M3-03-4：热力 pane z-index(350) < 设施点 markerPane(600)，色带冷→暖', () => {
    applyHeatmap(makePoints(5))
    expect(ensureHeatPane(fakeMap).style.zIndex).toBe(String(HEAT_PANE_Z_INDEX))
    // Leaflet markerPane = 600；热力层必须在其下方（FR-M3-03 处理规则 2）
    expect(HEAT_PANE_Z_INDEX).toBeLessThan(600)

    // 色带：低强度为蓝系（B 分量最高），高强度为红系（R 分量最高），禁止反色
    const ramp = buildColorRamp(HEAT_GRADIENT)
    const low = ramp.lookup(0.2)
    const high = ramp.lookup(1.0)
    expect(low[2]).toBeGreaterThan(low[0]) // 蓝：B > R
    expect(high[0]).toBeGreaterThan(high[2]) // 红：R > B
  })

  it('参数越界抛错（FR-M3-03 输入约束）', () => {
    expect(() => normalizeHeatOptions({ radius: 5 })).toThrow('半径')
    expect(() => normalizeHeatOptions({ radius: 61 })).toThrow('半径')
    expect(() => normalizeHeatOptions({ blur: 1.5 })).toThrow('blur')
    expect(() => normalizeHeatOptions({ maxOpacity: -1 })).toThrow('maxOpacity')
    expect(normalizeHeatOptions({})).toEqual({ radius: 25, blur: 0.6, maxOpacity: 0.8 })
  })
})

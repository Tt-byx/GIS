/**
 * CHK-TEST-M3-04 · FR-M3-04 聚合图（3 断言，对应 AC-M3-04-1..3）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getMapMock } = vi.hoisted(() => ({ getMapMock: vi.fn() }))

vi.mock('@/core/mapInstance', () => ({
  getMap: getMapMock,
  setMap: vi.fn(),
  isMapReady: vi.fn(() => true),
}))

import {
  applyCluster,
  clearCluster,
  groupPointsByPixel,
  normalizeClusterOptions,
  toggleFacilityLayer,
  CLUSTER_LAYER_ID,
  FACILITY_LAYER_ID,
  CLUSTER_LABEL_MIN_FONT_PX,
} from '../index'
import { hasLayer } from '@/core/layerRegistry'
import { removeFromMap, registerLayer } from '@/core/layerRegistry'
import { CLUSTER_ZOOM_THRESHOLD } from '@/config'

function makePoints(n) {
  return Array.from({ length: n }, (_, i) => ({ lon: 114.3 + i * 0.002, lat: 30.5 + i * 0.002, facCode: `F${i}` }))
}

function installLeafletStub() {
  const createdMarkers = []
  class FakeClusterGroup {
    constructor(...args) {
      if (this._proto && typeof this._proto.initialize === 'function') {
        this._proto.initialize.apply(this, args)
      }
    }
    addTo(map) {
      map.addLayer(this)
      if (this._proto && this._proto.onAdd) {
        this._proto.onAdd.call(this, map)
      }
      return this
    }
  }
  globalThis.L = {
    Layer: {
      extend: vi.fn((proto) => {
        const Cls = class extends FakeClusterGroup {}
        Cls.prototype._proto = proto
        return Cls
      }),
    },
    marker: vi.fn((latlng, options) => {
      const marker = {
        latlng,
        options,
        handlers: {},
        addTo: vi.fn(function add() { return this }),
        on: vi.fn(function on(event, handler) { this.handlers[event] = handler; return this }),
      }
      createdMarkers.push(marker)
      return marker
    }),
    divIcon: vi.fn((options) => options),
  }
  return createdMarkers
}

describe('FR-M3-04 聚合图', () => {
  let fakeMap
  let markers

  beforeEach(() => {
    markers = installLeafletStub()
    fakeMap = {
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      getZoom: vi.fn(() => 12),
      getCenter: vi.fn(() => ({ lat: 30.52, lng: 114.32 })),
      flyTo: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    }
    getMapMock.mockReturnValue(fakeMap)
    removeFromMap(CLUSTER_LAYER_ID)
    removeFromMap(FACILITY_LAYER_ID)
    fakeMap.removeLayer.mockClear()
    fakeMap.addLayer.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-M3-04-1：聚合开启 zoom=12 时存在带数字的聚合气泡', () => {
    const layer = applyCluster(makePoints(30))

    expect(layer._points).toHaveLength(30)
    expect(hasLayer(CLUSTER_LAYER_ID)).toBe(true)
    // zoom<14：至少存在一个显示数量的气泡（相邻点 0.002 度在 60px 半径内成组）
    const bubbles = markers.filter((marker) => marker.options.icon.html.includes('<span'))
    expect(bubbles.length).toBeGreaterThan(0)
    // 数字为整数且字号 ≥ 12px（FR-M3-04 规则 2）
    const bubbleHtml = bubbles[0].options.icon.html
    expect(bubbleHtml).toMatch(/font-size:12px">\d+</)
  })

  it('AC-M3-04-2：zoom=15 时无聚合气泡，全部散开为单点', () => {
    fakeMap.getZoom.mockReturnValue(15)
    applyCluster(makePoints(30))

    const bubbles = markers.filter((marker) => marker.options.icon.html.includes('<span'))
    expect(bubbles).toHaveLength(0)
    expect(markers).toHaveLength(30)
  })

  it('AC-M3-04-3：点击聚合气泡 zoom 增加 2', () => {
    applyCluster(makePoints(30))
    const bubbles = markers.filter((marker) => marker.options.icon.html.includes('<span'))
    expect(bubbles.length).toBeGreaterThan(0)

    // 触发气泡 click（onAdd 内注册的处理函数）
    bubbles[0].handlers.click()
    expect(fakeMap.flyTo).toHaveBeenCalledTimes(1)
    const [, targetZoom] = fakeMap.flyTo.mock.calls[0]
    expect(targetZoom).toBe(12 + 2)
  })

  it('聚合开启时原设施点层隐藏、关闭时恢复（FR-M3-04 规则 4）', () => {
    // 先登记设施点层并放上地图（hasLayer 桩按"在图上"集合状态化，模拟真实移除效果）
    const facilityLayer = { addTo: vi.fn(), options: {} }
    registerLayer(FACILITY_LAYER_ID, facilityLayer)
    const onMap = new Set([facilityLayer])
    fakeMap.hasLayer = vi.fn((layer) => onMap.has(layer))
    fakeMap.removeLayer.mockImplementation((layer) => onMap.delete(layer))
    fakeMap.removeLayer.mockClear()

    applyCluster(makePoints(10))
    expect(onMap.has(facilityLayer)).toBe(false)

    clearCluster()
    expect(facilityLayer.addTo).toHaveBeenCalledWith(fakeMap)
    expect(hasLayer(CLUSTER_LAYER_ID)).toBe(false)
  })

  it('设施点层未登记时不误操作，聚合仍可工作', () => {
    expect(toggleFacilityLayer(fakeMap, true)).toBe(false)
    const layer = applyCluster(makePoints(5))
    expect(hasLayer(CLUSTER_LAYER_ID)).toBe(true)
    expect(layer._points).toHaveLength(5)
  })

  it('聚合半径越界抛错；阈值来自配置（FR-M3-04 输入约束）', () => {
    expect(() => normalizeClusterOptions({ clusterRadius: 30 })).toThrow('聚合半径')
    expect(() => normalizeClusterOptions({ clusterRadius: 121 })).toThrow('聚合半径')
    expect(normalizeClusterOptions({})).toEqual({ clusterRadius: 60 })
    expect(CLUSTER_ZOOM_THRESHOLD).toBe(14)
    expect(CLUSTER_LABEL_MIN_FONT_PX).toBe(12)
  })

  it('groupPointsByPixel：近邻成组、远点独立', () => {
    const groups = groupPointsByPixel(
      [
        { lon: 114.3, lat: 30.5 },
        { lon: 114.3001, lat: 30.5001 },
        { lon: 115.0, lat: 31.0 },
      ],
      60,
      12,
    )
    expect(groups).toHaveLength(2)
    expect(groups[0]).toHaveLength(2)
    expect(groups[1]).toHaveLength(1)
  })
})

/**
 * CHK-TEST-M3-06 · FR-M3-06 图层叠加对比（2 断言，对应 AC-M3-06-1/2）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getMapMock } = vi.hoisted(() => ({ getMapMock: vi.fn() }))

vi.mock('@/core/mapInstance', () => ({
  getMap: getMapMock,
  setMap: vi.fn(),
  isMapReady: vi.fn(() => true),
}))

import { enterCompare, exitCompare, isCompareActive } from '../compare'
import { registerLayer, removeFromMap } from '@/core/layerRegistry'

const THREE_IDS = ['EDU', 'MED', 'WEL']

/** 造一个带透明度能力的图层 stub */
function makeLayer() {
  return {
    addTo: vi.fn(),
    setOpacity: vi.fn(),
    options: { opacity: 1 },
  }
}

describe('FR-M3-06 图层叠加对比', () => {
  let fakeMap
  let layers

  beforeEach(() => {
    fakeMap = {
      removeLayer: vi.fn(),
      addLayer: vi.fn(),
      hasLayer: vi.fn(() => true),
    }
    getMapMock.mockReturnValue(fakeMap)
    layers = {}
    for (const id of THREE_IDS) {
      layers[id] = makeLayer()
      registerLayer(id, layers[id])
    }
  })

  afterEach(() => {
    for (const id of THREE_IDS) {
      removeFromMap(id)
    }
    vi.restoreAllMocks()
  })

  it('AC-M3-06-1：进入对比后仅参与图层可见且透明度生效，非参与层被隐藏', () => {
    enterCompare({ layerIds: ['EDU', 'MED'], opacity: 0.5 })

    // 参与层设置透明度
    expect(layers.EDU.setOpacity).toHaveBeenCalledWith(0.5)
    expect(layers.MED.setOpacity).toHaveBeenCalledWith(0.5)
    // 非参与层从地图移除
    expect(fakeMap.removeLayer).toHaveBeenCalledWith(layers.WEL)
    expect(isCompareActive()).toBe(true)
  })

  it('AC-M2-06-2：退出对比恢复进入前的快照（透明度回原值，禁止重置为全部可见）', () => {
    // 进入前 WEL 透明度为 0.7（模拟用户手动调过）
    layers.WEL.setOpacity.mockClear()
    layers.WEL.options.opacity = 0.7

    enterCompare({ layerIds: ['EDU', 'MED'], opacity: 0.3 })
    exitCompare()

    // 快照恢复：WEL 回到 0.7（而不是 0.3，也不是"全部可见"语义的重置）
    expect(layers.WEL.setOpacity).toHaveBeenCalledWith(0.7)
    expect(layers.WEL.options.opacity).toBe(0.7)
    // EDU/MED 回到快照中的原透明度 1
    expect(layers.EDU.setOpacity).toHaveBeenCalledWith(1)
    expect(isCompareActive()).toBe(false)
  })

  it('参与图层个数与透明度越界时抛错（FR-M3-06 输入约束）', () => {
    expect(() => enterCompare({ layerIds: ['EDU'] })).toThrow('2–3')
    expect(() => enterCompare({ layerIds: ['EDU', 'MED', 'WEL', 'CUL'] })).toThrow('2–3')
    expect(() => enterCompare({ layerIds: ['EDU', 'MED'], opacity: 1.2 })).toThrow('透明度')
  })

  it('未进入对比时 exitCompare 返回 false', () => {
    expect(exitCompare()).toBe(false)
  })
})

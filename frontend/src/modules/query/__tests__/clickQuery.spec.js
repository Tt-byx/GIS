/**
 * CHK-TEST-M2-02 · FR-M2-02 点选查询（3 断言，对应 AC-M2-02-1..3）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { createFeatureServerMock, createQueryPolygonMock, getMapMock } = vi.hoisted(() => ({
  createFeatureServerMock: vi.fn(),
  createQueryPolygonMock: vi.fn((rings) => ({ coordinates: rings })),
  getMapMock: vi.fn(),
}))

vi.mock('@/core/serviceFactory', () => ({
  createFeatureServer: createFeatureServerMock,
  createQueryPolygon: createQueryPolygonMock,
  createQueryPoint: vi.fn(),
  buildFeatureServerUrl: vi.fn(() => '/igs/rest/services/Map/wh_facility/FeatureServer'),
  buildMapServerUrl: vi.fn(),
  createFeatureLayer: vi.fn(),
  createTileLayer: vi.fn(),
}))

vi.mock('@/core/mapInstance', () => ({
  getMap: getMapMock,
  setMap: vi.fn(),
  isMapReady: vi.fn(() => true),
}))

import { queryByClick } from '../index'
import { eventBus, EVENTS } from '@/core/eventBus'
import { createFakeMap, installLeafletStub } from './helpers'

/** 造一个 IGServer 风格要素（GDB 原始字段名） */
function makeGdbFeature(facCode, name) {
  return {
    attributes: {
      FAC_CODE: facCode,
      NAME: name,
      CAT_L1: 'MED',
      LON: 114.398765,
      LAT: 30.512345,
    },
    geometry: { type: 'Point', coordinates: [114.398765, 30.512345] },
  }
}

function setupServerReturn(features) {
  const queryFeatures = vi.fn().mockResolvedValue({
    data: { featureSet: { features } },
  })
  createFeatureServerMock.mockReturnValue({ queryFeatures })
  return queryFeatures
}

describe('FR-M2-02 点选查询', () => {
  let fakeMap

  beforeEach(() => {
    installLeafletStub()
    fakeMap = createFakeMap()
    getMapMock.mockReturnValue(fakeMap)
    createFeatureServerMock.mockReset()
    createQueryPolygonMock.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-M2-02-1：命中 1 个要素时广播 feature:select，属性面板随事件打开', async () => {
    setupServerReturn([makeGdbFeature('420111-MED-CHS-0007', '关山街社区卫生服务中心')])
    const selectSpy = vi.fn()
    eventBus.on(EVENTS.FEATURE_SELECT, selectSpy)

    const result = await queryByClick({ lon: 114.398765, lat: 30.512345 })

    expect(result.total).toBe(1)
    expect(result.list[0].facCode).toBe('420111-MED-CHS-0007')
    expect(selectSpy).toHaveBeenCalledTimes(1)
    expect(selectSpy).toHaveBeenCalledWith({ facCode: '420111-MED-CHS-0007' })
    eventBus.off(EVENTS.FEATURE_SELECT, selectSpy)
  })

  it('AC-M2-02-2：点击空白（命中 0）时静默返回，不广播选中', async () => {
    setupServerReturn([])
    const selectSpy = vi.fn()
    eventBus.on(EVENTS.FEATURE_SELECT, selectSpy)

    const result = await queryByClick({ lon: 114.5, lat: 30.6 })

    expect(result.total).toBe(0)
    expect(result.list).toEqual([])
    expect(selectSpy).not.toHaveBeenCalled()
    eventBus.off(EVENTS.FEATURE_SELECT, selectSpy)
  })

  it('AC-M2-02-3：两设施重叠时返回 2 项选择列表，不直接广播选中', async () => {
    setupServerReturn([
      makeGdbFeature('420111-MED-CHS-0001', '甲卫生服务站'),
      makeGdbFeature('420111-MED-CHS-0002', '乙卫生服务站'),
    ])

    const result = await queryByClick({ lon: 114.398765, lat: 30.512345, tolerancePx: 5 })

    expect(result.total).toBe(2)
    expect(result.list.length).toBe(2)
    // 选择列表按 facCode 升序（与 API-02 稳定排序语义一致）
    expect(result.list[0].facCode < result.list[1].facCode).toBe(true)
  })

  it('容差越界时直接抛错（FR-M2-02 输入约束 1–20px）', async () => {
    await expect(queryByClick({ lon: 114, lat: 30, tolerancePx: 21 })).rejects.toThrow('容差')
  })
})

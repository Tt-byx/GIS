/**
 * CHK-TEST-M2-04 · FR-M2-04 周边查询（3 断言，对应 AC-M2-04-1..3）。
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

import { searchNearby, EMPTY_NEARBY_TEXT } from '../index'
import { createFakeMap, installLeafletStub } from './helpers'

const CENTER = { lon: 114.32, lat: 30.52 }

/**
 * 以近似固定距离构造设施点：1 度纬度 ≈ 111320 米（武汉纬度下误差远小于整数米粒度）。
 */
function makePointFeature(facCode, dLatDeg, dLonDeg) {
  const lon = CENTER.lon + dLonDeg
  const lat = CENTER.lat + dLatDeg
  return {
    attributes: {
      FAC_CODE: facCode,
      NAME: `设施-${facCode}`,
      CAT_L1: 'CHS',
      LON: lon,
      LAT: lat,
    },
    geometry: { type: 'Point', coordinates: [lon, lat] },
  }
}

function setupServerReturn(features) {
  const queryFeatures = vi.fn().mockResolvedValue({
    data: { featureSet: { features } },
  })
  createFeatureServerMock.mockReturnValue({ queryFeatures })
  return queryFeatures
}

describe('FR-M2-04 周边查询', () => {
  beforeEach(() => {
    installLeafletStub()
    getMapMock.mockReturnValue(createFakeMap())
    createFeatureServerMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-M2-04-1：1000 米内的结果全部满足 distanceM <= 1000', async () => {
    // 距中心约 300 / 600 / 900 米（南北向偏移）
    setupServerReturn([
      makePointFeature('A', 0.0027, 0),
      makePointFeature('B', 0.0054, 0),
      makePointFeature('C', 0.0081, 0),
    ])

    const result = await searchNearby({ ...CENTER, radius: 1000, categoryL1: 'ALL' })

    expect(result.total).toBe(3)
    expect(result.list.every((item) => item.distanceM <= 1000)).toBe(true)
    // 服务端类别过滤：ALL 不得携带 where
    const queryFeatures = createFeatureServerMock.mock.results[0].value.queryFeatures
    expect(queryFeatures.mock.calls[0][0].where).toBeUndefined()
  })

  it('AC-M2-04-2：distanceM 为整数米且单调不减（升序）', async () => {
    // 乱序返回，验证客户端排序
    setupServerReturn([
      makePointFeature('FAR', 0.0081, 0),
      makePointFeature('NEAR', 0.0027, 0),
      makePointFeature('MID', 0.0054, 0),
    ])

    const result = await searchNearby({ ...CENTER, radius: 1000 })

    const distances = result.list.map((item) => item.distanceM)
    expect(distances).toHaveLength(3)
    for (const value of distances) {
      expect(Number.isInteger(value)).toBe(true)
    }
    for (let i = 1; i < distances.length; i += 1) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1])
    }
  })

  it('AC-M2-04-3：范围内无结果时导出固定文案', async () => {
    setupServerReturn([])
    const result = await searchNearby({ ...CENTER, radius: 1000 })
    expect(result.total).toBe(0)
    expect(EMPTY_NEARBY_TEXT).toBe('该范围内未找到符合条件的设施，建议扩大搜索半径')
  })

  it('半径越界直接抛错（FR-M2-04 输入约束 100–5000 米）', async () => {
    await expect(searchNearby({ ...CENTER, radius: 50 })).rejects.toThrow('半径')
    await expect(searchNearby({ ...CENTER, radius: 5000.5 })).rejects.toThrow('半径')
  })

  it('指定类别时类别过滤必须下推到服务端（禁止前端二次过滤）', async () => {
    setupServerReturn([])
    await searchNearby({ ...CENTER, radius: 1000, categoryL1: 'MED' })
    const queryFeatures = createFeatureServerMock.mock.results[0].value.queryFeatures
    expect(queryFeatures.mock.calls[0][0].where).toBe("CAT_L1='MED'")
  })
})

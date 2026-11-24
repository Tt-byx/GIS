/**
 * CHK-TEST-M4-01 · FR-M4-01 缓冲区分析测试
 * 依据：SPEC/01-requirements.md FR-M4-01, SPEC/06-testing.md CHK-TEST-M4-01
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  runBuffer,
  renderBufferLayer,
  exportBufferGeoJSON,
  BUFFER_FILL_OPACITY,
} from '../buffer'

const { getMapMock } = vi.hoisted(() => ({ getMapMock: vi.fn() }))
vi.mock('@/core/mapInstance', () => ({
  getMap: getMapMock,
}))

describe('FR-M4-01 缓冲区分析', () => {
  beforeEach(() => {
    getMapMock.mockReset()
  })

  it('AC-M4-01-1: 1000 个设施点，radius=1000，dissolve=false 时缓冲面数量 = 1000', () => {
    // 构造 1000 个测试点
    const points = []
    for (let i = 0; i < 1000; i++) {
      points.push({
        lon: 114.2 + (i % 50) * 0.005,
        lat: 30.4 + Math.floor(i / 50) * 0.005,
      })
    }

    const result = runBuffer({ points, radius: 1000, dissolve: false })
    expect(result.count).toBe(1000)
    expect(result.featureCollection.features.length).toBe(1000)
  })

  it('AC-M4-01-2: dissolve=true 时融合成单一多边形要素（Polygon 或 MultiPolygon）', () => {
    const points = [
      { lon: 114.30, lat: 30.50 },
      { lon: 114.305, lat: 30.50 },
      { lon: 114.38, lat: 30.55 },
    ]

    const result = runBuffer({ points, radius: 1000, dissolve: true })
    expect(result.count).toBe(1)
    expect(result.featureCollection.features.length).toBe(1)
    expect(['Polygon', 'MultiPolygon']).toContain(result.feature.geometry.type)
  })

  it('AC-M4-01-3: 统计结果含小区数、人口数、覆盖率三项，且覆盖率 ∈ [0, 1]', () => {
    const facilityPoints = [
      { lon: 114.30, lat: 30.50 },
    ]
    const residentialPoints = [
      { lon: 114.301, lat: 30.501, popEst: 1500 }, // 在 ~150m 处，落在 1000m 缓冲区内
      { lon: 114.50, lat: 30.80, popEst: 2000 },   // 较远，落在缓冲区外
    ]

    const result = runBuffer({
      points: facilityPoints,
      radius: 1000,
      dissolve: true,
      residentialPoints,
    })

    const { stats } = result
    expect(stats).toHaveProperty('coveredResidentialCount')
    expect(stats).toHaveProperty('coveredPopulation')
    expect(stats).toHaveProperty('coverageRate')

    expect(stats.coveredResidentialCount).toBe(1)
    expect(stats.coveredPopulation).toBe(1500)
    expect(stats.coverageRate).toBe(0.5)
    expect(stats.coverageRate).toBeGreaterThanOrEqual(0)
    expect(stats.coverageRate).toBeLessThanOrEqual(1)
  })

  it('DoD 3: 缓冲区图层透明度为 0.2，且渲染后置于底层 (bringToBack)', () => {
    expect(BUFFER_FILL_OPACITY).toBe(0.2)

    const bringToBackMock = vi.fn()
    const addToMock = vi.fn()
    const geoJSONMock = vi.fn(() => ({
      addTo: addToMock,
      bringToBack: bringToBackMock,
    }))

    globalThis.L = { geoJSON: geoJSONMock }
    const fakeMap = {}
    getMapMock.mockReturnValue(fakeMap)

    const bufferResult = runBuffer({
      points: [{ lon: 114.3, lat: 30.5 }],
      radius: 500,
    })

    const layer = renderBufferLayer(bufferResult)
    expect(layer).not.toBeNull()
    expect(addToMock).toHaveBeenCalledWith(fakeMap)
    expect(bringToBackMock).toHaveBeenCalled()
  })

  it('FR-M4-06 规则 4: 结果可导出为标准 GeoJSON 格式', () => {
    const bufferResult = runBuffer({
      points: [{ lon: 114.3, lat: 30.5 }],
      radius: 500,
    })

    const exported = exportBufferGeoJSON(bufferResult.featureCollection, 'MED')
    expect(exported.filename).toMatch(/^analysis_buffer_MED_\d{14}\.geojson$/)
    const parsed = JSON.parse(exported.content)
    expect(parsed.type).toBe('FeatureCollection')
    expect(parsed.features.length).toBeGreaterThan(0)
  })
})

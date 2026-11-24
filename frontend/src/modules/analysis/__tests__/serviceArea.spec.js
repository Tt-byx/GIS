/**
 * CHK-TEST-M4-02 · FR-M4-02 网络服务区分析测试
 * 依据：SPEC/01-requirements.md FR-M4-02, SPEC/06-testing.md CHK-TEST-M4-02
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fetchServiceAreaMock } = vi.hoisted(() => ({
  fetchServiceAreaMock: vi.fn(),
}))

vi.mock('@/api/analysis', () => ({
  fetchServiceArea: fetchServiceAreaMock,
}))

import {
  runServiceArea,
  calculateCircularity,
  isNonCircular,
  renderServiceAreaLayer,
} from '../serviceArea'

const { getMapMock } = vi.hoisted(() => ({ getMapMock: vi.fn() }))
vi.mock('@/core/mapInstance', () => ({
  getMap: getMapMock,
}))

describe('FR-M4-02 网络服务区分析', () => {
  beforeEach(() => {
    fetchServiceAreaMock.mockReset()
    getMapMock.mockReset()
  })

  it('AC-M4-02-1: WALK + [5,10,15] 返回 3 个服务区，且面积单调递增', async () => {
    // 构造模拟服务区（非圆形多边形，面积逐级递增）
    fetchServiceAreaMock.mockResolvedValue({
      taskId: 'SA-20261125-0001',
      elapsedMs: 85,
      areas: [
        {
          threshold: 5,
          geomWkt: 'POLYGON ((114.30 30.50, 114.31 30.50, 114.31 30.51, 114.30 30.50))',
          coveredCommunityCount: 10,
        },
        {
          threshold: 10,
          geomWkt: 'POLYGON ((114.29 30.49, 114.32 30.49, 114.32 30.52, 114.29 30.52, 114.29 30.49))',
          coveredCommunityCount: 25,
        },
        {
          threshold: 15,
          geomWkt: 'POLYGON ((114.28 30.48, 114.34 30.48, 114.34 30.54, 114.28 30.54, 114.28 30.48))',
          coveredCommunityCount: 45,
        },
      ],
      summary: {
        totalCommunity: 50,
        uncoveredCommunities: [{ resCode: 'RES-01', name: '远郊小区' }],
      },
    })

    const result = await runServiceArea({
      categoryL2: 'CHC',
      travelMode: 'WALK',
      thresholds: [5, 10, 15],
    })

    expect(result.areas.length).toBe(3)
    expect(result.areas[0].threshold).toBe(5)
    expect(result.areas[1].threshold).toBe(10)
    expect(result.areas[2].threshold).toBe(15)

    // 面积单调递增
    expect(result.areas[0].areaM2).toBeLessThan(result.areas[1].areaM2)
    expect(result.areas[1].areaM2).toBeLessThan(result.areas[2].areaM2)
  })

  it('AC-M4-02-2 & DoD 2: 服务区边界非圆形，圆度 < 0.95', async () => {
    // 构造实际路网样式的非圆形不规则多边形（凹形）
    const wkt =
      'POLYGON ((114.30 30.50, 114.32 30.50, 114.32 30.51, 114.31 30.51, 114.31 30.53, 114.30 30.53, 114.30 30.50))'

    fetchServiceAreaMock.mockResolvedValue({
      taskId: 'SA-002',
      elapsedMs: 60,
      areas: [
        {
          threshold: 10,
          geomWkt: wkt,
          coveredCommunityCount: 15,
        },
      ],
      summary: { totalCommunity: 20 },
    })

    const result = await runServiceArea({
      categoryL2: 'CHC',
      travelMode: 'WALK',
      thresholds: [10],
    })

    const area = result.areas[0]
    expect(area.isNonCircular).toBe(true)
    expect(area.circularity).toBeLessThan(0.95)
  })

  it('AC-M4-02-3: 输出未覆盖小区清单，条数 = totalCommunity - coveredCommunityCount', async () => {
    fetchServiceAreaMock.mockResolvedValue({
      taskId: 'SA-003',
      elapsedMs: 70,
      areas: [
        {
          threshold: 15,
          geomWkt: 'POLYGON ((114.30 30.50, 114.32 30.50, 114.32 30.52, 114.30 30.52, 114.30 30.50))',
          coveredCommunityCount: 30,
        },
      ],
      summary: {
        totalCommunity: 35,
        uncoveredCommunities: [
          { resCode: 'R1' },
          { resCode: 'R2' },
          { resCode: 'R3' },
          { resCode: 'R4' },
          { resCode: 'R5' },
        ],
      },
    })

    const result = await runServiceArea({
      categoryL2: 'CHC',
      travelMode: 'WALK',
      thresholds: [15],
    })

    expect(result.summary.uncoveredCount).toBe(5)
    expect(result.summary.uncoveredCommunities.length).toBe(5)
    expect(result.summary.totalCommunity - result.areas[0].coveredCommunityCount).toBe(5)
  })

  it('渲染服务区图层组并添加到地图', () => {
    const addLayerMock = vi.fn()
    const addToMock = vi.fn()
    const fakeGroup = { addLayer: addLayerMock, addTo: addToMock }
    const fakeMap = {}

    globalThis.L = {
      layerGroup: vi.fn(() => fakeGroup),
      geoJSON: vi.fn(() => ({})),
    }
    getMapMock.mockReturnValue(fakeMap)

    const mockResult = {
      areas: [
        {
          threshold: 5,
          feature: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] } },
        },
      ],
    }

    const group = renderServiceAreaLayer(mockResult)
    expect(group).not.toBeNull()
    expect(addToMock).toHaveBeenCalledWith(fakeMap)
    expect(addLayerMock).toHaveBeenCalled()
  })
})

/**
 * CHK-TEST-M4-04 · FR-M4-04 可达性分析（2SFCA）测试
 * 依据：SPEC/01-requirements.md FR-M4-04, SPEC/06-testing.md CHK-TEST-M4-04
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fetchAccessibilityMock } = vi.hoisted(() => ({
  fetchAccessibilityMock: vi.fn(),
}))

vi.mock('@/api/analysis', () => ({
  fetchAccessibility: fetchAccessibilityMock,
}))

import {
  runAccessibility,
  VALID_THRESHOLDS,
  FALLBACK_OD_MESSAGE,
  renderAccessibilityLayer,
} from '../accessibility'

const { getMapMock } = vi.hoisted(() => ({ getMapMock: vi.fn() }))
vi.mock('@/core/mapInstance', () => ({
  getMap: getMapMock,
}))

describe('FR-M4-04 2SFCA 可达性分析与可视化', () => {
  beforeEach(() => {
    fetchAccessibilityMock.mockReset()
    getMapMock.mockReset()
  })

  it('AC-M4-04-1: OD 矩阵就绪，CHC + 15 + GAUSSIAN 返回结果条数 = 居住点数', async () => {
    const mockResidentialResults = [
      { unitCode: 'R01', unitName: '小区一', lon: 114.30, lat: 30.50, score: 0.8521, level: 5 },
      { unitCode: 'R02', unitName: '小区二', lon: 114.32, lat: 30.51, score: 0.6214, level: 4 },
      { unitCode: 'R03', unitName: '小区三', lon: 114.35, lat: 30.52, score: 0.3150, level: 2 },
    ]

    fetchAccessibilityMock.mockResolvedValue({
      taskId: 'AC-20261125-0001',
      elapsedMs: 140,
      decay: 'GAUSSIAN',
      breaks: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
      stats: { min: 0.3150, max: 0.8521, mean: 0.5962, p50: 0.6214 },
      results: mockResidentialResults,
    })

    const result = await runAccessibility({
      categoryL2: 'CHC',
      thresholdMinutes: 15,
      decay: 'GAUSSIAN',
    })

    expect(result.success).toBe(true)
    expect(result.results.length).toBe(mockResidentialResults.length)
    expect(result.featureCollection.features.length).toBe(mockResidentialResults.length)
  })

  it('AC-M4-04-2 & DoD 2: 分级数 = breaks.length - 1 (5 级)，使用服务端断点设色', async () => {
    fetchAccessibilityMock.mockResolvedValue({
      taskId: 'AC-002',
      breaks: [0.1, 0.3, 0.5, 0.7, 0.9, 1.2],
      stats: { min: 0.1, max: 1.2, mean: 0.65 },
      results: [],
    })

    const result = await runAccessibility({
      categoryL2: 'CHC',
      thresholdMinutes: 15,
    })

    expect(result.classCount).toBe(5)
    expect(result.breaks.length - 1).toBe(5)
    expect(result.breakLabels.length).toBe(5)
    expect(result.breakLabels[0]).toBe('0.1000 ~ 0.3000')
  })

  it('AC-M4-04-3: 统计面板包含参数（类别、阈值、衰减函数）、生成时间与 min/max/mean', async () => {
    fetchAccessibilityMock.mockResolvedValue({
      taskId: 'AC-003',
      decay: 'GAUSSIAN',
      breaks: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
      stats: { min: 0.05, max: 0.95, mean: 0.48 },
      results: [],
    })

    const result = await runAccessibility({
      categoryL1: 'MED',
      categoryL2: 'CHC',
      thresholdMinutes: 10,
      decay: 'GAUSSIAN',
    })

    expect(result.categoryL1).toBe('MED')
    expect(result.categoryL2).toBe('CHC')
    expect(result.thresholdMinutes).toBe(10)
    expect(result.decay).toBe('GAUSSIAN')
    expect(result.createdAt).toBeDefined()
    expect(result.stats).toMatchObject({
      min: 0.05,
      max: 0.95,
      mean: 0.48,
    })
  })

  it('AC-M4-04-4: OD 矩阵缺失或接口异常时，提示降级文案，不抛异常', async () => {
    fetchAccessibilityMock.mockRejectedValue(new Error('OD 矩阵未生成 (code 3001)'))

    const result = await runAccessibility({
      categoryL2: 'CHC',
      thresholdMinutes: 15,
    })

    expect(result.success).toBe(false)
    expect(result.message).toBe(FALLBACK_OD_MESSAGE)
    expect(result.message).toBe('可达性分析未就绪，请联系管理员生成 OD 矩阵')
    expect(result.results).toEqual([])
  })

  it('DoD 3: 阈值参数严格对齐国标，仅允许 5/10/15 分钟', async () => {
    expect(VALID_THRESHOLDS).toEqual([5, 10, 15])

    await expect(
      runAccessibility({ thresholdMinutes: 20 })
    ).rejects.toThrow('非法阈值: 20，仅允许 5/10/15 分钟')
  })

  it('渲染可达性点图层并支持半径随 level 递增', () => {
    const addLayerMock = vi.fn()
    const addToMock = vi.fn()
    const fakeGroup = { addLayer: addLayerMock, addTo: addToMock }
    const fakeMap = {}

    const circleMarkerMock = vi.fn(() => ({
      bindPopup: vi.fn(),
    }))

    globalThis.L = {
      layerGroup: vi.fn(() => fakeGroup),
      circleMarker: circleMarkerMock,
    }
    getMapMock.mockReturnValue(fakeMap)

    const mockResult = {
      results: [
        { unitCode: 'R1', lon: 114.3, lat: 30.5, score: 0.2, level: 1 },
        { unitCode: 'R2', lon: 114.4, lat: 30.6, score: 0.9, level: 5 },
      ],
    }

    const group = renderAccessibilityLayer(mockResult)
    expect(group).not.toBeNull()
    expect(addToMock).toHaveBeenCalledWith(fakeMap)
    expect(circleMarkerMock).toHaveBeenCalledTimes(2)

    // level 1 的半径小于 level 5
    const radiusLevel1 = circleMarkerMock.mock.calls[0][1].radius
    const radiusLevel5 = circleMarkerMock.mock.calls[1][1].radius
    expect(radiusLevel1).toBeLessThan(radiusLevel5)
  })
})

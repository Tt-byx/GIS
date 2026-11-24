/**
 * CHK-TEST-M4-06 · FR-M4-06 分析结果图层管理测试
 * 依据：SPEC/01-requirements.md FR-M4-06, SPEC/06-testing.md CHK-TEST-M4-06
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  addAnalysisResult,
  setResultVisible,
  removeAnalysisResult,
  clearAllAnalysisResults,
  getAnalysisResultsCount,
  getAnalysisStatsSummary,
  exportAnalysisResultGeoJSON,
} from '../resultManage'
import { useMapStore } from '@/stores/mapStore'

const { getMapMock } = vi.hoisted(() => ({ getMapMock: vi.fn() }))
vi.mock('@/core/mapInstance', () => ({
  getMap: getMapMock,
}))

describe('FR-M4-06 分析结果图层管理', () => {
  let fakeMap
  let fakeLayer1
  let fakeLayer2

  beforeEach(() => {
    setActivePinia(createPinia())
    fakeLayer1 = { id: 'l1' }
    fakeLayer2 = { id: 'l2' }
    fakeMap = {
      hasLayer: vi.fn(() => true),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
    }
    getMapMock.mockReturnValue(fakeMap)
    clearAllAnalysisResults()
  })

  it('分析结果独立加入 analysis 分组，且不混入设施图层 (FR-M4-06 规则 1)', () => {
    const store = useMapStore()
    addAnalysisResult({
      id: 'res-buffer-1',
      type: 'buffer',
      name: '医疗缓冲区 (1000m)',
      layer: fakeLayer1,
      geojson: {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [] } }],
      },
      stats: { coveredResidentialCount: 15, coveredPopulation: 25000 },
    })

    const analysisLayers = store.layersByGroup('analysis')
    expect(analysisLayers.length).toBe(1)
    expect(analysisLayers[0].id).toBe('res-buffer-1')
    expect(analysisLayers[0].group).toBe('analysis')

    // 设施分组不包含该图层
    const facilityLayers = store.layersByGroup('facility')
    expect(facilityLayers.some((l) => l.id === 'res-buffer-1')).toBe(false)
  })

  it('AC-M4-06-1 & DoD 3: 已生成 2 个分析结果，点击“清除全部”后，图层数与统计面板均归零', () => {
    const store = useMapStore()

    addAnalysisResult({
      id: 'res-1',
      type: 'buffer',
      name: '缓冲区分析 1',
      layer: fakeLayer1,
      geojson: { type: 'FeatureCollection', features: [] },
      stats: { coveredResidentialCount: 10, coveredPopulation: 10000 },
    })
    addAnalysisResult({
      id: 'res-2',
      type: 'serviceArea',
      name: '服务区分析 2',
      layer: fakeLayer2,
      geojson: { type: 'FeatureCollection', features: [] },
      stats: { coveredResidentialCount: 20, coveredPopulation: 30000 },
    })

    expect(getAnalysisResultsCount()).toBe(2)
    expect(store.layersByGroup('analysis').length).toBe(2)
    const statsBefore = getAnalysisStatsSummary()
    expect(statsBefore.resultsCount).toBe(2)
    expect(statsBefore.totalCoveredCommunities).toBe(30)

    // 执行一键清除
    clearAllAnalysisResults()

    // 验证图层数与统计面板均归零
    expect(getAnalysisResultsCount()).toBe(0)
    expect(store.layersByGroup('analysis').length).toBe(0)
    const statsAfter = getAnalysisStatsSummary()
    expect(statsAfter.resultsCount).toBe(0)
    expect(statsAfter.totalCoveredCommunities).toBe(0)
    expect(fakeMap.removeLayer).toHaveBeenCalledWith(fakeLayer1)
    expect(fakeMap.removeLayer).toHaveBeenCalledWith(fakeLayer2)
  })

  it('逐层显隐与逐层移除 (FR-M4-06 规则 2)', () => {
    const store = useMapStore()
    addAnalysisResult({
      id: 'res-toggle',
      type: 'buffer',
      name: '测试图层',
      layer: fakeLayer1,
      geojson: { type: 'FeatureCollection', features: [] },
    })

    setResultVisible('res-toggle', false)
    expect(store.getLayerById('res-toggle').visible).toBe(false)
    expect(fakeMap.removeLayer).toHaveBeenCalledWith(fakeLayer1)

    removeAnalysisResult('res-toggle')
    expect(store.getLayerById('res-toggle')).toBeUndefined()
    expect(getAnalysisResultsCount()).toBe(0)
  })

  it('AC-M4-06-2: 导出 GeoJSON 文件可被 JSON.parse 解析，且 type 为 FeatureCollection', () => {
    addAnalysisResult({
      id: 'res-export',
      type: 'serviceArea',
      name: '服务区导出测试',
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { threshold: 15 },
            geometry: { type: 'Polygon', coordinates: [] },
          },
        ],
      },
    })

    const exported = exportAnalysisResultGeoJSON('res-export')
    expect(exported.filename).toMatch(/^analysis_serviceArea_\d{14}\.geojson$/)

    const parsed = JSON.parse(exported.content)
    expect(parsed).toBeTypeOf('object')
    expect(parsed.type).toBe('FeatureCollection')
    expect(parsed.features).toBeInstanceOf(Array)
    expect(parsed.features.length).toBe(1)
  })
})

/**
 * CHK-TEST-M2-03 · FR-M2-03 空间范围查询（2 断言，对应 AC-M2-03-1/2）。
 * 附加：GDB→JSON 映射表与 02 §6.2 逐行对照（G-07 防漂移）。
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

import { queryByGeometry, clearGeometry, GDB_TO_JSON } from '../index'
import { createFakeMap, installLeafletStub } from './helpers'

function setupServerReturn(features) {
  const queryFeatures = vi.fn().mockResolvedValue({
    data: { featureSet: { features } },
  })
  createFeatureServerMock.mockReturnValue({ queryFeatures })
  return queryFeatures
}

const RECT_GEOMETRY = {
  type: 'Polygon',
  coordinates: [[[114.3, 30.5], [114.5, 30.5], [114.5, 30.6], [114.3, 30.6], [114.3, 30.5]]],
}

describe('FR-M2-03 空间范围查询', () => {
  let fakeMap

  beforeEach(() => {
    installLeafletStub()
    fakeMap = createFakeMap()
    getMapMock.mockReturnValue(fakeMap)
    createFeatureServerMock.mockReset()
    // layerRegistry 是模块级状态：先清掉其他用例登记的图层，再重置计数，保证断言只反映本用例
    clearGeometry()
    fakeMap.removeLayer.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-M2-03-1：矩形覆盖 10 个设施时返回 10 条', async () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({
      attributes: { FAC_CODE: `420111-MED-CHS-${String(i).padStart(4, '0')}`, NAME: `设施${i}` },
      geometry: { type: 'Point', coordinates: [114.3 + i * 0.01, 30.55] },
    }))
    const queryFeatures = setupServerReturn(ten)

    const result = await queryByGeometry({ shape: 'rect', geometry: RECT_GEOMETRY })

    expect(result.total).toBe(10)
    expect(result.list.length).toBe(10)
    // 空间关系必须为相交查询（FR-M2-03 规则 2）
    expect(queryFeatures.mock.calls[0][0].spatialRel).toBe('INTERSECTS')
  })

  it('AC-M2-03-2：clearGeometry 后绘制图形与高亮图层均被移除', async () => {
    setupServerReturn([
      { attributes: { FAC_CODE: '420111-MED-CHS-0001', NAME: '设施1' }, geometry: { type: 'Point', coordinates: [114.4, 30.55] } },
    ])
    await queryByGeometry({ shape: 'rect', geometry: RECT_GEOMETRY })

    clearGeometry()

    // 两次清除：query-draw 与 query-highlight
    expect(fakeMap.removeLayer).toHaveBeenCalledTimes(2)
  })

  it('circle 形状走 Turf 生成圆多边形（FR-M2-04 规则 1 的共享路径）', async () => {
    setupServerReturn([])
    await queryByGeometry({ shape: 'circle', geometry: { type: 'Point', coordinates: [114.32, 30.52] }, radius: 500 })
    expect(createQueryPolygonMock).toHaveBeenCalled()
  })
})

describe('GDB→JSON 映射防漂移（02 §6.2，G-07）', () => {
  it('映射表必须与 02 §6.2 全表 24 行逐行一致，且 FID 不外泄', () => {
    const expected = {
      FAC_CODE: 'facCode',
      NAME: 'name',
      NAME_RAW: 'nameRaw',
      CAT_L1: 'categoryL1',
      CAT_L2: 'categoryL2',
      CAT_L3: 'categoryL3',
      ADDRESS: 'address',
      DISTRICT_CODE: 'districtCode',
      DISTRICT: 'districtName',
      STREET_CODE: 'streetCode',
      STREET: 'streetName',
      COMMUNITY: 'communityName',
      LON: 'lon',
      LAT: 'lat',
      CAPACITY: 'capacity',
      CAP_UNIT: 'capacityUnit',
      AREA: 'area',
      LEVEL: 'level',
      STATUS: 'status',
      SRC_TYPE: 'srcType',
      SRC_DETAIL: 'srcDetail',
      SRC_DATE: 'srcDate',
      CONFIDENCE: 'confidence',
      REMARK: 'remark',
    }
    expect(GDB_TO_JSON).toEqual(expected)
    expect(Object.keys(GDB_TO_JSON)).toHaveLength(24)
    expect(GDB_TO_JSON.FID).toBeUndefined()
  })

  it('mapGdbFeature 输出不含 FID 且字段全部来自映射表（A-05 / P-02）', async () => {
    const { mapGdbFeature } = await import('../index')
    const mapped = mapGdbFeature({
      attributes: { FID: 1, FAC_CODE: 'X', NAME: 'n', EXTRA_FIELD: '不该出现' },
      geometry: { type: 'Point', coordinates: [114, 30] },
    })
    expect(Object.keys(mapped)).toEqual(['facCode', 'name'])
  })
})

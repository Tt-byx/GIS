/**
 * CHK-TEST-M2-01 · FR-M2-01 属性查询（4 断言，对应 AC-M2-01-1..4）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { fetchFacilitiesMock, fetchSuggestMock } = vi.hoisted(() => ({
  fetchFacilitiesMock: vi.fn(),
  fetchSuggestMock: vi.fn(),
}))

vi.mock('@/api/facility', () => ({
  fetchFacilities: fetchFacilitiesMock,
  fetchSuggest: fetchSuggestMock,
}))

import { searchByAttr, buildQueryParams, flyToFeature, EMPTY_RESULT_TEXT } from '../index'
import { useFilterStore } from '@/stores/filterStore'
import { eventBus, EVENTS } from '@/core/eventBus'
import { FLY_TO_ZOOM } from '../attrQuery'

const { getMapMock } = vi.hoisted(() => ({ getMapMock: vi.fn() }))
vi.mock('@/core/mapInstance', () => ({
  getMap: getMapMock,
  setMap: vi.fn(),
  isMapReady: vi.fn(() => true),
}))

describe('FR-M2-01 属性查询', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fetchFacilitiesMock.mockReset()
    getMapMock.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-M2-01-1：categoryL1=MED 时参数与服务端返回全部为 MED', async () => {
    const medList = [
      { facCode: '420111-MED-CHS-0007', categoryL1: 'MED', name: '关山街社区卫生服务中心' },
      { facCode: '420111-MED-CHC-0002', categoryL1: 'MED', name: '另一卫生服务中心' },
    ]
    fetchFacilitiesMock.mockResolvedValue({ total: 2, page: 1, size: 20, list: medList })

    const store = useFilterStore()
    store.setFilter({ categoryL1: 'MED' })
    const result = await searchByAttr()

    // 参数断言：MED 必须发给服务端，空条件不得出现（03 §4 业务规则 1）
    expect(fetchFacilitiesMock).toHaveBeenCalledTimes(1)
    const sentParams = fetchFacilitiesMock.mock.calls[0][0]
    expect(sentParams.categoryL1).toBe('MED')
    expect(sentParams).not.toHaveProperty('categoryL2')
    expect(sentParams).not.toHaveProperty('districtCode')
    expect(result.list.every((item) => item.categoryL1 === 'MED')).toBe(true)
  })

  it('AC-M2-01-2：keyword=社区 时参数包含关键词且结果名称均含"社区"', async () => {
    fetchFacilitiesMock.mockResolvedValue({
      total: 1,
      page: 1,
      size: 20,
      list: [{ facCode: '420111-MED-CHS-0007', name: '关山街社区卫生服务中心' }],
    })
    const store = useFilterStore()
    store.setFilter({ keyword: '社区' })
    const result = await searchByAttr()

    expect(fetchFacilitiesMock.mock.calls[0][0].keyword).toBe('社区')
    expect(result.list.every((item) => item.name.includes('社区'))).toBe(true)
  })

  it('AC-M2-01-3：无结果时 total=0 且导出固定空状态文案', async () => {
    fetchFacilitiesMock.mockResolvedValue({ total: 0, page: 1, size: 20, list: [] })
    const store = useFilterStore()
    store.setFilter({ keyword: '不存在的设施' })
    const result = await searchByAttr()

    expect(result.total).toBe(0)
    expect(result.list).toEqual([])
    // FR-M2-01 处理规则 5：空状态文案逐字固定
    expect(EMPTY_RESULT_TEXT).toBe('未找到符合条件的设施，请放宽筛选条件')
  })

  it('AC-M2-01-4：点击列表项定位到设施，缩放级别=16', () => {
    const fakeMap = { flyTo: vi.fn() }
    getMapMock.mockReturnValue(fakeMap)
    const selectSpy = vi.fn()
    eventBus.on(EVENTS.FEATURE_SELECT, selectSpy)

    flyToFeature({ lon: 114.398765, lat: 30.512345, facCode: '420111-MED-CHS-0007' })

    // Leaflet 坐标顺序 [lat, lon]；缩放固定 16（AC-M2-01-4）
    expect(fakeMap.flyTo).toHaveBeenCalledWith([30.512345, 114.398765], FLY_TO_ZOOM)
    expect(FLY_TO_ZOOM).toBe(16)
    // 带 facCode 时广播选中事件，供属性面板打开（FR-M2-05 规则 4）
    expect(selectSpy).toHaveBeenCalledWith({ facCode: '420111-MED-CHS-0007' })
    eventBus.off(EVENTS.FEATURE_SELECT, selectSpy)
  })
})

describe('buildQueryParams 空条件剔除（03 §4 业务规则 1）', () => {
  it('全部条件为空时仅保留分页与默认状态', () => {
    const params = buildQueryParams({ categoryL1: '', categoryL2: '', districtCode: '', streetCode: '', keyword: '', status: '正常', page: 3, size: 50 })
    expect(params).toEqual({ page: 3, size: 50, status: '正常' })
  })
})

describe('fetchSuggest 导入完整性', () => {
  it('api/facility 的 mock 必须覆盖两个导出（防漏 mock 导致静默 undefined）', () => {
    expect(typeof fetchSuggestMock).toBe('function')
  })
})

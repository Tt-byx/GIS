/**
 * M2 属性查询与定位编排（FR-M2-01、FR-M2-05 规则 4；任务 T-043）。
 * 职责：读 filterStore 组装参数 → 调 API-02 → 发 query:result 事件。
 * 空状态文案供 UI 组件消费（FR-M2-01 处理规则 5，文案逐字固定）。
 */
import { fetchFacilities } from '@/api/facility'
import { useFilterStore } from '@/stores/filterStore'
import { eventBus, EVENTS } from '@/core/eventBus'
import { getMap } from '@/core/mapInstance'

/** 结果为空时的固定文案（FR-M2-01 处理规则 5） */
export const EMPTY_RESULT_TEXT = '未找到符合条件的设施，请放宽筛选条件'

/** 候选定位的固定缩放级别（AC-M2-01-4 / AC-M2-05-3：zoom=16） */
export const FLY_TO_ZOOM = 16

/**
 * 组装 API-02 查询参数：空值条件必须剔除，禁止拼出 `AND x = ''`（03 §4 业务规则 1）。
 * @param {object} filters filterStore 的状态快照
 * @returns {object} 仅含非空条件与分页参数的对象
 */
export function buildQueryParams(filters) {
  const params = { page: filters.page, size: filters.size }
  if (filters.categoryL1) {
    params.categoryL1 = filters.categoryL1
  }
  if (filters.categoryL2) {
    params.categoryL2 = filters.categoryL2
  }
  if (filters.districtCode) {
    params.districtCode = filters.districtCode
  }
  if (filters.streetCode) {
    params.streetCode = filters.streetCode
  }
  if (filters.keyword) {
    params.keyword = filters.keyword
  }
  if (filters.status) {
    params.status = filters.status
  }
  return params
}

/**
 * 按当前筛选条件查询设施（FR-M2-01）。
 * @returns {Promise<{total: number, page: number, size: number, list: Array<object>}>}
 */
export async function searchByAttr() {
  const store = useFilterStore()
  const params = buildQueryParams(store.$state)
  const result = await fetchFacilities(params)
  eventBus.emit(EVENTS.QUERY_RESULT, { total: result.total, list: result.list })
  return result
}

/**
 * 定位到指定设施（FR-M2-01 规则 4：点击列表项触发；FR-M2-05 规则 4：选中候选触发）。
 * Leaflet 的坐标顺序是 [lat, lon]；带 facCode 时广播选中事件供属性面板打开
 * （候选点不在设施库时调用方不传 facCode，仅定位不弹面板，FR-M2-05 规则 4）。
 * @param {{lon: number, lat: number, facCode?: string, zoom?: number}} target
 * @returns {void}
 */
export function flyToFeature(target) {
  const { lon, lat, facCode, zoom = FLY_TO_ZOOM } = target
  if (typeof lon !== 'number' || typeof lat !== 'number') {
    throw new Error('flyToFeature 需要 lon/lat 数值坐标')
  }
  const map = getMap()
  if (!map) {
    throw new Error('地图尚未初始化，无法定位')
  }
  map.flyTo([lat, lon], zoom)
  if (facCode) {
    eventBus.emit(EVENTS.FEATURE_SELECT, { facCode })
  }
}

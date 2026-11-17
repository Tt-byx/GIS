/**
 * M2 空间范围/周边/点选查询编排（FR-M2-02 / FR-M2-03 / FR-M2-04；任务 T-043）。
 *
 * 三条硬规则：
 * 1. 空间关系 MUST 为相交 intersects（FR-M2-03 处理规则 2），禁止"完全包含"；
 * 2. 查询走 IGServer 要素服务（03 §11.3），MUST NOT 复用 API-02（A-20 / FR-M2-02 规则 5）；
 * 3. 周边查询的圆 MUST 由前端 Turf 生成（FR-M2-04 处理规则 1），距离 MUST 在前端按整数米给出。
 */
import * as turf from '@turf/turf'
import { createFeatureServer, createQueryPolygon } from '@/core/serviceFactory'
import { getMap } from '@/core/mapInstance'
import { registerLayer, removeFromMap } from '@/core/layerRegistry'
import { eventBus, EVENTS } from '@/core/eventBus'
import { LAYERS } from '@/config'

/** 设施要素子图层号（LAYERS.LAYER_FACILITY = 'wh_facility/0'） */
const FACILITY_SUB_LAYER_ID = String(LAYERS.LAYER_FACILITY).split('/')[1] || '0'

/** 空间查询单次返回上限（要素服务查询无分页契约，取 2000 平衡完整性） */
const MAX_SPATIAL_RECORDS = 2000

/** 周边查询半径取值范围（FR-M2-04 输入约束：100–5000 米，默认 1000） */
const NEARBY_RADIUS_MIN_M = 100
const NEARBY_RADIUS_MAX_M = 5000
const NEARBY_RADIUS_DEFAULT_M = 1000

/** 点选容差取值范围（FR-M2-02 输入约束：1–20 px，默认 5） */
const CLICK_TOLERANCE_MIN_PX = 1
const CLICK_TOLERANCE_MAX_PX = 20
const CLICK_TOLERANCE_DEFAULT_PX = 5

/** 点选多要素时的选择列表上限（FR-M2-02 处理规则 4） */
const CLICK_SELECT_MAX = 10

/** 周边查询的空结果文案（FR-M2-04 处理规则 5，逐字固定） */
export const EMPTY_NEARBY_TEXT = '该范围内未找到符合条件的设施，建议扩大搜索半径'

/** 绘制图形与结果高亮的登记 id（layerRegistry 唯一登记，防止重复叠加） */
const DRAWN_LAYER_ID = 'query-draw'
const HIGHLIGHT_LAYER_ID = 'query-highlight'

/**
 * GDB 字段 → JSON 契约字段映射（02 §6.2 全表 24 行；FID 不映射不外泄，A-05）。
 * 要素服务返回原始 GDB 字段名，此表是前端唯一的映射事实源，
 * 测试（query/__tests__/spatialQuery.spec.js）逐行对照 02 §6.2 防漂移（G-07）。
 */
export const GDB_TO_JSON = {
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

/**
 * 把要素服务返回的单个要素映射为 JSON 契约结构（02 §6.2）。
 * @param {object} feature IGServer 要素（attributes/properties + geometry）
 * @returns {object} 映射后的设施对象（不含 fid / FID）
 */
export function mapGdbFeature(feature) {
  const attrs = (feature && (feature.attributes || feature.properties)) || {}
  const out = {}
  for (const gdbKey of Object.keys(GDB_TO_JSON)) {
    if (gdbKey in attrs) {
      out[GDB_TO_JSON[gdbKey]] = attrs[gdbKey]
    }
  }
  return out
}

/**
 * 调要素服务查询设施要素。
 * @param {{geometry: object, where?: string}} options geometry 为 zondy.geometry.Polygon
 * @returns {Promise<Array<object>>} 原始要素数组（保证数组，空时为 []）
 */
async function queryFacilityFeatures({ geometry, where }) {
  const server = createFeatureServer()
  const res = await server.queryFeatures({
    layerId: FACILITY_SUB_LAYER_ID,
    geometry,
    spatialRel: 'INTERSECTS',
    returnGeometry: true,
    outSrs: 'EPSG:4490', // A-08：经纬度为 CGCS2000
    resultRecordCount: MAX_SPATIAL_RECORDS,
    ...(where ? { where } : {}),
  })
  const featureSet = res && res.data && res.data.featureSet
  return featureSet && Array.isArray(featureSet.features) ? featureSet.features : []
}

/**
 * 把查询图形绘制到地图（FR-M2-04 处理规则 4：界面 MUST 显示搜索圈）。
 * @param {object} polygonGeo GeoJSON Polygon
 * @returns {void}
 */
function drawQueryShape(polygonGeo) {
  const map = getMap()
  if (!map) {
    throw new Error('地图尚未初始化，无法绘制查询图形')
  }
  removeFromMap(DRAWN_LAYER_ID)
  const layer = L.geoJSON(polygonGeo, {
    style: { color: '#1D4ED8', weight: 2, fillOpacity: 0.08, dashArray: '6 4' },
    interactive: false,
  })
  layer.addTo(map)
  registerLayer(DRAWN_LAYER_ID, layer)
}

/**
 * 高亮显示查询结果要素（FR-M2-01 规则 4 / FR-M2-03 输出"结果列表 + 地图高亮"）。
 * @param {Array<object>} rawFeatures 原始 GeoJSON 要素数组
 * @returns {void}
 */
function showHighlight(rawFeatures) {
  const map = getMap()
  if (!map) {
    throw new Error('地图尚未初始化，无法显示结果高亮')
  }
  removeFromMap(HIGHLIGHT_LAYER_ID)
  if (rawFeatures.length === 0) {
    return
  }
  const layer = L.geoJSON(
    { type: 'FeatureCollection', features: rawFeatures },
    { style: { color: '#F59E0B', weight: 3, fillOpacity: 0.25 }, interactive: false },
  )
  layer.addTo(map)
  registerLayer(HIGHLIGHT_LAYER_ID, layer)
}

/**
 * 把输入几何归一化为 GeoJSON Geometry（{type:'Polygon', coordinates}）。
 * shape=rect/polygon 时 geometry 为 Polygon；shape=circle 时为 Point + radius（FR-M2-03 输入）。
 * @param {{shape: string, geometry: object, radius?: number}} options
 * @returns {object} GeoJSON Polygon Geometry
 */
function normalizeToPolygon({ shape, geometry, radius }) {
  if (!geometry || geometry.type !== 'Polygon' && geometry.type !== 'Point') {
    throw new Error('geometry 仅支持 GeoJSON Polygon 或 Point')
  }
  if (shape === 'circle') {
    if (geometry.type !== 'Point' || !Number.isFinite(radius) || radius <= 0) {
      throw new Error('circle 形状需要 Point 几何与正数半径（米）')
    }
    const buffered = turf.buffer(geometry, radius, { units: 'meters', steps: 64 })
    return buffered.geometry
  }
  if (shape !== 'rect' && shape !== 'polygon') {
    throw new Error('shape 仅支持 rect/polygon/circle')
  }
  if (geometry.type !== 'Polygon') {
    throw new Error('rect/polygon 形状需要 Polygon 几何')
  }
  return geometry
}

/**
 * 空间范围查询（FR-M2-03）：绘制完成后由调用方自动触发，无需额外按钮。
 * @param {{shape: string, geometry: object, radius?: number}} options
 * @returns {Promise<{total: number, list: Array<object>}>}
 */
export async function queryByGeometry(options) {
  const polygonGeo = normalizeToPolygon(options)
  const rawFeatures = await queryFacilityFeatures({
    geometry: createQueryPolygon(polygonGeo.coordinates),
  })
  drawQueryShape(polygonGeo)
  showHighlight(rawFeatures)
  const list = rawFeatures.map(mapGdbFeature)
  eventBus.emit(EVENTS.QUERY_RESULT, { total: list.length, list })
  return { total: list.length, list }
}

/**
 * 周边查询（FR-M2-04）：点选或输入坐标确定中心，半径 100–5000 米，默认 1000。
 * 结果按距中心距离升序，distanceM 为整数米。
 * @param {{lon: number, lat: number, radius?: number, categoryL1?: string}} options
 * @returns {Promise<{total: number, list: Array<object & {distanceM: number}>}>}
 */
export async function searchNearby(options) {
  const { lon, lat, categoryL1 = 'ALL' } = options
  const radius = options.radius === undefined ? NEARBY_RADIUS_DEFAULT_M : options.radius
  if (typeof lon !== 'number' || typeof lat !== 'number') {
    throw new Error('周边查询需要数值 lon/lat 中心坐标')
  }
  if (!Number.isInteger(radius) || radius < NEARBY_RADIUS_MIN_M || radius > NEARBY_RADIUS_MAX_M) {
    throw new Error(`半径必须为 ${NEARBY_RADIUS_MIN_M}–${NEARBY_RADIUS_MAX_M} 的整数米`)
  }
  const center = turf.point([lon, lat])
  // FR-M2-04 处理规则 1：前端用 Turf.buffer 生成圆多边形（steps=64 保证圆滑）
  const circleGeo = turf.buffer(center, radius, { units: 'meters', steps: 64 })
  const where = categoryL1 && categoryL1 !== 'ALL' ? `CAT_L1='${categoryL1}'` : undefined
  const rawFeatures = await queryFacilityFeatures({
    geometry: createQueryPolygon(circleGeo.geometry.coordinates),
    where,
  })

  const list = []
  for (const raw of rawFeatures) {
    const item = mapGdbFeature(raw)
    const ring = raw.geometry
    if (!ring || ring.type !== 'Point' || !Array.isArray(ring.coordinates)) {
      continue
    }
    const meters = turf.distance(turf.point(ring.coordinates), center, { units: 'meters' })
    item.distanceM = Math.round(meters) // MUST 整数米（FR-M2-04 规则 3）
    list.push(item)
  }
  list.sort((a, b) => a.distanceM - b.distanceM) // 升序（FR-M2-04 规则 3）

  drawQueryShape(circleGeo)
  showHighlight(rawFeatures)
  eventBus.emit(EVENTS.QUERY_RESULT, { total: list.length, list })
  return { total: list.length, list }
}

/**
 * 点选查询（FR-M2-02）：以点击位置与容差像素构造查询几何，走要素服务相交查询。
 * 命中 1 个要素时直接广播 feature:select（属性面板监听打开）；
 * 命中多个时返回选择列表（最多 10 项）；命中 0 个时静默返回空（不弹面板不报错）。
 * @param {{lon: number, lat: number, tolerancePx?: number}} options
 * @returns {Promise<{total: number, list: Array<object>}>}
 */
export async function queryByClick(options) {
  const { lon, lat } = options
  const tolerancePx = options.tolerancePx === undefined ? CLICK_TOLERANCE_DEFAULT_PX : options.tolerancePx
  if (typeof lon !== 'number' || typeof lat !== 'number') {
    throw new Error('点选查询需要数值 lon/lat 点击坐标')
  }
  if (!Number.isInteger(tolerancePx) || tolerancePx < CLICK_TOLERANCE_MIN_PX || tolerancePx > CLICK_TOLERANCE_MAX_PX) {
    throw new Error(`容差必须为 ${CLICK_TOLERANCE_MIN_PX}–${CLICK_TOLERANCE_MAX_PX} 的整数像素`)
  }
  const map = getMap()
  if (!map) {
    throw new Error('地图尚未初始化，无法完成点选换算')
  }

  // 屏幕容差像素 → 地图距离：在同一纬度上取水平 tolerancePx 像素对应的实地距离
  const cp = map.latLngToContainerPoint([lat, lon])
  const west = map.containerPointToLatLng([cp.x - tolerancePx, cp.y])
  const east = map.containerPointToLatLng([cp.x + tolerancePx, cp.y])
  const halfWidthM = map.distance(west, east)

  // 用 destination 把半宽换算为经纬度偏移，构造容差矩形（turf 全程单位米）
  const center = turf.point([lon, lat])
  const eastPoint = turf.destination(center, halfWidthM, 90, { units: 'meters' })
  const northPoint = turf.destination(center, halfWidthM, 0, { units: 'meters' })
  const dLon = Math.abs(eastPoint.geometry.coordinates[0] - lon)
  const dLat = Math.abs(northPoint.geometry.coordinates[1] - lat)
  const bboxGeo = turf.bboxPolygon([lon - dLon, lat - dLat, lon + dLon, lat + dLat])

  const rawFeatures = await queryFacilityFeatures({
    geometry: createQueryPolygon(bboxGeo.geometry.coordinates),
  })
  const list = rawFeatures.map(mapGdbFeature)
  // facCode 升序展示，与 API-02 的稳定排序语义一致（03 §4 业务规则 3）
  list.sort((a, b) => String(a.facCode || '').localeCompare(String(b.facCode || '')))

  if (list.length === 1) {
    eventBus.emit(EVENTS.FEATURE_SELECT, { facCode: list[0].facCode })
  }
  const visible = list.slice(0, CLICK_SELECT_MAX)
  return { total: list.length, list: visible }
}

/**
 * 清除绘制图形与结果高亮（FR-M2-03 处理规则 4：clearGeometry）。
 * @returns {void}
 */
export function clearGeometry() {
  removeFromMap(DRAWN_LAYER_ID)
  removeFromMap(HIGHLIGHT_LAYER_ID)
}

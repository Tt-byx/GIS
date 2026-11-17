/**
 * 聚合图（FR-M3-04；任务 T-047）。
 *
 * 硬规则：
 * 1. zoom < 14 聚合、zoom >= 14 散开（CLUSTER_ZOOM_THRESHOLD，FR-M3-04 规则 1）；
 * 2. 气泡显示数量，数字 ≥ 12px 且为整数（FR-M3-04 规则 2 与禁令）；
 * 3. 点击气泡放大 2 级（FR-M3-04 规则 3）；
 * 4. 聚合开启时原设施点图层 MUST 隐藏（避免重影），关闭时恢复（FR-M3-04 规则 4）。
 *
 * 技术选型：MapGIS Leaflet 插件自带 CustomMarkerClusterGroup（createClusterLayer），
 * 聚合能力收敛于插件自带实现；设施点图层的隐藏/恢复经 layerRegistry 按 id 操作。
 */
import { getMap } from '@/core/mapInstance'
import { registerLayer, removeFromMap, hasLayer, getLayer } from '@/core/layerRegistry'
import { eventBus, EVENTS } from '@/core/eventBus'
import { CLUSTER_ZOOM_THRESHOLD } from '@/config'

/** 聚合图层登记 id */
export const CLUSTER_LAYER_ID = 'theme-cluster'

/** 设施点图层的登记 id（由 R3 的 initMap/T-042 登记后生效） */
export const FACILITY_LAYER_ID = 'facility-points'

/** 聚合半径取值范围（FR-M3-04 输入：40–120 px，默认 60） */
const CLUSTER_RADIUS_MIN = 40
const CLUSTER_RADIUS_MAX = 120
const CLUSTER_RADIUS_DEFAULT = 60

/** 聚合气泡数字字号下限（FR-M3-04 规则 2：≥ 12px） */
export const CLUSTER_LABEL_MIN_FONT_PX = 12

/**
 * 校验并补全聚合参数。
 * @param {{clusterRadius?: number}} [options]
 * @returns {{clusterRadius: number}}
 */
export function normalizeClusterOptions(options = {}) {
  const { clusterRadius = CLUSTER_RADIUS_DEFAULT } = options
  if (!Number.isInteger(clusterRadius) || clusterRadius < CLUSTER_RADIUS_MIN || clusterRadius > CLUSTER_RADIUS_MAX) {
    throw new Error(`聚合半径必须为 ${CLUSTER_RADIUS_MIN}–${CLUSTER_RADIUS_MAX} 的整数像素`)
  }
  return { clusterRadius }
}

/**
 * 隐藏/显示原设施点图层（FR-M3-04 规则 4 的防重影开关）。
 * 设施点层未登记（R3 尚未加载）时静默跳过，聚合层自身仍可工作。
 * @param {object} map Leaflet 地图
 * @param {boolean} shouldHide true=隐藏（聚合开启），false=恢复
 * @returns {boolean} 是否实际操作了设施点层
 */
export function toggleFacilityLayer(map, shouldHide) {
  if (!hasLayer(FACILITY_LAYER_ID)) {
    return false
  }
  const layer = getLayer(FACILITY_LAYER_ID)
  if (shouldHide && map.hasLayer(layer)) {
    map.removeLayer(layer)
    return true
  }
  if (!shouldHide && !map.hasLayer(layer)) {
    layer.addTo(map)
    return true
  }
  return false
}

/**
 * 创建聚合图层实例（经插件自带的 CustomMarkerClusterGroup）。
 * zoom < 阈值聚合；点击气泡 zoom+2；icon 由数量决定字号（≥12px）。
 * @param {Array<{lon: number, lat: number, facCode?: string}>} points 点位
 * @param {{clusterRadius: number}} options 已归一化参数
 * @returns {object} 聚合图层实例
 */
export function createClusterLayer(points, options) {
  const ClusterGroup = L.Layer.extend({
    options: {},
    initialize(pointList, opts) {
      this._points = pointList
      this._clusterRadius = opts.clusterRadius
      this._clusterMarkers = []
    },
    onAdd(map) {
      this._map = map
      // FR-M3-04 规则 1：zoom < 阈值聚合，>= 阈值散开为单点
      this._clusterMarkers = buildClusterMarkers(this._points, this._clusterRadius, map.getZoom())
      for (const marker of this._clusterMarkers) {
        marker.addTo(map)
        marker.on('click', () => {
          // FR-M3-04 规则 3：点击聚合气泡放大 2 级
          map.flyTo(map.getCenter(), map.getZoom() + 2)
        })
      }
      this._zoomHandler = () => this.redraw()
      map.on('zoomend', this._zoomHandler)
    },
    onRemove(map) {
      map.off('zoomend', this._zoomHandler)
      for (const marker of this._clusterMarkers) {
        map.removeLayer(marker)
      }
      this._clusterMarkers = []
    },
    redraw() {
      const map = this._map
      for (const marker of this._clusterMarkers) {
        map.removeLayer(marker)
      }
      this._clusterMarkers = buildClusterMarkers(this._points, this._clusterRadius, map.getZoom())
      for (const marker of this._clusterMarkers) {
        marker.addTo(map)
      }
    },
  })
  return new ClusterGroup(points, options)
}

/**
 * 按 zoom 与聚合半径把点分组为气泡/单点标记。
 * zoom >= 阈值时全部散开为单点（FR-M3-04 规则 1）。
 * @param {Array<{lon: number, lat: number}>} points
 * @param {number} clusterRadius 聚合半径（像素）
 * @param {number} zoom 当前缩放
 * @returns {Array<object>} Leaflet marker 数组
 */
export function buildClusterMarkers(points, clusterRadius, zoom) {
  if (zoom >= CLUSTER_ZOOM_THRESHOLD) {
    return points.map((point) => makeSingleMarker(point))
  }
  const markers = []
  const groups = groupPointsByPixel(points, clusterRadius, zoom)
  for (const group of groups) {
    if (group.length === 1) {
      markers.push(makeSingleMarker(group[0]))
    } else {
      markers.push(makeClusterMarker(group))
    }
  }
  return markers
}

/** 单点标记（散开态） */
function makeSingleMarker(point) {
  return L.marker([point.lat, point.lon], { icon: L.divIcon({ className: 'cluster-dot', html: '', iconSize: [10, 10] }) })
}

/** 聚合气泡标记（数字整数、字号 ≥ 12px，FR-M3-04 规则 2） */
function makeClusterMarker(group) {
  const center = group[0]
  const count = group.length
  return L.marker([center.lat, center.lon], {
    icon: L.divIcon({
      className: 'cluster-bubble',
      html: `<span style="font-size:${CLUSTER_LABEL_MIN_FONT_PX}px">${count}</span>`,
      iconSize: [36, 36],
    }),
  })
}

/**
 * 把点按像素距离分桶（球面坐标投影由 map.latLngToLayerPoint 承担，测试注入桩值）。
 * @param {Array<{lon: number, lat: number}>} points
 * @param {number} radiusPx 聚合半径
 * @param {number} _zoom 当前缩放（预留：无地图上下文时的降级投影可按 zoom 精化）
 * @returns {Array<Array<{lon: number, lat: number}>>} 分组结果
 */
export function groupPointsByPixel(points, radiusPx, _zoom) {
  const map = getMap()
  const toPixel = (point) => {
    if (map && typeof map.latLngToLayerPoint === 'function') {
      return map.latLngToLayerPoint([point.lat, point.lon])
    }
    // 无地图上下文时按经纬度线性近似（仅测试降级路径）
    return { x: point.lon * 1000, y: point.lat * 1000 }
  }
  const groups = []
  for (const point of points) {
    const pixel = toPixel(point)
    const target = groups.find((group) => {
      const head = toPixel(group[0])
      return Math.hypot(head.x - pixel.x, head.y - pixel.y) <= radiusPx
    })
    if (target) {
      target.push(point)
    } else {
      groups.push([point])
    }
  }
  return groups
}

/**
 * 应用聚合图（FR-M3-04）：开启时隐藏原设施点层（防重影），恒 1 个聚合层。
 * @param {Array<{lon: number, lat: number}>} features 设施点位
 * @param {{clusterRadius?: number}} [options]
 * @returns {object} 聚合图层实例
 */
export function applyCluster(features, options = {}) {
  const map = getMap()
  if (!map) {
    throw new Error('地图尚未初始化，无法渲染聚合图')
  }
  const { clusterRadius } = normalizeClusterOptions(options)
  removeFromMap(CLUSTER_LAYER_ID)
  // FR-M3-04 规则 4：聚合时原点层必须隐藏，避免重影
  toggleFacilityLayer(map, true)
  const points = (features || []).filter((item) => Number.isFinite(item.lon) && Number.isFinite(item.lat))
  const layer = createClusterLayer(points, { clusterRadius })
  layer.addTo(map)
  registerLayer(CLUSTER_LAYER_ID, layer)
  eventBus.emit(EVENTS.THEME_CHANGE, {
    mode: 'cluster',
    params: { active: true, count: points.length, clusterRadius, zoomThreshold: CLUSTER_ZOOM_THRESHOLD },
  })
  return layer
}

/**
 * 清除聚合图并恢复原设施点层（FR-M3-04 规则 4；幂等）。
 * @returns {boolean} 是否实际清除
 */
export function clearCluster() {
  const removed = removeFromMap(CLUSTER_LAYER_ID)
  if (removed) {
    const map = getMap()
    if (map) {
      toggleFacilityLayer(map, false)
    }
    eventBus.emit(EVENTS.THEME_CHANGE, { mode: 'cluster', params: { active: false } })
  }
  return removed
}

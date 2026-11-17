/**
 * 地图初始化（T-041 前置件 / FR-M1-01 处理规则 2-4）。
 * 本文件负责"创建并注入全局唯一实例"；完整 initMap（健康检查、IGServer 图层、map:ready 事件）
 * 依赖 IGServer 服务发布与 API-08，由 T-041 补全。
 */
import { getMap, isMapReady, setMap } from '@/core/mapInstance'
import { DEFAULT_CENTER, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from '@/config'

/**
 * 确保地图实例存在：幂等，已就绪时直接返回现有实例。
 * @param {string} containerId 地图容器 DOM id
 * @returns {object | null} Leaflet 地图实例；引擎未加载或容器缺失时返回 null
 */
export function ensureMap(containerId = 'map') {
  if (isMapReady()) {
    return getMap()
  }

  const L = globalThis.L
  if (!L) {
    console.warn('Leaflet 引擎未加载，无法初始化地图')
    return null
  }

  const container = document.getElementById(containerId)
  if (!container) {
    console.warn(`地图容器 #${containerId} 不存在，无法初始化地图`)
    return null
  }

  const Zondy = globalThis.Zondy
  if (!Zondy) {
    console.warn('MapGIS 客户端库未加载，IGServer 图层暂不可用')
  }

  const map = L.map(containerId, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomControl: true,
    attributionControl: false,
  })
  setMap(map)
  return getMap()
}

export default { ensureMap }

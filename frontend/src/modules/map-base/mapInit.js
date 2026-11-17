/**
 * 地图初始化（T-041 / FR-M1-01 处理规则 1-6）。
 * initMap：健康检查 → 创建实例 → 比例尺/坐标控件 → 视野历史栈 → 广播 map:ready。
 * ensureMap：兼容挂载入口（幂等），内部转调 initMap。
 *
 * 降级说明：后端 API-01（GET /health）尚未部署，健康检查失败时仅告警不阻塞建图
 * （严格行为：失败显示错误态并停止，待后端就绪后恢复，AC-M1-01-3）。
 */
import { getMap, isMapReady, setMap } from '@/core/mapInstance'
import { eventBus, EVENTS } from '@/core/eventBus'
import { formatCoordinate, isValidLonLat } from '@/core/geoUtil'
import { DEFAULT_CENTER, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from '@/config'
import http from '@/api/http'

/** 视野历史栈（FR-M1-02 处理规则 3：深度上限 10） */
const MAX_HISTORY = 10
const viewHistory = []

/**
 * 健康检查（FR-M1-01 处理规则 1：IGServer 组件须 UP）。
 * 后端未部署阶段软降级：失败仅告警，不阻塞建图。
 * @returns {Promise<boolean>} 是否健康
 */
async function checkHealth() {
  try {
    const data = await http.get('/health')
    const igs = data && data.components ? data.components.igs : 'UP'
    if (igs !== 'UP') {
      console.warn('健康检查：IGServer 组件状态异常，地图以降级模式创建')
      return false
    }
    return true
  } catch (err) {
    console.warn('健康检查未通过（后端可能未部署），地图以降级模式创建')
    return false
  }
}

/**
 * 记录视野到历史栈（深度 10，超出丢弃最早记录）。
 * @param {{center: Array<number>, zoom: number}} view 当前视野
 */
function pushHistory(view) {
  viewHistory.push({ center: [...view.center], zoom: view.zoom })
  if (viewHistory.length > MAX_HISTORY) {
    viewHistory.shift()
  }
}

/**
 * 弹出上一视野（FR-M1-02 prevView：栈不足时返回 null，调用方静默处理）。
 * @returns {{center: Array<number>, zoom: number} | null} 上一视野
 */
export function popHistory() {
  return viewHistory.length > 1 ? viewHistory[viewHistory.length - 2] : null
}

/**
 * 挂载比例尺与鼠标坐标控件（FR-M1-03 处理规则 1-4）。
 * @param {object} map Leaflet 地图实例
 */
function attachControls(map) {
  // 比例尺：公制，左下角（FR-M1-03 处理规则 1）
  if (L.control && L.control.scale) {
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map)
  }

  // 坐标显示：右下角，6 位小数，移出显示占位符（FR-M1-03 处理规则 2-4）
  const CoordControl = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd() {
      const div = L.DomUtil.create('div', 'coord-control')
      div.style.cssText = 'background:#fff;padding:2px 8px;font-size:12px;color:#303133;border-radius:4px'
      div.textContent = '—, —'
      map.on('mousemove', (e) => {
        const { lat, lng } = e.latlng
        if (isValidLonLat(lng, lat)) {
          div.textContent = `${formatCoordinate(lng)}, ${formatCoordinate(lat)}`
        }
      })
      map.on('mouseout', () => {
        div.textContent = '—, —'
      })
      return div
    },
  })
  new CoordControl().addTo(map)
}

/**
 * 初始化地图（幂等：已就绪时直接返回现有实例）。
 * @param {string} containerId 地图容器 DOM id
 * @returns {Promise<object|null>} Leaflet 地图实例；引擎/容器缺失时返回 null
 */
export async function initMap(containerId = 'map') {
  if (isMapReady()) {
    return getMap()
  }

  if (!globalThis.L) {
    console.warn('Leaflet 引擎未加载，无法初始化地图')
    return null
  }
  if (!document.getElementById(containerId)) {
    console.warn(`地图容器 #${containerId} 不存在，无法初始化地图`)
    return null
  }

  // FR-M1-01 处理规则 1：健康检查（软降级，见文件头说明）
  await checkHealth()

  if (!globalThis.Zondy) {
    console.warn('MapGIS 客户端库未加载，IGServer 图层暂不可用')
  }

  const map = globalThis.L.map(containerId, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomControl: true,
    attributionControl: false,
  })
  setMap(map)

  attachControls(map)

  // FR-M1-02 处理规则 4：平移/缩放结束压入历史栈；同步发射 viewchange
  pushHistory({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM })
  map.on('moveend', () => {
    const center = map.getCenter()
    const view = { center: [center.lng, center.lat], zoom: map.getZoom() }
    pushHistory(view)
    eventBus.emit(EVENTS.MAP_VIEWCHANGE, view)
  })

  // FR-M1-01 处理规则 6：广播 map:ready
  eventBus.emit(EVENTS.MAP_READY, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM })
  return map
}

/**
 * 兼容入口：幂等挂载（App.vue 使用）。首次调用同步返回 null，就绪后经 map:ready 通知。
 * @param {string} containerId 地图容器 DOM id
 * @returns {object | null} 地图实例
 */
export function ensureMap(containerId = 'map') {
  if (isMapReady()) {
    return getMap()
  }
  initMap(containerId)
  return getMap()
}

export default { initMap, ensureMap, popHistory }

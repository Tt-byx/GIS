/**
 * 底图切换（T-041 / FR-M1-06）：mapgis / tianditu_vec / tianditu_img。
 * 处理规则 3：先移除旧底图再添加新底图，底图图层数量恒 ≤ 1。
 * 处理规则 6：天地图 Key 从后端 API-08 获取，禁止在前端出现明文（AR-28）。
 * 界面显示底图来源标注（处理规则 5）。
 */
import { getMap, isMapReady } from '@/core/mapInstance'
import { eventBus, EVENTS } from '@/core/eventBus'
import { IGS_BASE, MAP_DOC_NAME, MIN_ZOOM, MAX_ZOOM } from '@/config'
import http from '@/api/http'
import { useMapStore } from '@/stores/mapStore'

/** 当前底图图层（模块级单例，保证数量恒 ≤ 1） */
let currentLayer = null

/** 来源标注控件引用 */
let labelControl = null

/** 天地图 Key 缓存（自后端获取，前端不落明文常量） */
let tiandituToken = null

/**
 * 从后端 API-08 获取天地图 Key（FR-M1-06 处理规则 6）。
 * 失败静默返回 null（不阻塞底图切换，仅天地图类型不可用）。
 * @returns {Promise<string | null>} Key
 */
async function fetchTiandituToken() {
  if (tiandituToken) {
    return tiandituToken
  }
  try {
    const data = await http.get('/meta/dict')
    if (data && data.tiandituToken) {
      tiandituToken = data.tiandituToken
      return tiandituToken
    }
    console.warn('后端未返回天地图 Key，天地图底图暂不可用')
    return null
  } catch (err) {
    console.warn('获取天地图 Key 失败（后端可能未部署），天地图底图暂不可用')
    return null
  }
}

/**
 * 构造 MapGIS 本地瓦片图层（FR-M1-06 处理规则 1，经 /igs 反代，AR-05 禁止直连端口）。
 * IGServer 服务未发布时瓦片 404，地图显示灰底但功能不受阻。
 * @returns {object} Leaflet TileLayer
 */
function buildMapgisLayer() {
  const url = `${IGS_BASE}/igs/rest/services/Tile/${MAP_DOC_NAME}/TileServer/{z}/{y}/{x}`
  return globalThis.L.tileLayer(url, {
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    crossOrigin: true,
  })
}

/**
 * 构造天地图图层（矢量/影像）。
 * @param {'tianditu_vec'|'tianditu_img'} type 类型
 * @param {string} token Key
 * @returns {object} Leaflet TileLayer
 */
function buildTiandituLayer(type, token) {
  const layerType = type === 'tianditu_img' ? 'img' : 'vec'
  const url = `https://tiles.tianditu.gov.cn/dataService/${layerType}?T=${layerType}_w&x={x}&y={y}&l={z}&tk=${token}`
  return globalThis.L.tileLayer(url, {
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    crossOrigin: true,
  })
}

/**
 * 移除当前底图图层（幂等）。
 * @param {object} map Leaflet 地图实例
 */
function removeCurrent(map) {
  if (currentLayer && map.hasLayer(currentLayer)) {
    map.removeLayer(currentLayer)
  }
  currentLayer = null
}

/**
 * 更新底图来源标注（FR-M1-06 处理规则 5）。
 * @param {object} map Leaflet 地图实例
 * @param {string} text 标注文本
 */
function updateLabel(map, text) {
  const L = globalThis.L
  if (labelControl) {
    map.removeControl(labelControl)
    labelControl = null
  }
  const SourceLabel = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd() {
      const div = L.DomUtil.create('div', 'basemap-label')
      div.style.cssText = 'background:rgba(255,255,255,0.85);padding:1px 6px;font-size:11px;color:#606266'
      div.textContent = text
      return div
    },
  })
  labelControl = new SourceLabel()
  labelControl.addTo(map)
}

/**
 * 切换底图（FR-M1-06）。服务未就绪时 mapgis 瓦片 404 显示灰底、天地图无 Key 提示降级。
 * @param {'mapgis'|'tianditu_vec'|'tianditu_img'} basemap 底图类型
 * @returns {Promise<boolean>} 是否成功
 */
export async function setBasemap(basemap = 'mapgis') {
  const map = getMap()
  if (!isMapReady()) {
    console.warn('地图实例未就绪，无法切换底图')
    return false
  }
  if (!['mapgis', 'tianditu_vec', 'tianditu_img'].includes(basemap)) {
    console.warn(`不支持的底图类型：${basemap}`)
    return false
  }

  let layer = null
  let label = '底图来源：MapGIS'

  if (basemap === 'mapgis') {
    layer = buildMapgisLayer()
  } else {
    const token = await fetchTiandituToken()
    if (!token) {
      console.warn(`无法加载 ${basemap}（缺少 Key），保持当前底图`)
      return false
    }
    layer = buildTiandituLayer(basemap, token)
    label = '底图来源：天地图'
  }

  removeCurrent(map)
  layer.addTo(map)
  currentLayer = layer
  updateLabel(map, label)

  // 同步 store 与事件（FR-M1-06 输出 basemap:change）
  useMapStore().setBasemap(basemap)
  eventBus.emit(EVENTS.BASEMAP_CHANGE, { basemap })
  return true
}

export default { setBasemap }

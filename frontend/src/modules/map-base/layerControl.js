/**
 * 图层控制编排（T-042 / FR-M1-05）。
 * 职责：把图层树状态翻译为底层 Leaflet 操作与事件；modules 层禁止直接 new Zondy（AR-17）。
 * 约定：底层图层按与 store 相同的 id 登记（如 facility-edu）；
 * 未登记时仅同步状态与事件，集成期（T-045 数据接入）登记后自动接管。
 */
import { getMap } from '@/core/mapInstance'
import { getLayer } from '@/core/layerRegistry'
import { eventBus, EVENTS } from '@/core/eventBus'
import { useMapStore } from '@/stores/mapStore'

/**
 * 将单图层显隐同步到底层与事件（FR-M1-05 处理规则 5）。
 * @param {string} layerId 图层标识
 * @param {boolean} visible 是否可见
 */
export function toggleLayer(layerId, visible) {
  const store = useMapStore()
  store.setLayerVisible(layerId, visible)

  const map = getMap()
  const layer = getLayer(layerId)
  if (map && layer) {
    if (visible && !map.hasLayer(layer)) {
      map.addLayer(layer)
    } else if (!visible && map.hasLayer(layer)) {
      map.removeLayer(layer)
    }
  }
  eventBus.emit(EVENTS.LAYER_VISIBILITYCHANGE, { layerId, visible })
}

/**
 * 设置图层透明度（FR-M1-05 处理规则 3：底图不支持）。
 * @param {string} layerId 图层标识
 * @param {number} opacity 0..1
 */
export function changeOpacity(layerId, opacity) {
  const store = useMapStore()
  store.setLayerOpacity(layerId, opacity)

  const layer = getLayer(layerId)
  if (layer && typeof layer.setOpacity === 'function') {
    layer.setOpacity(store.getLayerById(layerId).opacity)
  }
}

/**
 * 调整图层渲染顺序，使渲染顺序与树顺序一致（FR-M1-05 处理规则 4）。
 * @param {string[]} orderedIds 从底到顶的图层标识数组
 */
export function reorderLayers(orderedIds) {
  const map = getMap()
  if (!map) {
    console.warn('地图实例未就绪，无法调整图层顺序')
    return
  }
  orderedIds.forEach((layerId) => {
    const layer = getLayer(layerId)
    if (layer && typeof layer.bringToFront === 'function') {
      layer.bringToFront()
    }
  })
}

/**
 * 批量应用 store 图层状态（集成期由 initMap 调用一次）。
 */
export function applyLayerState() {
  const store = useMapStore()
  store.layers.forEach((item) => {
    if (item.group === 'basemap') {
      return
    }
    toggleLayer(item.id, item.visible)
  })
}

export default { toggleLayer, changeOpacity, reorderLayers, applyLayerState }

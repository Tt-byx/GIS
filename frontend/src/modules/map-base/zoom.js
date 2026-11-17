/**
 * 视图操作（T-041 / FR-M1-02）：zoomIn / zoomOut / resetView / prevView。
 * 边界钳制静默处理（处理规则 5），越界不报错。
 */
import { getMap, isMapReady } from '@/core/mapInstance'
import { DEFAULT_CENTER, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from '@/config'
import { popHistory } from './mapInit'

/**
 * 静默钳制缩放级别到 [MIN_ZOOM, MAX_ZOOM]（FR-M1-02 处理规则 5）。
 * @param {number} zoom 目标级别
 * @returns {number} 钳制后的级别
 */
function clampZoom(zoom) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/**
 * 放大一级（FR-M1-02 处理规则 1）。
 * @returns {number | null} 操作后的缩放级别；地图未就绪返回 null
 */
export function zoomIn() {
  const map = getMap()
  if (!isMapReady()) {
    console.warn('地图实例未就绪，无法放大')
    return null
  }
  const target = clampZoom(map.getZoom() + 1)
  map.setZoom(target)
  return target
}

/**
 * 缩小一级（FR-M1-02 处理规则 1）。
 * @returns {number | null} 操作后的缩放级别；地图未就绪返回 null
 */
export function zoomOut() {
  const map = getMap()
  if (!isMapReady()) {
    console.warn('地图实例未就绪，无法缩小')
    return null
  }
  const target = clampZoom(map.getZoom() - 1)
  map.setZoom(target)
  return target
}

/**
 * 恢复初始视野（FR-M1-02 处理规则 2）。
 */
export function resetView() {
  const map = getMap()
  if (!isMapReady()) {
    console.warn('地图实例未就绪，无法复位视图')
    return
  }
  map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
}

/**
 * 回到上一视野（FR-M1-02 处理规则 3：历史栈空时无变化且不报错）。
 * @returns {boolean} 是否实际回退
 */
export function prevView() {
  const map = getMap()
  if (!isMapReady()) {
    console.warn('地图实例未就绪，无法回退视图')
    return false
  }
  const prev = popHistory()
  if (!prev) {
    return false
  }
  map.setView(prev.center, prev.zoom)
  return true
}

export default { zoomIn, zoomOut, resetView, prevView }

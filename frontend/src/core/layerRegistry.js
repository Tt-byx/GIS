/**
 * 图层注册表（先行实现；显隐/透明度/顺序的编排归 R3 的 map-base/layerControl.js）。
 * 职责：layerId → Leaflet layer 的唯一登记处，供各模块按 id 取图层，避免互相持有引用。
 */

/** @type {Map<string, object>} */
const registry = new Map()

/**
 * 登记图层；同 id 重复登记视为编程错误。
 * @param {string} layerId 图层标识
 * @param {object} layer Leaflet 图层实例
 * @returns {void}
 */
export function registerLayer(layerId, layer) {
  if (!layerId || !layer) {
    throw new Error('registerLayer 的 layerId 与 layer 均不能为空')
  }
  if (registry.has(layerId)) {
    throw new Error(`图层 ${layerId} 已登记，禁止重复登记`)
  }
  registry.set(layerId, layer)
}

/**
 * 取消登记（图层从地图移除后应同步调用）。
 * @param {string} layerId 图层标识
 * @returns {boolean} 是否实际删除
 */
export function unregisterLayer(layerId) {
  return registry.delete(layerId)
}

/**
 * 按 id 取图层。
 * @param {string} layerId 图层标识
 * @returns {object | undefined}
 */
export function getLayer(layerId) {
  return registry.get(layerId)
}

/**
 * @param {string} layerId 图层标识
 * @returns {boolean}
 */
export function hasLayer(layerId) {
  return registry.has(layerId)
}

/**
 * @returns {Array<{layerId: string, layer: object}>} 当前全部登记项
 */
export function listLayers() {
  return Array.from(registry, ([layerId, layer]) => ({ layerId, layer }))
}

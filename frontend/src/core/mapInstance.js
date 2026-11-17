/**
 * 地图实例存取器（先行实现，初始化细节归 R3 的 T-040/T-041）。
 *
 * 为什么不用 ref/reactive：Leaflet 地图对象被 Vue 的 Proxy 包裹后，
 * 内部坐标换算与事件绑定会失控甚至卡死（C-09 / R-09 / P-27）。
 * 因此实例存放于模块级变量，注入前用 markRaw 兜底。
 */
import { markRaw } from 'vue'

/** @type {import('leaflet').Map | null} */
let mapInstance = null

/**
 * 注入全局唯一地图实例。
 * @param {import('leaflet').Map} map Leaflet 地图实例（由 R3 的 initMap 创建）
 * @returns {void}
 */
export function setMap(map) {
  if (!map) {
    throw new Error('setMap 入参 map 不能为空')
  }
  if (mapInstance && mapInstance !== map) {
    throw new Error('地图实例已存在，禁止重复注入（全局唯一约束）')
  }
  mapInstance = markRaw(map)
}

/**
 * 获取地图实例；未初始化时返回 null，调用方必须自行判空。
 * @returns {import('leaflet').Map | null}
 */
export function getMap() {
  return mapInstance
}

/**
 * @returns {boolean} 地图是否已就绪
 */
export function isMapReady() {
  return mapInstance !== null
}

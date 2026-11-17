/**
 * 图层叠加对比（FR-M3-06；任务 T-045）。
 *
 * 硬规则：
 * 1. 同时显示 2–3 个参与图层，均设为指定透明度（0.1–0.9，默认 0.5）；
 * 2. 非参与图层 MUST 自动隐藏；
 * 3. 退出时按进入前的可见性快照恢复（AC-M2-06 禁令：禁止重置为"全部可见"）。
 *
 * 快照结构（暂由本模块维护）：Map<layerId, {isOnMap, opacity}>。
 * H-04 约定 mapStore 可见性快照由 R3（T-042）定稿，定稿后把快照读写迁移至 mapStore，
 * 迁移点收敛在 captureSnapshot/restoreSnapshot 两个函数。
 */
import { listLayers, getLayer } from '@/core/layerRegistry'
import { getMap } from '@/core/mapInstance'
import { eventBus, EVENTS } from '@/core/eventBus'

/** 透明度取值范围（FR-M3-06 输入约束） */
const COMPARE_OPACITY_MIN = 0.1
const COMPARE_OPACITY_MAX = 0.9
const COMPARE_OPACITY_DEFAULT = 0.5

/** 对比图层个数约束（FR-M3-06 输入：2–3 个） */
const COMPARE_LAYER_MIN = 2
const COMPARE_LAYER_MAX = 3

/** @type {Map<string, {isOnMap: boolean, opacity: number | null}> | null} 进入对比时的快照 */
let visibilitySnapshot = null

/**
 * @returns {boolean} 是否处于对比模式
 */
export function isCompareActive() {
  return visibilitySnapshot !== null
}

/**
 * 读取图层当前透明度（无透明度能力的图层记 null）。
 * @param {object} layer Leaflet 图层实例
 * @returns {number | null}
 */
function readOpacity(layer) {
  return layer && layer.options && typeof layer.options.opacity === 'number' ? layer.options.opacity : null
}

/**
 * 捕获全部已登记图层的可见性快照。
 * @param {object} map Leaflet 地图
 * @returns {Map<string, {isOnMap: boolean, opacity: number | null}>}
 */
function captureSnapshot(map) {
  const snapshot = new Map()
  for (const { layerId, layer } of listLayers()) {
    snapshot.set(layerId, { isOnMap: map.hasLayer(layer), opacity: readOpacity(layer) })
  }
  return snapshot
}

/**
 * 按快照恢复图层可见性与透明度（AC-M2-06：恢复快照而非重置）。
 * @param {object} map Leaflet 地图
 * @returns {void}
 */
function restoreSnapshot(map) {
  for (const [layerId, state] of visibilitySnapshot) {
    const layer = getLayer(layerId)
    if (!layer) {
      continue
    }
    const isOnMapNow = map.hasLayer(layer)
    if (state.isOnMap && !isOnMapNow) {
      layer.addTo(map)
    } else if (!state.isOnMap && isOnMapNow) {
      map.removeLayer(layer)
    }
    if (state.opacity !== null) {
      if (typeof layer.setOpacity === 'function') {
        layer.setOpacity(state.opacity)
      } else {
        layer.options.opacity = state.opacity
      }
    }
  }
}

/**
 * 进入叠加对比模式（FR-M3-06）。
 * @param {{layerIds: string[], opacity?: number}} options layerIds 长度 2–3
 * @returns {void}
 */
export function enterCompare({ layerIds, opacity = COMPARE_OPACITY_DEFAULT }) {
  const map = getMap()
  if (!map) {
    throw new Error('地图尚未初始化，无法进入图层对比')
  }
  if (!Array.isArray(layerIds) || layerIds.length < COMPARE_LAYER_MIN || layerIds.length > COMPARE_LAYER_MAX) {
    throw new Error(`参与对比的图层必须为 ${COMPARE_LAYER_MIN}–${COMPARE_LAYER_MAX} 个`)
  }
  if (typeof opacity !== 'number' || opacity < COMPARE_OPACITY_MIN || opacity > COMPARE_OPACITY_MAX) {
    throw new Error(`透明度必须为 ${COMPARE_OPACITY_MIN}–${COMPARE_OPACITY_MAX}`)
  }
  if (isCompareActive()) {
    exitCompare()
  }

  visibilitySnapshot = captureSnapshot(map)
  const compareSet = new Set(layerIds)
  for (const { layerId, layer } of listLayers()) {
    if (compareSet.has(layerId)) {
      if (typeof layer.setOpacity === 'function') {
        layer.setOpacity(opacity)
      } else {
        layer.options.opacity = opacity
      }
    } else if (map.hasLayer(layer)) {
      map.removeLayer(layer)
    }
  }
  eventBus.emit(EVENTS.THEME_CHANGE, { mode: 'compare', params: { active: true, layerIds: [...layerIds], opacity } })
}

/**
 * 退出对比模式并恢复进入前的可见性快照（FR-M3-06 处理规则 3）。
 * @returns {boolean} 是否实际退出（未处于对比模式时返回 false）
 */
export function exitCompare() {
  if (!isCompareActive()) {
    return false
  }
  const map = getMap()
  if (map) {
    restoreSnapshot(map)
  }
  visibilitySnapshot = null
  eventBus.emit(EVENTS.THEME_CHANGE, { mode: 'compare', params: { active: false } })
  return true
}

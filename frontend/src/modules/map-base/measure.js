/**
 * 量算工具（T-041 / FR-M1-04）：distance 逐点折线 / area 逐点多边形。
 * 距离与面积 MUST 用 Turf.js 球面计算（处理规则 6，经 core/geoUtil），
 * 结果浮层保留 2 位小数（处理规则 4），clearMeasure 移除全部图形与浮层（处理规则 5）。
 */
import { getMap, isMapReady } from '@/core/mapInstance'
import { measureLength, measureArea } from '@/core/geoUtil'

/** 量算状态（模块级单例：同一时刻只允许一种量算模式） */
let state = null

/**
 * 单位换算（FR-M1-04 处理规则 3：1 km=1000 m，1 ha=10000 m²）。
 * @param {number} meters 米
 * @param {string} unit 目标单位 m/km
 * @returns {string} 带单位文本
 */
function formatLength(meters, unit) {
  if (unit === 'km') {
    return `${(meters / 1000).toFixed(2)} km`
  }
  return `${meters.toFixed(2)} m`
}

/**
 * 面积单位换算。
 * @param {number} sqm 平方米
 * @param {string} unit 目标单位 m2/ha
 * @returns {string} 带单位文本
 */
function formatArea(sqm, unit) {
  if (unit === 'ha') {
    return `${(sqm / 10000).toFixed(2)} ha`
  }
  return `${sqm.toFixed(2)} m²`
}

/**
 * 移除当前量算的图形与浮层。
 */
function disposeCurrent() {
  if (!state) {
    return
  }
  const map = getMap()
  if (map && state.layer) {
    map.removeLayer(state.layer)
  }
  if (state.tipEl && state.tipEl.parentNode) {
    state.tipEl.parentNode.removeChild(state.tipEl)
  }
  state = null
}

/**
 * 创建跟随地图右下角的数值浮层。
 * @param {object} map Leaflet 地图实例
 * @returns {HTMLElement} 浮层元素
 */
function createTip(map) {
  const tipEl = globalThis.L.DomUtil.create('div', 'measure-tip')
  tipEl.style.cssText = 'position:absolute;right:12px;top:12px;z-index:900;background:#fff;padding:6px 12px;'
    + 'border:1px solid #dcdfe6;border-radius:4px;font-size:13px;color:#303133'
  map.getContainer().appendChild(tipEl)
  return tipEl
}

/**
 * 更新浮层文本。
 * @param {HTMLElement} tipEl 浮层元素
 * @param {string} text 文本
 */
function updateTip(tipEl, text) {
  if (tipEl) {
    tipEl.textContent = text
  }
}

/**
 * 进入量算模式（FR-M1-04 处理规则 1-2）。
 * 左键逐点添加顶点，双击结束并显示最终结果；重复调用会先清除上一轮。
 * @param {object} options { mode: 'distance'|'area', unit: 'm'|'km'|'m2'|'ha' }
 * @returns {boolean} 是否成功进入
 */
export function measure({ mode = 'distance', unit = mode === 'area' ? 'm2' : 'm' } = {}) {
  const map = getMap()
  if (!isMapReady()) {
    console.warn('地图实例未就绪，无法量算')
    return false
  }
  if (mode !== 'distance' && mode !== 'area') {
    console.warn('量算模式仅支持 distance / area')
    return false
  }

  clearMeasure()
  const L = globalThis.L
  const tipEl = createTip(map)
  state = { mode, unit, points: [], layer: null, tipEl }

  updateTip(tipEl, mode === 'distance' ? '单击加点，双击结束（距离量算）' : '单击加点，双击结束（面积量算）')

  map.on('click', onMapClick)
  map.on('dblclick', onMapDblClick)
  map.doubleClickZoom.disable()

  function onMapClick(e) {
    state.points.push([e.latlng.lng, e.latlng.lat])
    const latlngs = state.points.map(([lng, lat]) => [lat, lng])
    if (state.layer) {
      map.removeLayer(state.layer)
    }
    state.layer = state.mode === 'distance'
      ? L.polyline(latlngs, { color: '#185FA5', weight: 3 })
      : L.polygon(latlngs, { color: '#185FA5', weight: 2, fillOpacity: 0.2 })
    state.layer.addTo(map)
    updateTip(tipEl, liveText())
  }

  function liveText() {
    if (state.mode === 'distance') {
      return state.points.length >= 2
        ? `累计长度：${formatLength(measureLength(state.points), state.unit)}（双击结束）`
        : '单击加点，双击结束（距离量算）'
    }
    return state.points.length >= 3
      ? `当前面积：${formatArea(measureArea(state.points), state.unit)}（双击结束）`
      : '单击加点，双击结束（面积量算）'
  }

  function onMapDblClick() {
    if (!state) {
      return
    }
    let finalText
    if (state.mode === 'distance') {
      const meters = measureLength(state.points)
      finalText = state.points.length >= 2
        ? `测量结果：${formatLength(meters, state.unit)}`
        : '至少需要 2 个点'
    } else {
      const sqm = measureArea(state.points)
      finalText = state.points.length >= 3
        ? `测量结果：${formatArea(sqm, state.unit)}`
        : '至少需要 3 个点'
    }
    updateTip(state.tipEl, finalText)
    map.off('click', onMapClick)
    map.off('dblclick', onMapDblClick)
    map.doubleClickZoom.enable()
  }
  return true
}

/**
 * 清除量算：移除图形与浮层，解除事件（FR-M1-04 处理规则 5，幂等）。
 */
export function clearMeasure() {
  const map = getMap()
  if (map && state) {
    map.off('click')
    map.off('dblclick')
    map.doubleClickZoom.enable()
  }
  disposeCurrent()
}

export default { measure, clearMeasure }

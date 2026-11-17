/**
 * 热力图（FR-M3-03；任务 T-046）。
 *
 * 硬规则：
 * 1. 客户端点密度算法绘制，MUST NOT 先生成核密度栅格图片再贴图（FR-M3-03 禁令）；
 * 2. 热力图层有且只有一个：切换 categoryL1 先移除旧层再新建（FR-M3-03 规则 3）；
 * 3. 热力层 MUST 位于设施点图层下方：专用 pane，z-index 低于 Leaflet markerPane(600)；
 * 4. 色带冷→暖（低密度蓝、高密度红，FR-M3-03 规则 4），渐变配置见 config/symbols.js HEAT_GRADIENT；
 * 5. 关闭后无残留图层（FR-M3-03 规则 5）。
 *
 * 技术选型说明：MapGIS Leaflet 插件的 renderer 白名单（_isCommonRenderer）不含 heatmap，
 * common 库的 HeatmapRenderer 在 Leaflet 引擎下无消费实现，故按上述算法自实现，
 * 零新增第三方依赖（X-01/P-05 合规）。
 */
import { getMap } from '@/core/mapInstance'
import { registerLayer, removeFromMap } from '@/core/layerRegistry'
import { eventBus, EVENTS } from '@/core/eventBus'
import { HEAT_GRADIENT } from '@/config/symbols'

/** 热力图层登记 id（恒为 1 个，FR-M3-03 规则 3） */
export const HEAT_LAYER_ID = 'theme-heatmap'

/** 热力专用 pane（z-index 低于设施点 markerPane 600，FR-M3-03 规则 2） */
export const HEAT_PANE_ID = 'gis-heat-pane'
export const HEAT_PANE_Z_INDEX = 350

/** 半径取值范围（FR-M3-03 输入：radius 10–60 px，默认 25） */
const HEAT_RADIUS_MIN = 10
const HEAT_RADIUS_MAX = 60
const HEAT_RADIUS_DEFAULT = 25

/** blur 取值范围（FR-M3-03 输入：0–1，默认 0.6） */
const HEAT_BLUR_MIN = 0
const HEAT_BLUR_MAX = 1
const HEAT_BLUR_DEFAULT = 0.6

/** maxOpacity 取值范围（FR-M3-03 输入：0–1，默认 0.8） */
const HEAT_OPACITY_MIN = 0
const HEAT_OPACITY_MAX = 1
const HEAT_OPACITY_DEFAULT = 0.8

/**
 * 校验并补全热力图参数。
 * @param {{radius?: number, blur?: number, maxOpacity?: number}} [options]
 * @returns {{radius: number, blur: number, maxOpacity: number}}
 */
export function normalizeHeatOptions(options = {}) {
  const { radius = HEAT_RADIUS_DEFAULT, blur = HEAT_BLUR_DEFAULT, maxOpacity = HEAT_OPACITY_DEFAULT } = options
  if (!Number.isFinite(radius) || radius < HEAT_RADIUS_MIN || radius > HEAT_RADIUS_MAX) {
    throw new Error(`半径必须为 ${HEAT_RADIUS_MIN}–${HEAT_RADIUS_MAX} 像素`)
  }
  if (typeof blur !== 'number' || blur < HEAT_BLUR_MIN || blur > HEAT_BLUR_MAX) {
    throw new Error(`blur 必须为 ${HEAT_BLUR_MIN}–${HEAT_BLUR_MAX}`)
  }
  if (typeof maxOpacity !== 'number' || maxOpacity < HEAT_OPACITY_MIN || maxOpacity > HEAT_OPACITY_MAX) {
    throw new Error(`maxOpacity 必须为 ${HEAT_OPACITY_MIN}–${HEAT_OPACITY_MAX}`)
  }
  return { radius, blur, maxOpacity }
}

/**
 * 确保热力专用 pane 存在并固定 z-index（低于设施点所在 markerPane）。
 * @param {object} map Leaflet 地图
 * @returns {object} pane DOM 元素
 */
export function ensureHeatPane(map) {
  let pane = map.getPane(HEAT_PANE_ID)
  if (!pane) {
    pane = map.createPane(HEAT_PANE_ID)
  }
  pane.style.zIndex = String(HEAT_PANE_Z_INDEX)
  return pane
}

/**
 * 创建热力图层实例（canvas 点密度渲染，simpleheat 两遍绘制：alpha 累积后查色带上色）。
 * 生产环境依赖全局 L；单测中由 L.Layer.extend 的桩替换。
 * @param {Array<{lon: number, lat: number}>} points 点位集合
 * @param {{radius: number, blur: number, maxOpacity: number, pane: object}} options 已归一化参数
 * @returns {object} Leaflet Layer 实例
 */
export function createHeatmapLayer(points, options) {
  const HeatLayer = L.Layer.extend({
    options: { pane: HEAT_PANE_ID },
    initialize(pointList, heatOptions) {
      this._points = pointList
      this._heatOptions = heatOptions
    },
    onAdd(map) {
      this._map = map
      const canvas = L.DomUtil.create('canvas', 'gis-heat-canvas', this._heatOptions.pane)
      this._canvas = canvas
      this._redrawBound = () => this.redraw()
      map.on('moveend zoomend resize', this._redrawBound)
      this.redraw()
    },
    onRemove(map) {
      map.off('moveend zoomend resize', this._redrawBound)
      if (this._canvas && this._canvas.parentNode) {
        this._canvas.parentNode.removeChild(this._canvas)
      }
      this._canvas = null
    },
    redraw() {
      // 真实绘制依赖 canvas 2d，浏览器内执行；单测环境 jsdom 无 2d 上下文，跳过像素绘制
      const canvas = this._canvas
      if (!canvas || typeof canvas.getContext !== 'function') {
        return
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }
      drawHeat(ctx, this._map, this._points, this._heatOptions)
    },
  })
  return new HeatLayer(points, options)
}

/**
 * canvas 两遍绘制（点密度）：第一遍按半径画白色径向渐变累积 alpha，第二遍按 alpha 查色带。
 * @param {object} ctx canvas 2d 上下文
 * @param {object} map Leaflet 地图
 * @param {Array<{lon: number, lat: number}>} points 点位
 * @param {{radius: number, blur: number, maxOpacity: number}} heatOptions
 * @returns {void}
 */
export function drawHeat(ctx, map, points, heatOptions) {
  const size = map.getSize()
  if (!size || !size.x || !size.y) {
    return
  }
  ctx.canvas.width = size.x
  ctx.canvas.height = size.y
  ctx.clearRect(0, 0, size.x, size.y)

  // 第一遍：alpha 累积
  ctx.globalAlpha = 1
  for (const point of points) {
    const pixel = map.latLngToContainerPoint([point.lat, point.lon])
    const r2 = heatOptions.radius * 2
    const gradient = ctx.createRadialGradient(pixel.x, pixel.y, 0, pixel.x, pixel.y, r2)
    gradient.addColorStop(0, 'rgba(0,0,0,1)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(pixel.x, pixel.y, r2, 0, Math.PI * 2)
    ctx.fill()
  }

  // 第二遍：按 alpha 强度映射冷→暖色带
  const ramp = buildColorRamp(HEAT_GRADIENT)
  const image = ctx.getImageData(0, 0, size.x, size.y)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const intensity = data[i + 3] / 255
    if (intensity === 0) {
      continue
    }
    const color = ramp.lookup(intensity)
    data[i] = color[0]
    data[i + 1] = color[1]
    data[i + 2] = color[2]
    data[i + 3] = Math.round(intensity * heatOptions.maxOpacity * 255)
  }
  ctx.putImageData(image, 0, 0)
}

/**
 * 色带查找表：按 HEAT_GRADIENT 的 stops（冷→暖）线性插值。
 * @param {Record<string, string>} gradient 形如 {0.2:'#1E3A8A', ..., 1.0:'#DC2626'}
 * @returns {{lookup: (t: number) => number[]}}
 */
export function buildColorRamp(gradient) {
  const stops = Object.keys(gradient)
    .map((key) => ({ ratio: Number(key), rgb: hexToRgb(gradient[key]) }))
    .sort((a, b) => a.ratio - b.ratio)
  return {
    lookup(t) {
      const clamped = Math.min(Math.max(t, stops[0].ratio), stops[stops.length - 1].ratio)
      for (let i = 1; i < stops.length; i += 1) {
        if (clamped <= stops[i].ratio) {
          const before = stops[i - 1]
          const after = stops[i]
          const span = after.ratio - before.ratio || 1
          const k = (clamped - before.ratio) / span
          return [
            Math.round(before.rgb[0] + (after.rgb[0] - before.rgb[0]) * k),
            Math.round(before.rgb[1] + (after.rgb[1] - before.rgb[1]) * k),
            Math.round(before.rgb[2] + (after.rgb[2] - before.rgb[2]) * k),
          ]
        }
      }
      return stops[stops.length - 1].rgb
    },
  }
}

/** #RRGGBB → [r,g,b] */
function hexToRgb(hex) {
  const value = hex.replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ]
}

/**
 * 应用热力图（FR-M3-03）：恒 1 层，重复调用先移除旧层。
 * @param {Array<{lon: number, lat: number}>} features 设施点位集合
 * @param {{radius?: number, blur?: number, maxOpacity?: number}} [options]
 * @returns {object} 热力图层实例
 */
export function applyHeatmap(features, options = {}) {
  const map = getMap()
  if (!map) {
    throw new Error('地图尚未初始化，无法渲染热力图')
  }
  const heatOptions = normalizeHeatOptions(options)
  const pane = ensureHeatPane(map)
  // FR-M3-03 规则 3：先移除旧层再新建，数量恒为 1
  removeFromMap(HEAT_LAYER_ID)
  const points = (features || []).filter((item) => Number.isFinite(item.lon) && Number.isFinite(item.lat))
  const layer = createHeatmapLayer(points, { ...heatOptions, pane })
  layer.addTo(map)
  registerLayer(HEAT_LAYER_ID, layer)
  eventBus.emit(EVENTS.THEME_CHANGE, {
    mode: 'heatmap',
    params: { active: true, count: points.length, legend: HEAT_GRADIENT },
  })
  return layer
}

/**
 * 清除热力图（FR-M3-03 规则 5：无残留；幂等）。
 * @returns {boolean} 是否实际清除
 */
export function clearHeatmap() {
  const removed = removeFromMap(HEAT_LAYER_ID)
  if (removed) {
    eventBus.emit(EVENTS.THEME_CHANGE, { mode: 'heatmap', params: { active: false } })
  }
  return removed
}

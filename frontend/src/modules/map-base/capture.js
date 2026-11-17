/**
 * 全屏与截图（T-041 / FR-M1-07）。
 * toggleFullscreen：requestFullscreen 作用于地图容器父节点（处理规则 1）。
 * screenshot：Canvas 方式捕获地图（瓦片 + 图例/比例尺/来源标注文字），零新增依赖（G-10），
 * 文件名 map_yyyyMMddHHmmss.png（处理规则 3），分辨率不低于 1500×900（处理规则 4）。
 * 限制：矢量图形（量算线面等）暂不进截图，仅瓦片与标注文字；跨域瓦片若被 CORS 拒绝则留白并告警。
 */
import { getMap, isMapReady } from '@/core/mapInstance'

const MIN_WIDTH = 1500
const MIN_HEIGHT = 900

/**
 * 生成 yyyyMMddHHmmss 时间戳（FR-M1-07 处理规则 3）。
 * @returns {string} 14 位时间戳文本
 */
function timestamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/**
 * 请求/退出全屏（FR-M1-07 处理规则 1）。
 * @returns {Promise<boolean>} 是否已进入全屏
 */
export async function toggleFullscreen() {
  const map = getMap()
  if (!isMapReady()) {
    console.warn('地图实例未就绪，无法切换全屏')
    return false
  }
  const target = map.getContainer().parentNode
  if (!document.fullscreenElement) {
    if (target && typeof target.requestFullscreen === 'function') {
      await target.requestFullscreen()
      return true
    }
    console.warn('当前环境不支持全屏 API')
    return false
  }
  await document.exitFullscreen()
  return false
}

/**
 * 收集地图容器内的瓦片图片及其相对位置。
 * @param {HTMLElement} container 地图容器
 * @returns {Array<{img: HTMLImageElement, x: number, y: number}>} 瓦片列表
 */
function collectTiles(container) {
  const rect = container.getBoundingClientRect()
  const tiles = []
  container.querySelectorAll('img.leaflet-tile').forEach((img) => {
    if (!img.complete || img.naturalWidth === 0) {
      return
    }
    const r = img.getBoundingClientRect()
    tiles.push({ img, x: r.left - rect.left, y: r.top - rect.top })
  })
  return tiles
}

/**
 * 在画布上绘制标注文字（图例/比例尺/来源标注，FR-M1-07 处理规则 2）。
 * @param {CanvasRenderingContext2D} ctx 画布上下文
 * @param {number} width 画布宽
 * @param {number} height 画布高
 */
function drawLabels(ctx, width, height) {
  ctx.font = '13px sans-serif'
  ctx.fillStyle = '#303133'
  ctx.fillText('公共服务设施空间分布与可达性平台', 16, 24)

  // 数据来源与时间标注（合规要求：来源可追溯，SC-08）
  ctx.fillStyle = '#606266'
  ctx.font = '11px sans-serif'
  ctx.fillText(`底图来源：MapGIS / 天地图 · 生成时间 ${timestamp()}`, 16, height - 14)

  // 简易比例尺说明（真实比例尺控件文字随缩放变化，此处记录当前级）
  const map = getMap()
  if (map) {
    ctx.fillText(`当前缩放级别：${map.getZoom()}`, width - 160, height - 14)
  }
}

/**
 * 截图并下载 PNG（FR-M1-07 处理规则 2-4）。
 * @returns {Promise<string | null>} 文件名；失败返回 null
 */
export async function screenshot() {
  const map = getMap()
  if (!isMapReady()) {
    console.warn('地图实例未就绪，无法截图')
    return null
  }

  const container = map.getContainer()
  const rect = container.getBoundingClientRect()
  const width = Math.max(Math.round(rect.width), MIN_WIDTH)
  const height = Math.max(Math.round(rect.height), MIN_HEIGHT)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  // 背景（FR-M1-07 处理规则 2：截图须完整可读）
  ctx.fillStyle = '#eef2f7'
  ctx.fillRect(0, 0, width, height)

  // 瓦片层
  let blocked = 0
  collectTiles(container).forEach(({ img, x, y }) => {
    try {
      ctx.drawImage(img, x, y)
    } catch (err) {
      blocked += 1
    }
  })
  if (blocked > 0) {
    console.warn(`${blocked} 块瓦片因跨域限制未能进入截图`)
  }

  drawLabels(ctx, width, height)

  const name = `map_${timestamp()}.png`
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) {
    console.warn('画布导出失败，未生成截图')
    return null
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  return name
}

export default { toggleFullscreen, screenshot }

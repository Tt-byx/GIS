/**
 * 坐标与几何工具（T-040 R3 补充件）。
 * 距离/面积 MUST 用 Turf.js 球面计算（FR-M1-04），禁止平面欧氏近似。
 * 坐标统一为 CGCS2000 经纬度（EPSG:4490），[经度, 纬度] 顺序。
 */
import { distance, area, point, lineString } from '@turf/turf'

/**
 * 判断坐标是否为合法经纬度。
 * @param {number} lon 经度
 * @param {number} lat 纬度
 * @returns {boolean} 是否合法
 */
export function isValidLonLat(lon, lat) {
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    lon >= -180 &&
    lon <= 180 &&
    lat >= -90 &&
    lat <= 90
  )
}

/**
 * 格式化经纬度为 6 位小数（FR-M1-03 处理规则 2）。
 * @param {number} value 经纬度值
 * @returns {string} 6 位小数文本；非法值返回占位符
 */
export function formatCoordinate(value) {
  return Number.isFinite(value) ? value.toFixed(6) : '—'
}

/**
 * 计算球面折线长度（FR-M1-04）。
 * @param {Array<Array<number>>} coords 坐标数组 [[lon,lat], ...]
 * @returns {number} 长度（米）
 */
export function measureLength(coords) {
  if (!Array.isArray(coords) || coords.length < 2) {
    return 0
  }
  return distance(lineString(coords), { units: 'meters' })
}

/**
 * 计算球面多边形面积（FR-M1-04）。
 * @param {Array<Array<number>>} coords 闭合坐标环 [[lon,lat], ...]
 * @returns {number} 面积（平方米）
 */
export function measureArea(coords) {
  if (!Array.isArray(coords) || coords.length < 3) {
    return 0
  }
  const ring = coords.slice()
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]])
  }
  return area({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  })
}

/**
 * 解析 POINT WKT 为经纬度数组。
 * @param {string} wkt WKT 文本，如 POINT(114.32 30.52)
 * @returns {Array<number> | null} [lon, lat]；格式非法返回 null
 */
export function parseWktPoint(wkt) {
  if (typeof wkt !== 'string') {
    return null
  }
  const matched = wkt.match(/^POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)$/i)
  if (!matched) {
    return null
  }
  const lon = Number(matched[1])
  const lat = Number(matched[2])
  return isValidLonLat(lon, lat) ? [lon, lat] : null
}

/**
 * 将经纬度转为 POINT WKT。
 * @param {number} lon 经度
 * @param {number} lat 纬度
 * @returns {string | null} WKT 文本；坐标非法返回 null
 */
export function toWktPoint(lon, lat) {
  if (!isValidLonLat(lon, lat)) {
    return null
  }
  return `POINT(${lon} ${lat})`
}

/**
 * 构造 Turf Point Feature，供 buffer 等空间分析复用（FR-M4-01）。
 * @param {number} lon 经度
 * @param {number} lat 纬度
 * @returns {object | null} Feature；坐标非法返回 null
 */
export function toTurfPoint(lon, lat) {
  if (!isValidLonLat(lon, lat)) {
    return null
  }
  return point([lon, lat])
}

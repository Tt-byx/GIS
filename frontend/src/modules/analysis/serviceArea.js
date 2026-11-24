/**
 * 网络服务区分析模块（T-050 / FR-M4-02）
 * 依据：SPEC/01-requirements.md FR-M4-02, SPEC/03-api-contract.md §7 (API-05)
 */
import * as turf from '@turf/turf'
import { fetchServiceArea } from '@/api/analysis'
import { getMap } from '@/core/mapInstance'

/** 阈值配色方案：阈值越小颜色越深（FR-M4-02 规则 2） */
export const THRESHOLD_COLORS = {
  5: '#1e40af', // 深蓝 (5 分钟)
  10: '#3b82f6', // 中蓝 (10 分钟)
  15: '#93c5fd', // 浅蓝 (15 分钟)
}

/**
 * 将 WKT (POLYGON / MULTIPOLYGON) 解析为 GeoJSON Geometry
 * @param {string} wkt
 * @returns {object|null}
 */
export function parseWktGeometry(wkt) {
  if (typeof wkt !== 'string') return null
  const trimmed = wkt.trim()
  if (trimmed.toUpperCase().startsWith('POLYGON')) {
    const inner = trimmed.slice(trimmed.indexOf('(') + 1, trimmed.lastIndexOf(')')).trim()
    const rings = inner.slice(1, -1).split(/\)\s*,\s*\(/).map((r) =>
      r.split(',').map((p) => p.trim().split(/\s+/).map(Number))
    )
    return { type: 'Polygon', coordinates: rings }
  }
  if (trimmed.toUpperCase().startsWith('MULTIPOLYGON')) {
    const inner = trimmed.slice(trimmed.indexOf('(') + 1, trimmed.lastIndexOf(')')).trim()
    const polys = inner.slice(1, -1).split(/\)\)\s*,\s*\(\(/).map((p) =>
      p.split(/\)\s*,\s*\(/).map((r) =>
        r.split(',').map((pt) => pt.trim().split(/\s+/).map(Number))
      )
    )
    return { type: 'MultiPolygon', coordinates: polys }
  }
  return null
}

/**
 * 计算几何对象的圆度（紧凑度）：4 * PI * Area / Perimeter^2
 * @param {object} featureOrGeometry Turf Feature 或 GeoJSON Geometry
 * @returns {number} 圆度数值（正圆为 1.0）
 */
export function calculateCircularity(featureOrGeometry) {
  const feat =
    featureOrGeometry.type === 'Feature'
      ? featureOrGeometry
      : turf.feature(featureOrGeometry)

  const a = turf.area(feat)
  if (a <= 0) return 0

  let perimeter = 0
  const lines = turf.polygonToLine(feat)
  if (lines.type === 'FeatureCollection') {
    lines.features.forEach((f) => {
      perimeter += turf.length(f, { units: 'meters' })
    })
  } else {
    perimeter = turf.length(lines, { units: 'meters' })
  }

  if (perimeter <= 0) return 0
  return (4 * Math.PI * a) / (perimeter * perimeter)
}

/**
 * 判断几何是否非圆形（AC-M4-02-2：圆度 < 0.95）
 * @param {object} featureOrGeometry
 * @returns {boolean}
 */
export function isNonCircular(featureOrGeometry) {
  return calculateCircularity(featureOrGeometry) < 0.95
}

/**
 * 执行网络服务区分析
 * @param {object} params
 * @param {string} params.categoryL2 设施中类（必填）
 * @param {string} params.travelMode 'WALK' | 'DRIVE'（必填）
 * @param {number[]} params.thresholds 阈值列表 [5, 10, 15]（必填）
 * @param {string} [params.districtCode] 限定行政区
 * @param {boolean} [params.dissolve=true] 是否融合
 * @returns {Promise<object>} 规范化后的服务区分析结果
 */
export async function runServiceArea(params) {
  const data = await fetchServiceArea(params)
  const areas = (data.areas || []).map((area) => {
    const geometry = area.geomWkt ? parseWktGeometry(area.geomWkt) : null
    const feature = geometry
      ? turf.feature(geometry, {
          threshold: area.threshold,
          coveredCommunityCount: area.coveredCommunityCount,
        })
      : null

    const areaM2 = geometry ? turf.area(geometry) : 0
    const circularity = geometry ? calculateCircularity(geometry) : 0

    return {
      threshold: area.threshold,
      coveredCommunityCount: area.coveredCommunityCount,
      areaM2,
      circularity,
      isNonCircular: circularity < 0.95,
      feature,
      geomWkt: area.geomWkt,
    }
  })

  // 按阈值升序排列
  areas.sort((a, b) => a.threshold - b.threshold)

  // 统计未覆盖小区数与清单（FR-M4-02 规则 4）
  const totalCommunity = data.summary?.totalCommunity ?? 0
  const uncoveredList = data.summary?.uncoveredCommunities ?? []

  return {
    taskId: data.taskId,
    elapsedMs: data.elapsedMs,
    areas,
    summary: {
      totalCommunity,
      uncoveredCount: totalCommunity - (areas[areas.length - 1]?.coveredCommunityCount || 0),
      uncoveredCommunities: uncoveredList,
    },
  }
}

/**
 * 渲染服务区多边形图层至地图（分层渲染，小阈值在上/深色，大阈值在下/浅色）
 * @param {object} serviceAreaResult runServiceArea 的结果
 * @param {object} [options]
 * @returns {object|null} Leaflet LayerGroup
 */
export function renderServiceAreaLayer(serviceAreaResult, options = {}) {
  const map = getMap()
  if (!map || !globalThis.L || !serviceAreaResult?.areas) {
    return null
  }

  const group = globalThis.L.layerGroup()
  // 从大阈值到小阈值倒序添加，使小阈值（深色）渲染在上层
  const sorted = [...serviceAreaResult.areas].sort((a, b) => b.threshold - a.threshold)

  sorted.forEach((item) => {
    if (!item.feature) return
    const color = THRESHOLD_COLORS[item.threshold] || '#3b82f6'
    const layer = globalThis.L.geoJSON(item.feature, {
      style: () => ({
        color,
        fillColor: color,
        weight: 1.5,
        fillOpacity: 0.35,
        ...options,
      }),
    })
    group.addLayer(layer)
  })

  group.addTo(map)
  return group
}

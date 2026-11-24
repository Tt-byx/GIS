/**
 * 缓冲区分析模块（T-049 / FR-M4-01）
 * 依据：SPEC/01-requirements.md FR-M4-01, SPEC/07-tasks.md T-049
 */
import * as turf from '@turf/turf'
import { getMap } from '@/core/mapInstance'

/** 默认填充透明度（FR-M4-01 规则 4） */
export const BUFFER_FILL_OPACITY = 0.2

/** 默认线框颜色与样式 */
export const BUFFER_STYLE = {
  color: '#3b82f6',
  weight: 2,
  opacity: 1,
  fillColor: '#3b82f6',
  fillOpacity: BUFFER_FILL_OPACITY,
}

/**
 * 规范化点为 Turf Point Feature
 * @param {object|Array} p 点对象 {lon, lat} / {lng, lat} / [lon, lat] / GeoJSON Feature
 * @returns {object|null} Turf Point Feature
 */
export function normalizePoint(p) {
  if (!p) return null
  if (p.type === 'Feature' && p.geometry && p.geometry.type === 'Point') {
    return p
  }
  let lon, lat
  if (Array.isArray(p)) {
    lon = p[0]
    lat = p[1]
  } else if (typeof p.lon === 'number' && typeof p.lat === 'number') {
    lon = p.lon
    lat = p.lat
  } else if (typeof p.lng === 'number' && typeof p.lat === 'number') {
    lon = p.lng
    lat = p.lat
  } else if (p.geometry && Array.isArray(p.geometry.coordinates)) {
    lon = p.geometry.coordinates[0]
    lat = p.geometry.coordinates[1]
  }
  if (Number.isFinite(lon) && Number.isFinite(lat)) {
    return turf.point([lon, lat], p.properties || {})
  }
  return null
}

/**
 * 运行缓冲区分析
 * @param {object} params
 * @param {Array} params.points 设施点集合
 * @param {number} params.radius 缓冲半径（米），100..5000
 * @param {boolean} [params.dissolve=true] 是否融合为单一多边形
 * @param {Array} [params.residentialPoints=[]] 居住小区点集合（用于覆盖统计）
 * @returns {object} { featureCollection, feature, stats }
 */
export function runBuffer({
  points = [],
  radius = 1000,
  dissolve = true,
  residentialPoints = [],
} = {}) {
  if (!Array.isArray(points) || points.length === 0) {
    return {
      featureCollection: turf.featureCollection([]),
      feature: null,
      count: 0,
      stats: {
        coveredResidentialCount: 0,
        coveredPopulation: 0,
        coverageRate: 0,
        totalResidentialCount: 0,
        totalPopulation: 0,
      },
    }
  }

  // 1. 规范化设施点
  const turfPoints = points.map(normalizePoint).filter(Boolean)
  if (turfPoints.length === 0) {
    return {
      featureCollection: turf.featureCollection([]),
      feature: null,
      count: 0,
      stats: {
        coveredResidentialCount: 0,
        coveredPopulation: 0,
        coverageRate: 0,
        totalResidentialCount: 0,
        totalPopulation: 0,
      },
    }
  }

  // 2. 使用 Turf.buffer 生成缓冲面（steps=64, units='meters'）
  const bufferFeatures = turfPoints.map((pt) =>
    turf.buffer(pt, radius, { units: 'meters', steps: 64 })
  )

  let finalFeature = null
  let finalFc = null

  if (dissolve) {
    if (bufferFeatures.length === 1) {
      finalFeature = bufferFeatures[0]
      finalFc = turf.featureCollection([finalFeature])
    } else {
      const fc = turf.featureCollection(bufferFeatures)
      finalFeature = turf.union(fc)
      finalFc = turf.featureCollection([finalFeature])
    }
  } else {
    finalFc = turf.featureCollection(bufferFeatures)
  }

  // 3. 计算覆盖统计（居住小区数、人口数、覆盖率）
  let coveredResidentialCount = 0
  let coveredPopulation = 0
  let totalPopulation = 0

  const resPointsTurf = (residentialPoints || []).map(normalizePoint).filter(Boolean)
  const totalResidentialCount = resPointsTurf.length

  resPointsTurf.forEach((rpt, idx) => {
    const raw = residentialPoints[idx] || {}
    const pop = Number(raw.popEst ?? raw.population ?? raw.POP_EST ?? 0)
    totalPopulation += pop

    // 判断点是否在缓冲面内
    let isInside = false
    if (dissolve && finalFeature) {
      isInside = turf.booleanPointInPolygon(rpt, finalFeature)
    } else {
      for (const bf of bufferFeatures) {
        if (turf.booleanPointInPolygon(rpt, bf)) {
          isInside = true
          break
        }
      }
    }

    if (isInside) {
      coveredResidentialCount += 1
      coveredPopulation += pop
    }
  })

  const coverageRate =
    totalResidentialCount > 0
      ? Number((coveredResidentialCount / totalResidentialCount).toFixed(4))
      : 0

  return {
    featureCollection: finalFc,
    feature: finalFeature,
    count: dissolve ? 1 : bufferFeatures.length,
    stats: {
      coveredResidentialCount,
      coveredPopulation,
      coverageRate,
      totalResidentialCount,
      totalPopulation,
    },
  }
}

/**
 * 渲染缓冲区图层到地图（置于点层下方）
 * @param {object} bufferResult runBuffer 的返回值
 * @param {object} [options]
 * @returns {object|null} Leaflet GeoJSON 图层
 */
export function renderBufferLayer(bufferResult, options = {}) {
  const map = getMap()
  if (!map || !globalThis.L || !bufferResult?.featureCollection) {
    return null
  }

  const layer = globalThis.L.geoJSON(bufferResult.featureCollection, {
    style: () => ({
      ...BUFFER_STYLE,
      ...options,
    }),
  })

  layer.addTo(map)
  // DoD 3: 缓冲面置于点层下方
  if (typeof layer.bringToBack === 'function') {
    layer.bringToBack()
  }

  return layer
}

/**
 * 导出缓冲区 GeoJSON（FR-M4-06 规则 4）
 * @param {object} featureCollection
 * @param {string} [categoryL1='all']
 * @returns {string} 导出的 JSON 字符串
 */
export function exportBufferGeoJSON(featureCollection, categoryL1 = 'all') {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const filename = `analysis_buffer_${categoryL1}_${timestamp}.geojson`
  const jsonStr = JSON.stringify(featureCollection, null, 2)
  return { filename, content: jsonStr }
}

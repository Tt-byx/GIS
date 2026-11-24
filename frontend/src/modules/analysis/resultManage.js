/**
 * 分析结果图层管理模块（T-050 / FR-M4-06）
 * 依据：SPEC/01-requirements.md FR-M4-06
 */
import { useMapStore } from '@/stores/mapStore'
import { getMap } from '@/core/mapInstance'

/** 存储内存中的分析结果详情映射：id -> { id, type, name, layer, geojson, stats } */
const resultsMap = new Map()

/**
 * 注册并添加分析结果
 * @param {object} param
 * @param {string} param.id 唯一结果 ID
 * @param {string} param.type 分析类型，如 'buffer' | 'serviceArea' | 'accessibility'
 * @param {string} param.name 图层显示名称
 * @param {object} [param.layer] Leaflet 图层对象
 * @param {object} param.geojson GeoJSON FeatureCollection 对象
 * @param {object} [param.stats] 统计面板数据
 * @returns {object} 注册项
 */
export function addAnalysisResult({ id, type, name, layer, geojson, stats = {} }) {
  const store = useMapStore()

  // 1. 规范化 GeoJSON 确保为 FeatureCollection
  let fc = geojson
  if (!fc || fc.type !== 'FeatureCollection') {
    if (fc && fc.type === 'Feature') {
      fc = { type: 'FeatureCollection', features: [fc] }
    } else {
      fc = { type: 'FeatureCollection', features: [] }
    }
  }

  const record = { id, type, name, layer, geojson: fc, stats }
  resultsMap.set(id, record)

  // 2. 独立图层加入 'analysis' 分组（FR-M4-06 规则 1）
  store.addLayer({
    id,
    group: 'analysis',
    name,
    visible: true,
    opacity: 1,
  })

  return record
}

/**
 * 设置指定结果图层显隐（FR-M4-06 规则 2）
 * @param {string} id
 * @param {boolean} visible
 */
export function setResultVisible(id, visible) {
  const store = useMapStore()
  store.setLayerVisible(id, visible)

  const record = resultsMap.get(id)
  if (record && record.layer) {
    const map = getMap()
    if (map) {
      if (visible) {
        if (!map.hasLayer(record.layer)) {
          map.addLayer(record.layer)
        }
      } else {
        if (map.hasLayer(record.layer)) {
          map.removeLayer(record.layer)
        }
      }
    }
  }
}

/**
 * 移除指定分析结果（FR-M4-06 规则 2）
 * @param {string} id
 */
export function removeAnalysisResult(id) {
  const store = useMapStore()
  const record = resultsMap.get(id)
  if (record) {
    if (record.layer) {
      const map = getMap()
      if (map && map.hasLayer(record.layer)) {
        map.removeLayer(record.layer)
      }
    }
    resultsMap.delete(id)
  }
  store.removeLayer(id)
}

/**
 * 一键清除全部（FR-M4-06 规则 2-3 / 验收标准 AC-M4-06-1）
 * 同时清除所有分析图形与统计面板，图层数与统计面板均归零
 */
export function clearAllAnalysisResults() {
  const map = getMap()
  resultsMap.forEach((record) => {
    if (record.layer && map && map.hasLayer(record.layer)) {
      map.removeLayer(record.layer)
    }
  })
  resultsMap.clear()

  const store = useMapStore()
  store.clearAnalysisLayers()
}

/**
 * 获取当前所有分析结果数量
 * @returns {number}
 */
export function getAnalysisResultsCount() {
  return resultsMap.size
}

/**
 * 获取当前合并的统计信息（若无分析结果则返回 null 或各指标为 0）
 * @returns {object|null}
 */
export function getAnalysisStatsSummary() {
  if (resultsMap.size === 0) {
    return {
      resultsCount: 0,
      totalCoveredCommunities: 0,
      totalPopulation: 0,
      coverageRate: 0,
    }
  }

  let totalCovered = 0
  let totalPop = 0
  resultsMap.forEach((record) => {
    if (record.stats) {
      totalCovered += record.stats.coveredResidentialCount ?? record.stats.coveredCommunityCount ?? 0
      totalPop += record.stats.coveredPopulation ?? 0
    }
  })

  return {
    resultsCount: resultsMap.size,
    totalCoveredCommunities: totalCovered,
    totalPopulation: totalPop,
  }
}

/**
 * 导出分析结果为 GeoJSON 格式（FR-M4-06 规则 4 / AC-M4-06-2）
 * @param {string} id
 * @returns {{ filename: string, content: string }}
 */
export function exportAnalysisResultGeoJSON(id) {
  const record = resultsMap.get(id)
  if (!record || !record.geojson) {
    throw new Error(`未找到 ID 为 ${id} 的分析结果`)
  }

  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const filename = `analysis_${record.type}_${timestamp}.geojson`

  const content = JSON.stringify(record.geojson, null, 2)
  return { filename, content }
}

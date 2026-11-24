/**
 * 2SFCA 可达性分析与可视化模块（T-051 / FR-M4-04）
 * 依据：SPEC/01-requirements.md FR-M4-04, SPEC/03-api-contract.md §8 (API-06)
 */
import * as turf from '@turf/turf'
import { fetchAccessibility } from '@/api/analysis'
import { CLASS_BREAK_COLORS } from '@/config/symbols'
import { getMap } from '@/core/mapInstance'

/** 合法阈值下拉选项（FR-M4-04 规则 5 / DoD 3：仅 5/10/15 三项） */
export const VALID_THRESHOLDS = [5, 10, 15]

/** 衰减函数类型 */
export const DECAY_TYPES = ['GAUSSIAN', 'LINEAR', 'BINARY']

/** OD 矩阵缺失时的降级提示文案（FR-M4-04 处理规则 6 / AC-M4-04-4） */
export const FALLBACK_OD_MESSAGE = '可达性分析未就绪，请联系管理员生成 OD 矩阵'

/**
 * 将 breaks 数组转换为图例区间文本标签
 * @param {number[]} breaks 长度为 6 的数值断点
 * @returns {string[]} 5 个分级文本
 */
export function formatBreakLabels(breaks = []) {
  if (!Array.isArray(breaks) || breaks.length < 2) return []
  const labels = []
  for (let i = 0; i < breaks.length - 1; i++) {
    const from = Number(breaks[i]).toFixed(4)
    const to = Number(breaks[i + 1]).toFixed(4)
    labels.push(`${from} ~ ${to}`)
  }
  return labels
}

/**
 * 运行 2SFCA 可达性分析
 * @param {object} params
 * @param {string} [params.categoryL1] 设施大类编码
 * @param {string} [params.categoryL2] 设施中类编码
 * @param {number} params.thresholdMinutes 阈值分钟数 (5/10/15)
 * @param {string} [params.decay='GAUSSIAN'] 衰减函数类型
 * @param {string} [params.capacityField='CAPACITY'] 规模字段
 * @returns {Promise<object>} 分析结果与面板统计对象
 */
export async function runAccessibility({
  categoryL1 = 'MED',
  categoryL2 = 'CHC',
  thresholdMinutes = 15,
  decay = 'GAUSSIAN',
  capacityField = 'CAPACITY',
  districtCode,
} = {}) {
  // 校验阈值是否合法（DoD 3）
  const numThreshold = Number(thresholdMinutes)
  if (!VALID_THRESHOLDS.includes(numThreshold)) {
    throw new Error(`非法阈值: ${thresholdMinutes}，仅允许 5/10/15 分钟`)
  }

  try {
    const data = await fetchAccessibility({
      categoryL1,
      categoryL2,
      threshold: numThreshold,
      decayType: decay,
      districtCode,
    })

    const breaks = data.breaks || []
    const classCount = Math.max(0, breaks.length - 1)
    const breakLabels = formatBreakLabels(breaks)

    // 构建 GeoJSON FeatureCollection
    const features = (data.results || []).map((item) => {
      const level = Number(item.level ?? 1)
      const clampedLevel = Math.min(Math.max(level, 1), 5)
      return turf.point([item.lon, item.lat], {
        unitCode: item.unitCode,
        unitName: item.unitName,
        score: item.score,
        level: clampedLevel,
        color: CLASS_BREAK_COLORS[clampedLevel - 1],
      })
    })
    const featureCollection = turf.featureCollection(features)

    return {
      success: true,
      taskId: data.taskId,
      elapsedMs: data.elapsedMs,
      decay: data.decay || decay,
      thresholdMinutes: numThreshold,
      categoryL1,
      categoryL2,
      createdAt: new Date().toISOString(),
      breaks,
      breakLabels,
      classCount,
      stats: {
        min: data.stats?.min ?? 0,
        max: data.stats?.max ?? 0,
        mean: data.stats?.mean ?? 0,
        p50: data.stats?.p50 ?? 0,
        capacityFallback: Boolean(data.stats?.capacityFallback),
      },
      results: data.results || [],
      featureCollection,
    }
  } catch (error) {
    // 捕获 OD 缺失等异常，返回降级提示（AC-M4-04-4）
    return {
      success: false,
      message: FALLBACK_OD_MESSAGE,
      errorDetail: error.message,
      breaks: [],
      breakLabels: [],
      classCount: 0,
      stats: { min: 0, max: 0, mean: 0, p50: 0 },
      results: [],
      featureCollection: turf.featureCollection([]),
    }
  }
}

/**
 * 渲染可达性分级点图层（半径随 level 递增，采用分级色带）
 * @param {object} accessibilityResult runAccessibility 的返回结果
 * @returns {object|null} Leaflet LayerGroup
 */
export function renderAccessibilityLayer(accessibilityResult) {
  const map = getMap()
  if (!map || !globalThis.L || !accessibilityResult?.results) {
    return null
  }

  const group = globalThis.L.layerGroup()
  const results = accessibilityResult.results || []

  results.forEach((item) => {
    const level = Number(item.level ?? 1)
    const clampedLevel = Math.min(Math.max(level, 1), 5)
    const color = CLASS_BREAK_COLORS[clampedLevel - 1]
    // 规则 3: 圆形符号 + 分级色，半径随 level 递增 (4, 6, 8, 10, 12)
    const radius = 3 + clampedLevel * 2

    const marker = globalThis.L.circleMarker([item.lat, item.lon], {
      radius,
      color,
      weight: 1.5,
      fillColor: color,
      fillOpacity: 0.85,
    })

    if (item.unitName) {
      marker.bindPopup(`<b>${item.unitName}</b><br/>得分: ${item.score}<br/>分级: ${clampedLevel}`)
    }

    group.addLayer(marker)
  })

  group.addTo(map)
  return group
}

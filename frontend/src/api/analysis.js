/**
 * 空间分析相关接口（api 层：只发请求与拆包，不做业务）
 * 契约：SPEC/03-api-contract.md §7 (API-05), §8 (API-06)
 */
import http from './http'
import { TIMEOUT } from '@/config'

/**
 * API-05 网络服务区分析 (POST /api/v1/analysis/service-area)
 * @param {object} params
 * @param {string} params.categoryL2 设施中类编码（必填）
 * @param {string} params.travelMode 'WALK' | 'DRIVE'（必填）
 * @param {number[]} params.thresholds 分钟阈值数组 [5, 10, 15]（必填）
 * @param {string} [params.districtCode] 限定行政区
 * @param {boolean} [params.dissolve=true] 是否融合
 * @returns {Promise<object>} { taskId, elapsedMs, areas, summary }
 */
export async function fetchServiceArea(params) {
  const data = await http.post('/analysis/service-area', params, {
    timeout: TIMEOUT.analysis,
  })
  return data
}

/**
 * API-06 2SFCA 可达性分析 (POST /api/v1/analysis/accessibility)
 * @param {object} params
 * @param {string} params.categoryL1 设施大类编码（必填）
 * @param {number} params.threshold 分钟阈值 5/10/15（必填）
 * @param {string} [params.decayType='GAUSSIAN'] 衰减函数类型 BINARY/LINEAR/GAUSSIAN
 * @param {string} [params.districtCode] 限定行政区
 * @returns {Promise<object>} { taskId, elapsedMs, points, breaks, summary }
 */
export async function fetchAccessibility(params) {
  const data = await http.post('/analysis/accessibility', params, {
    timeout: TIMEOUT.analysis,
  })
  return data
}

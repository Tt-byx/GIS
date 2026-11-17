/**
 * 分区统计接口（API-04，03 §6）。api 层只发请求（04 §3.1）。
 * 数据源为 MySQL STAT_DISTRICT 预计算表，前端 MUST NOT 汇总计算（FR-M3-05 规则 4）。
 */
import http from './http'

/**
 * 分区统计查询（GET /api/v1/statistics/district）。
 * @param {object} params 03 §6 请求参数表：
 *   level（必填，district/street）、categoryL1（默认 ALL）、metric（count/density/perCapita）、
 *   districtCode（仅 level=street 生效）
 * @returns {Promise<{level: string, metric: string, unit: string, dataDate: string,
 *   list: Array<{unitCode: string, unitName: string, value: number | null, popTotal: number | null, facCount: number}>}>}
 *   注意 value 为 null 表示分母为 0（A-23：禁止把 null 当 0 消费）
 */
export async function fetchDistrictStats(params) {
  const data = await http.get('/statistics/district', { params })
  return data
}

/**
 * 设施相关接口（api 层：只发请求与拆包，不做业务，04 §3.1）。
 * 契约：03-api-contract §4（API-02）、§5（API-03）；字段名唯一权威在 02 §6。
 * 禁止在本层做任何过滤、排序、状态修改（DEP-04 / P-12）。
 */
import http from './http'

/**
 * API-02 设施查询（GET /api/v1/facilities，分页 + 多条件 AND 组合）。
 * @param {object} params 见 03 §4 请求参数表：
 *   categoryL1/categoryL2/districtCode/streetCode/keyword/status/page/size。
 *   空值参数必须先剔除（03 §4 业务规则 1），剔除逻辑由调用方 attrQuery 完成。
 * @returns {Promise<{total: number, page: number, size: number, list: Array<object>}>}
 */
export async function fetchFacilities(params) {
  const data = await http.get('/facilities', { params })
  return data
}

/**
 * API-03 名称补全代理（GET /api/v1/facilities/suggest）。
 * Key 在后端，前端禁止出现任何 Key 字面量（A-24 / P-30）。
 * @param {string} kw 关键字，长度 2–30（03 §5）
 * @param {{city?: string, limit?: number}} [options] city 默认 武汉；limit 1–20 默认 10
 * @returns {Promise<{list: Array<{name: string, district: string, lon: number, lat: number}>}>}
 */
export async function fetchSuggest(kw, options = {}) {
  const { city = '武汉', limit = 10 } = options
  const data = await http.get('/facilities/suggest', {
    params: { kw, city, limit },
  })
  return data
}

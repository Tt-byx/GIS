/**
 * 导出相关接口（api 层：只发请求与拆包，不做业务）
 * 契约：SPEC/03-api-contract.md §9 (API-07)
 */
import http from './http'
import { TIMEOUT } from '@/config'

/**
 * API-07 结果导出接口 (POST /api/v1/export/excel)
 * @param {object} param
 * @param {'STAT_DISTRICT'|'COVERAGE'|'ANALYSIS'} param.type 导出类型
 * @param {'xlsx'|'csv'} param.format 导出格式
 * @param {object} param.params 查询/筛选条件（与当前界面一致）
 * @param {string} [param.filename='export'] 文件名前缀
 * @returns {Promise<any>} 文件流响应
 */
export async function exportExcel({ type, format = 'xlsx', params = {}, filename = 'export' }) {
  const response = await http.post(
    '/export/excel',
    { type, format, params, filename },
    {
      timeout: TIMEOUT.analysis,
      responseType: 'blob',
    }
  )
  return response
}

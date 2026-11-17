/**
 * axios 实例（04 §3 api/http.js）。api 层只发请求、拆统一响应包装，不做业务（§3.1）。
 * 统一包装结构与错误码见 03 §2.2 / 05 §4；前端按 code 分支处理（C-34），禁止 msg 文本匹配。
 */
import axios from 'axios'
import { API_BASE, TIMEOUT } from '@/config'

const http = axios.create({
  baseURL: API_BASE,
  timeout: TIMEOUT.default,
})

/**
 * 业务错误对象（携带 code/msg/traceId，供 modules 层按 C-34 分支处理）。
 */
export class ApiError extends Error {
  /**
   * @param {number} code 错误码（05 §4 主表）
   * @param {string} msg 中文提示（后端逐字返回）
   * @param {string} traceId 12 位链路标识
   */
  constructor(code, msg, traceId) {
    super(msg)
    this.name = 'ApiError'
    this.code = code
    this.traceId = traceId
  }
}

// 响应拆包：code===0 返回 data；非 0 抛 ApiError（A-01：失败时 data 必为 null）
http.interceptors.response.use(
  (response) => {
    const body = response.data
    if (!body || typeof body.code === 'undefined') {
      // 文件流等非统一包装响应（API-07）原样透传
      return response
    }
    if (body.code !== 0) {
      throw new ApiError(body.code, body.msg, body.traceId)
    }
    return body.data
  },
  (error) => {
    const body = error.response && error.response.data
    if (body && typeof body.code !== 'undefined') {
      throw new ApiError(body.code, body.msg, body.traceId)
    }
    throw error
  },
)

export default http

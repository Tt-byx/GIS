/**
 * 名称搜索自动补全（FR-M2-05；任务 T-043）。
 *
 * 硬规则：
 * 1. 输入长度 < 2 时 MUST NOT 发请求（AC-M2-05-1）；
 * 2. 输入防抖 300ms（SUGGEST_DEBOUNCE_MS，AC-M2-05-2），禁止每次按键都发请求；
 * 3. 接口失败 MUST 静默失败并 console.warn（FR-M2-05 处理规则 5）。
 */
import { fetchSuggest } from '@/api/facility'
import { SUGGEST_DEBOUNCE_MS } from '@/config'

/** API-03 的 kw 取值范围（03 §5：长度 2–30） */
const KW_MIN_LENGTH = 2
const KW_MAX_LENGTH = 30

/** @type {ReturnType<typeof setTimeout> | null} 防抖计时器（模块级单例，连续输入只保留最后一次） */
let debounceTimer = null

/** @type {Function | null} 等待中调用的 resolve；被新输入覆盖时立即以空结果放行，避免 promise 悬挂 */
let pendingResolve = null

/**
 * 按 name 完全相同去重（FR-M2-05 处理规则 3）。
 * @param {Array<{name: string, district: string, lon: number, lat: number}>} list
 * @returns {Array<{name: string, district: string, lon: number, lat: number}>}
 */
export function dedupeByName(list) {
  const seen = new Set()
  const out = []
  for (const item of list) {
    if (seen.has(item.name)) {
      continue
    }
    seen.add(item.name)
    out.push(item)
  }
  return out
}

/**
 * 名称联想（防抖版）。连续调用时，前一次仍在防抖等待中的调用立即以空列表结束，
 * 仅最后一次输入在防抖到期后真正发起请求。
 * @param {string} kw 用户输入关键字
 * @param {{limit?: number}} [options] 候选上限 1–20，默认 10
 * @returns {Promise<{list: Array<{name: string, district: string, lon: number, lat: number}>}>}
 */
export function suggest(kw, options = {}) {
  return new Promise((resolve) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (pendingResolve) {
      const superseded = pendingResolve
      pendingResolve = null
      superseded({ list: [] })
    }
    const trimmed = typeof kw === 'string' ? kw.trim() : ''
    // 长度不足 2（含空串）与超出 30 均视为无效输入，不发请求（03 §5：kw 长度 2–30）
    if (trimmed.length < KW_MIN_LENGTH || trimmed.length > KW_MAX_LENGTH) {
      resolve({ list: [] })
      return
    }
    pendingResolve = resolve
    debounceTimer = setTimeout(async () => {
      debounceTimer = null
      pendingResolve = null
      try {
        const data = await fetchSuggest(trimmed, options)
        resolve({ list: dedupeByName((data && data.list) || []) })
      } catch (error) {
        // FR-M2-05 处理规则 5：联想失败静默失败，仅 console.warn（C-13 允许 warn）
        console.warn('名称联想失败', error && error.code !== undefined ? `code=${error.code}` : '', error && error.message ? error.message : '')
        resolve({ list: [] })
      }
    }, SUGGEST_DEBOUNCE_MS)
  })
}

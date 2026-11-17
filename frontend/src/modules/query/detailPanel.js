/**
 * 属性面板数据装配（FR-M2-06；任务 T-044）。
 *
 * 硬规则：
 * 1. 字段固定顺序 15 项（FR-M2-06 处理规则 2），顺序由本文件 PANEL_FIELDS 唯一决定；
 * 2. null / undefined / 空串 / NaN / 字面量 "null"|"undefined"|"NaN" 一律显示 —
 *    （FR-M2-06 处理规则 3 与 DoD 3：页面禁止出现 null/undefined/NaN 字样）；
 * 3. 经纬度固定 6 位小数（FR-M2-06 处理规则 4）；日期 yyyy-MM-dd（处理规则 5）。
 */

/** 空值统一显示符（FR-M2-06 处理规则 3） */
export const EMPTY_DISPLAY = '—'

/**
 * 面板字段定义（顺序固定，FR-M2-06 处理规则 2）。
 * dictKey 标记需要经字典翻译为名称的字段（大类/中类编码 → 中文名）。
 */
export const PANEL_FIELDS = [
  { label: '名称', key: 'name' },
  { label: '大类', key: 'categoryL1', dictKey: 'l1' },
  { label: '中类', key: 'categoryL2', dictKey: 'l2' },
  { label: '地址', key: 'address' },
  { label: '行政区', key: 'districtName' },
  { label: '街道', key: 'streetName' },
  { label: '社区', key: 'communityName' },
  { label: '经度', key: 'lon', format: 'lonlat' },
  { label: '纬度', key: 'lat', format: 'lonlat' },
  { label: '服务能力', key: 'capacity' },
  { label: '能力单位', key: 'capacityUnit' },
  { label: '等级', key: 'level' },
  { label: '运营状态', key: 'status' },
  { label: '数据来源', key: 'srcType' },
  { label: '采集时间', key: 'srcDate', format: 'date' },
]

/**
 * 经纬度格式化：固定 6 位小数（FR-M2-06 处理规则 4）。
 * @param {number | string | null | undefined} value
 * @returns {string | null} 非数值输入返回 null（由装配层转 —）
 */
export function formatLonLat(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const num = Number(value)
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return null
  }
  return num.toFixed(6)
}

/**
 * 日期格式化：yyyy-MM-dd（FR-M2-06 处理规则 5）。
 * 后端 DATE 按契约已是 yyyy-MM-dd（DM-19）；兼容 ISO 8601 带时区的输入截取日期部分（DM-20）。
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function formatDate(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const text = String(value)
  const datePart = text.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null
}

/**
 * 统一空值显示：FR-M2-06 DoD 3 禁止页面出现 null/undefined/NaN 字样，
 * 故除空值外，字面量 "null"/"undefined"/"NaN"（含大小写变体）也按空值处理。
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeDisplay(value) {
  if (value === null || value === undefined || value === '') {
    return EMPTY_DISPLAY
  }
  if (typeof value === 'number' && Number.isNaN(value)) {
    return EMPTY_DISPLAY
  }
  const text = String(value).trim()
  const literalWords = ['null', 'undefined', 'nan']
  if (literalWords.includes(text.toLowerCase())) {
    return EMPTY_DISPLAY
  }
  return text
}

/**
 * 装配属性面板行数据。
 * @param {object | null | undefined} facility 设施对象（API-02 列表项或要素服务映射结果，02 §6.2）
 * @param {{l1NameByCode?: Record<string, string>, l2NameByCode?: Record<string, string>} | null} [dict]
 *   字典（API-01 缓存），缺省时大类/中类直接显示编码
 * @returns {Array<{label: string, value: string}>} 与 PANEL_FIELDS 顺序一致的展示行
 */
export function assemblePanelRows(facility, dict = null) {
  const source = facility || {}
  const rows = []
  for (const field of PANEL_FIELDS) {
    let raw = source[field.key]
    if (field.format === 'lonlat') {
      raw = formatLonLat(raw)
    } else if (field.format === 'date') {
      raw = formatDate(raw)
    }
    let value = normalizeDisplay(raw)
    if (dict) {
      const table = field.dictKey === 'l1' ? dict.l1NameByCode : dict.l2NameByCode
      if (field.dictKey && table && table[source[field.key]]) {
        value = table[source[field.key]]
      }
    }
    rows.push({ label: field.label, value })
  }
  return rows
}

/**
 * 结果导出模块（T-052 / FR-M5-04）
 * 依据：SPEC/01-requirements.md FR-M5-04, SPEC/03-api-contract.md §9 (API-07)
 */
import { exportExcel } from '@/api/exportApi'

/**
 * 生成符合规范的时间戳文件名：<prefix>_<yyyyMMddHHmmss>.<ext>
 * @param {string} prefix 文件名前缀
 * @param {string} ext 扩展名 ('csv' | 'xlsx' | 'geojson' | 'png')
 * @returns {string} 匹配 .*_\d{14}\.(xlsx|csv|geojson|png)$
 */
export function formatExportFilename(prefix = 'export', ext = 'csv') {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `${prefix}_${timestamp}.${ext}`
}

/**
 * 构建带 UTF-8 BOM 的 CSV 文本内容（FR-M5-04 规则 5 / AC-M5-04-2）
 * 前 3 字节必须为 EF BB BF (\uFEFF)
 * @param {Array<{key: string, label: string}>} headers 表头定义
 * @param {Array<object>} rows 数据行
 * @returns {string} 带 BOM 的 CSV 字符串
 */
export function buildCsvContent(headers = [], rows = []) {
  const headerLabels = headers.map((h) => `"${String(h.label || '').replace(/"/g, '""')}"`)
  const lines = [headerLabels.join(',')]

  rows.forEach((row) => {
    const line = headers.map((h) => {
      const val = row[h.key] ?? ''
      const strVal = String(val).replace(/"/g, '""')
      return `"${strVal}"`
    })
    lines.push(line.join(','))
  })

  // 注入 UTF-8 BOM 字符（\uFEFF 在 UTF-8 编码下字节为 EF BB BF）
  return '\uFEFF' + lines.join('\r\n')
}

/**
 * 触发浏览器文件下载
 * @param {Blob|string} content Blob 或文本内容
 * @param {string} filename 文件名
 */
export function triggerDownload(content, filename) {
  let blob = content
  if (typeof content === 'string') {
    blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  }

  if (
    typeof window !== 'undefined' &&
    window.URL &&
    typeof window.URL.createObjectURL === 'function' &&
    window.document
  ) {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }
}

/**
 * 执行结果导出
 * @param {object} param
 * @param {'STAT_DISTRICT'|'COVERAGE'|'ANALYSIS'} param.type
 * @param {'xlsx'|'csv'} [param.format='csv']
 * @param {Array<object>} [param.headers] 前端导出的表头
 * @param {Array<object>} [param.rows] 当前界面过滤/排序后的数据行
 * @param {string} [param.filename='export']
 * @returns {Promise<{ filename: string, rowCount: number }>}
 */
export async function runExport({
  type = 'STAT_DISTRICT',
  format = 'csv',
  headers = [],
  rows = [],
  filename = 'export',
} = {}) {
  const fullFilename = formatExportFilename(filename, format)

  if (format === 'csv' && rows.length > 0 && headers.length > 0) {
    // 优先采用前端直出 CSV（包含 UTF-8 BOM，且保证 100% 与界面当前所见一致）
    const csvContent = buildCsvContent(headers, rows)
    triggerDownload(csvContent, fullFilename)
    return {
      filename: fullFilename,
      rowCount: rows.length,
      content: csvContent,
    }
  }

  // 调用后端 API-07 导出
  const response = await exportExcel({
    type,
    format,
    params: { rowsCount: rows.length },
    filename,
  })

  const blob = response.data || response
  triggerDownload(blob, fullFilename)

  return {
    filename: fullFilename,
    rowCount: rows.length,
  }
}

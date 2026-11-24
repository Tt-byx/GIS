/**
 * CHK-TEST-M5-04 · FR-M5-04 结果导出测试
 * 依据：SPEC/01-requirements.md FR-M5-04, SPEC/06-testing.md CHK-TEST-M5-04
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { exportExcelMock } = vi.hoisted(() => ({
  exportExcelMock: vi.fn(),
}))

vi.mock('@/api/exportApi', () => ({
  exportExcel: exportExcelMock,
}))

import {
  formatExportFilename,
  buildCsvContent,
  runExport,
} from '../export'

describe('FR-M5-04 结果导出', () => {
  beforeEach(() => {
    exportExcelMock.mockReset()
  })

  it('AC-M5-04-1: 导出数据行数与当前界面表格行数完全一致', async () => {
    const headers = [
      { key: 'unitName', label: '街道名称' },
      { key: 'facilityCount', label: '设施数' },
    ]
    const rows = [
      { unitName: '红钢城', facilityCount: 20 },
      { unitName: '新沟桥', facilityCount: 15 },
    ]

    const result = await runExport({
      type: 'STAT_DISTRICT',
      format: 'csv',
      headers,
      rows,
      filename: 'stat_district',
    })

    expect(result.rowCount).toBe(2)
    // 包含表头行与 2 数据行
    const lines = result.content.split('\r\n')
    expect(lines.length).toBe(3)
  })

  it('AC-M5-04-2 & DoD 3: CSV 导出内容前 3 字节必须为 EF BB BF (UTF-8 BOM)', () => {
    const headers = [{ key: 'name', label: '名称' }]
    const rows = [{ name: '测试中文' }]

    const csvStr = buildCsvContent(headers, rows)
    // UTF-8 BOM 字符为 \uFEFF
    expect(csvStr.charCodeAt(0)).toBe(0xFEFF)

    // 验证 Buffer 编码后前 3 字节精确为 0xEF, 0xBB, 0xBF
    const buffer = Buffer.from(csvStr, 'utf-8')
    expect(buffer[0]).toBe(0xEF)
    expect(buffer[1]).toBe(0xBB)
    expect(buffer[2]).toBe(0xBF)
  })

  it('AC-M5-04-3: 文件名严格匹配 .*_\\d{14}\\.(xlsx|csv)$', () => {
    const csvFilename = formatExportFilename('analysis_stat', 'csv')
    expect(csvFilename).toMatch(/^.*_\d{14}\.csv$/)

    const xlsxFilename = formatExportFilename('coverage_report', 'xlsx')
    expect(xlsxFilename).toMatch(/^.*_\d{14}\.xlsx$/)
  })
})

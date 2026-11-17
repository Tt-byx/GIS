/**
 * CHK-TEST-M2-05 · FR-M2-05 名称搜索与自动补全（3 断言，对应 AC-M2-05-1/2/3）。
 * 防抖行为用 fake timers 校验。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { fetchSuggestMock } = vi.hoisted(() => ({
  fetchSuggestMock: vi.fn(),
}))

vi.mock('@/api/facility', () => ({
  fetchFacilities: vi.fn(),
  fetchSuggest: fetchSuggestMock,
}))

import { suggest, dedupeByName } from '../index'
import { SUGGEST_DEBOUNCE_MS } from '@/config'

describe('FR-M2-05 名称联想', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchSuggestMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('AC-M2-05-1：输入 1 个字符时不发请求', async () => {
    fetchSuggestMock.mockResolvedValue({ list: [] })

    const promise = suggest('关')
    await vi.advanceTimersByTimeAsync(SUGGEST_DEBOUNCE_MS + 50)
    const result = await promise

    expect(fetchSuggestMock).not.toHaveBeenCalled()
    expect(result.list).toEqual([])
  })

  it('AC-M2-05-2：输入"关山"后 300ms 内恰好发 1 次请求；连续输入只保留最后一次', async () => {
    fetchSuggestMock.mockResolvedValue({
      list: [{ name: '关山街社区卫生服务中心', district: '洪山区', lon: 114.398, lat: 30.512 }],
    })

    // 第一次输入随后被覆盖：其 promise 必须立即以空结果结束，且不产生请求
    const cancelledPromise = suggest('关山')
    const finalPromise = suggest('关山街')
    await vi.advanceTimersByTimeAsync(SUGGEST_DEBOUNCE_MS + 50)
    const [cancelled, final] = await Promise.all([cancelledPromise, finalPromise])

    expect(fetchSuggestMock).toHaveBeenCalledTimes(1)
    expect(fetchSuggestMock.mock.calls[0][0]).toBe('关山街')
    expect(cancelled.list).toEqual([])
    expect(final.list).toHaveLength(1)
  })

  it('FR-M2-05 规则 3：按 name 完全相同去重；接口失败静默返回空', async () => {
    // 去重
    const deduped = dedupeByName([
      { name: '关山街社区卫生服务中心', district: '洪山区', lon: 114.398, lat: 30.512 },
      { name: '关山街社区卫生服务中心', district: '洪山区', lon: 114.398, lat: 30.512 },
      { name: '光谷广场', district: '洪山区', lon: 114.405, lat: 30.507 },
    ])
    expect(deduped).toHaveLength(2)

    // 静默失败：接口抛错时 promise 正常 resolve 空列表，不向上冒泡（FR-M2-05 规则 5）
    fetchSuggestMock.mockRejectedValue({ code: 5001, msg: '今日查询额度已用尽' })
    const promise = suggest('关山')
    await vi.advanceTimersByTimeAsync(SUGGEST_DEBOUNCE_MS + 50)
    const result = await promise
    expect(result.list).toEqual([])
  })

  it('超长输入（>30）不发请求（03 §5 kw 长度 2–30）', async () => {
    const longKw = '关'.repeat(31)
    const promise = suggest(longKw)
    await vi.advanceTimersByTimeAsync(SUGGEST_DEBOUNCE_MS + 50)
    await promise
    expect(fetchSuggestMock).not.toHaveBeenCalled()
  })
})

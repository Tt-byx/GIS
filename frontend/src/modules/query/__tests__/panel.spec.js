/**
 * CHK-TEST-M2-06 · FR-M2-06 属性面板（3 断言，对应 AC-M2-06-1..3）。
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import PanelShell from '@/components/PanelShell.vue'
import {
  assemblePanelRows,
  formatLonLat,
  formatDate,
  normalizeDisplay,
  EMPTY_DISPLAY,
} from '../detailPanel'

const FACILITY_WITH_NULL_CAPACITY = {
  facCode: '420111-MED-CHS-0007',
  name: '关山街社区卫生服务中心',
  categoryL1: 'MED',
  categoryL2: 'CHS',
  address: '武汉市洪山区关山大道 100 号',
  districtName: '洪山区',
  streetName: '关山街道',
  communityName: null,
  lon: 114.398765,
  lat: 30.512345,
  capacity: null,
  capacityUnit: '床位',
  level: '一级',
  status: '正常',
  srcType: '政府名录',
  srcDate: '2026-11-05T00:00:00+08:00',
}

describe('FR-M2-06 属性面板', () => {
  it('AC-M2-06-1：capacity=null 的行显示 —，DOM 无 null/undefined/NaN 字样', () => {
    const rows = assemblePanelRows(FACILITY_WITH_NULL_CAPACITY, {
      l1NameByCode: { MED: '医疗卫生' },
      l2NameByCode: { CHS: '社区卫生服务站' },
    })

    const capacityRow = rows.find((row) => row.label === '服务能力')
    const communityRow = rows.find((row) => row.label === '社区')
    expect(capacityRow.value).toBe(EMPTY_DISPLAY)
    expect(communityRow.value).toBe(EMPTY_DISPLAY)

    const wrapper = mount(PanelShell, {
      props: { visible: true, title: '设施详情', rows },
    })
    const text = wrapper.text()
    expect(text).not.toContain('null')
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('NaN')
  })

  it('AC-M2-06-2：按 Esc 时发出 close 事件', async () => {
    const wrapper = mount(PanelShell, {
      props: { visible: true, title: '设施详情' },
      attachTo: document.body,
    })
    await wrapper.find('[data-testid="panel-shell"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('AC-M2-06-3：宽度钳制 ≤ 360px', () => {
    // 传入超宽值，组件必须钳到 360
    const wrapper = mount(PanelShell, {
      props: { visible: true, width: 500 },
    })
    const style = wrapper.find('[data-testid="panel-shell"]').attributes('style')
    expect(style).toContain('width: 360px')
    expect(style).not.toContain('width: 500px')
  })
})

describe('装配细节（FR-M2-06 处理规则 2/4/5）', () => {
  it('15 个字段顺序与 FR-M2-06 完全一致', () => {
    const rows = assemblePanelRows(FACILITY_WITH_NULL_CAPACITY)
    expect(rows.map((row) => row.label)).toEqual([
      '名称', '大类', '中类', '地址', '行政区', '街道', '社区',
      '经度', '纬度', '服务能力', '能力单位', '等级', '运营状态', '数据来源', '采集时间',
    ])
  })

  it('经纬度固定 6 位小数；ISO 时间截取日期部分', () => {
    expect(formatLonLat(114.398765)).toBe('114.398765')
    expect(formatLonLat(30.5)).toBe('30.500000')
    expect(formatLonLat('abc')).toBeNull()
    expect(formatDate('2026-11-05T00:00:00+08:00')).toBe('2026-11-05')
    expect(formatDate('2026-11-05')).toBe('2026-11-05')
  })

  it('字面量 null/undefined/NaN（含大小写变体）按空值显示 —（DoD 3）', () => {
    expect(normalizeDisplay('null')).toBe(EMPTY_DISPLAY)
    expect(normalizeDisplay('Undefined')).toBe(EMPTY_DISPLAY)
    expect(normalizeDisplay('NaN')).toBe(EMPTY_DISPLAY)
    expect(normalizeDisplay(0)).toBe('0')
  })
})

/**
 * 设施构成分析模块（T-052 / FR-M5-02）
 * 依据：SPEC/01-requirements.md FR-M5-02
 */
import { CATEGORY_SYMBOLS, CATEGORY_ORDER } from '@/config/symbols'

/**
 * 构建饼图 ECharts 配置
 * @param {object} param
 * @param {Array<object>} param.data 各类别汇总数据 [{ code: 'EDU', count: 120, capacity: 5000 }, ...]
 * @param {'count'|'capacity'} [param.basis='count'] 分析口径
 * @returns {object} ECharts Option
 */
export function buildCompositionPieOption({ data = [], basis = 'count' } = {}) {
  const basisKey = basis === 'capacity' ? 'capacity' : 'count'
  const titleText = basis === 'capacity' ? '设施规模容量构成' : '设施数量构成'

  const seriesData = CATEGORY_ORDER.map((code) => {
    const meta = CATEGORY_SYMBOLS[code] || {}
    const item = data.find((d) => d.code === code) || {}
    const val = Number(item[basisKey] ?? item.value ?? 0)
    return {
      name: meta.l1Name || code,
      value: val,
      code,
      itemStyle: { color: meta.color },
    }
  })

  return {
    title: { text: titleText, left: 'center' },
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 10, left: 'center' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: { show: true, formatter: '{b}: {d}%' },
        data: seriesData,
      },
    ],
  }
}

/**
 * 构建堆叠柱状图 ECharts 配置（按行政区堆叠展示五类设施）
 * @param {object} param
 * @param {Array<string>} param.districts 行政区列表 ['青山区', '武昌区', '洪山区']
 * @param {Array<object>} param.data 原始数据 [{ district: '青山区', EDU: 10, MED: 20, ... }]
 * @param {'count'|'capacity'} [param.basis='count']
 * @returns {object} ECharts Option
 */
export function buildCompositionStackedBarOption({
  districts = ['青山区', '武昌区', '洪山区'],
  data = [],
  basis = 'count',
} = {}) {
  const series = CATEGORY_ORDER.map((code) => {
    const meta = CATEGORY_SYMBOLS[code] || {}
    const seriesValues = districts.map((dist) => {
      const row = data.find((d) => d.district === dist || d.districtName === dist) || {}
      return Number(row[code] ?? 0)
    })

    return {
      name: meta.l1Name || code,
      type: 'bar',
      stack: 'total',
      emphasis: { focus: 'series' },
      itemStyle: { color: meta.color },
      data: seriesValues,
    }
  })

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 10 },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: districts },
    yAxis: { type: 'value' },
    series,
  }
}

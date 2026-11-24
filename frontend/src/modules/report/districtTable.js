/**
 * 分区统计表模块（T-052 / FR-M5-01）
 * 依据：SPEC/01-requirements.md FR-M5-01
 */

/** 固定列定义（FR-M5-01 规则 1 / AC-M5-01-1） */
export const DISTRICT_TABLE_COLUMNS = [
  { key: 'unitName', label: '单元名称' },
  { key: 'facilityCount', label: '设施数' },
  { key: 'facilityDensity', label: '设施密度(个/km²)' },
  { key: 'population', label: '常住人口' },
  { key: 'perCapita', label: '每万人设施数' },
]

/**
 * 格式化数值为保留 2 位小数
 * @param {number|null|undefined} val
 * @returns {string}
 */
export function formatNumber2(val) {
  if (val === null || val === undefined || !Number.isFinite(Number(val))) {
    return '—'
  }
  return Number(val).toFixed(2)
}

/**
 * 规范化分区统计表行数据
 * @param {Array<object>} rawList 接口原始数据列表
 * @param {object} [options]
 * @returns {Array<object>} 规范化行数组
 */
export function buildDistrictTableRows(rawList = [], options = {}) {
  return rawList.map((item) => {
    const unitCode = item.unitCode || item.code || ''
    const unitName = item.unitName || item.name || '—'
    const facilityCount = Number(item.facCount ?? item.count ?? 0)
    const areaKm2 = Number(item.areaKm2 ?? item.area ?? 0)
    const population = item.popTotal !== undefined ? item.popTotal : (item.population !== undefined ? item.population : null)

    // 密度：设施数 / 面积
    let facilityDensity = '—'
    if (areaKm2 > 0) {
      facilityDensity = formatNumber2(facilityCount / areaKm2)
    } else if (item.facilityDensity !== undefined && item.facilityDensity !== null) {
      facilityDensity = formatNumber2(item.facilityDensity)
    }

    // 每万人设施数：设施数 / (常住人口 / 10000)
    let perCapita = '—'
    const numPop = Number(population)
    if (population !== null && Number.isFinite(numPop) && numPop > 0) {
      const rate = (facilityCount / numPop) * 10000
      perCapita = formatNumber2(rate)
    } else {
      // 分母为 0 或缺失时显示 '—'，绝不显示 Infinity 或 NaN（FR-M5-01 规则 2 / AC-M5-01-2）
      perCapita = '—'
    }

    return {
      unitCode,
      unitName,
      districtCode: item.districtCode || '',
      facilityCount,
      facilityDensity: facilityDensity === '—' ? 0 : Number(facilityDensity),
      facilityDensityDisplay: facilityDensity,
      population: population !== null ? Number(population) : '—',
      populationDisplay: population !== null ? String(population) : '—',
      perCapita: perCapita === '—' ? null : Number(perCapita),
      perCapitaDisplay: perCapita,
    }
  })
}

/**
 * 按数值列排序表格（FR-M5-01 规则 3 / AC-M5-01-3：必须数值排序，非字典序）
 * @param {Array<object>} rows
 * @param {string} columnKey
 * @param {'asc'|'desc'} [direction='desc']
 * @returns {Array<object>}
 */
export function sortDistrictTable(rows = [], columnKey = 'facilityCount', direction = 'desc') {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    let valA = a[columnKey]
    let valB = b[columnKey]

    if (valA === null || valA === undefined || valA === '—') valA = -Infinity
    if (valB === null || valB === undefined || valB === '—') valB = -Infinity

    const numA = Number(valA)
    const numB = Number(valB)

    if (Number.isFinite(numA) && Number.isFinite(numB)) {
      return direction === 'asc' ? numA - numB : numB - numA
    }
    return direction === 'asc'
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA))
  })
  return sorted
}

/**
 * 按行政区筛选街道行（FR-M5-01 规则 4）
 * @param {Array<object>} rows
 * @param {string} districtCode
 * @returns {Array<object>}
 */
export function filterDistrictTable(rows = [], districtCode) {
  if (!districtCode) return rows
  return rows.filter((r) => String(r.districtCode) === String(districtCode))
}

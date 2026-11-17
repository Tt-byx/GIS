/**
 * 五类设施符号配置（T-008 交付物之一；本文件为先行实现，视觉定稿归 R3）。
 * 颜色 MUST 与 02-data-model §5 DICT_CATEGORY 种子数据的 COLOR_HEX 逐字一致（FR-M3-01 / AC-M3-01-2）。
 * 图标形状 MUST 互不相同（FR-M3-01 处理规则 2），不得仅靠颜色区分。
 */

export const CATEGORY_SYMBOLS = {
  EDU: { l1Name: '教育设施', color: '#4A90D9', shape: 'circle' },
  MED: { l1Name: '医疗卫生', color: '#E05252', shape: 'square' },
  CUL: { l1Name: '文化体育', color: '#8B5CF6', shape: 'triangle' },
  WEL: { l1Name: '社会福利', color: '#F59E0B', shape: 'diamond' },
  COM: { l1Name: '社区服务', color: '#10B981', shape: 'pentagon' },
}

/** 图例顺序（FR-M3-01 处理规则 3：按 DICT_CATEGORY.SORT_NO 升序，MUST NOT 按字母序） */
export const CATEGORY_ORDER = ['EDU', 'MED', 'CUL', 'WEL', 'COM']

/** 分级设色 5 级色带（由浅到深，FR-M3-02 处理规则 2） */
export const CLASS_BREAK_COLORS = ['#EFF6FF', '#BFDBFE', '#60A5FA', '#2563EB', '#1E3A8A']

/** 热力色带（FR-M3-03 处理规则 4：冷→暖，低密度蓝，高密度红，禁止反色） */
export const HEAT_GRADIENT = { 0.2: '#1E3A8A', 0.4: '#2563EB', 0.6: '#F59E0B', 0.8: '#EF4444', 1.0: '#DC2626' }

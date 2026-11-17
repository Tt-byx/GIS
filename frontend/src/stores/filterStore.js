/**
 * 查询筛选状态（04 §3.1：stores 只放状态与 getter/action，action 只改状态，
 * 禁止调 api 或操作地图——依赖矩阵 stores→api ❌，由 modules/query 编排）。
 */
import { defineStore } from 'pinia'

/** API-02 status 的默认值（03 §4：默认 正常） */
const DEFAULT_STATUS = '正常'

export const useFilterStore = defineStore('filter', {
  state: () => ({
    categoryL1: '',
    categoryL2: '',
    districtCode: '',
    streetCode: '',
    keyword: '',
    status: DEFAULT_STATUS,
    page: 1,
    size: 20,
  }),

  getters: {
    /** 是否存在任一生效的筛选条件（用于界面显示"已筛选"标记） */
    hasActiveFilter: (state) =>
      Boolean(state.categoryL1 || state.categoryL2 || state.districtCode || state.streetCode || state.keyword),
  },

  actions: {
    /**
     * 合并写入筛选条件；条件变化后 MUST 回到第 1 页（03 §4：排序 facCode ASC 的稳定分页语义）。
     * @param {Partial<{categoryL1: string, categoryL2: string, districtCode: string, streetCode: string, keyword: string, status: string}>} patch
     * @returns {void}
     */
    setFilter(patch) {
      const keys = ['categoryL1', 'categoryL2', 'districtCode', 'streetCode', 'keyword', 'status']
      let touched = false
      for (const key of keys) {
        if (key in patch) {
          this[key] = patch[key]
          touched = true
        }
      }
      if (touched) {
        this.page = 1
      }
    },

    /**
     * 翻页（1 起始）。
     * @param {number} page 目标页码
     * @returns {void}
     */
    setPage(page) {
      if (!Number.isInteger(page) || page < 1) {
        return
      }
      this.page = page
    },

    /** 清空全部筛选条件并回到第 1 页 */
    resetFilter() {
      this.categoryL1 = ''
      this.categoryL2 = ''
      this.districtCode = ''
      this.streetCode = ''
      this.keyword = ''
      this.status = DEFAULT_STATUS
      this.page = 1
    },
  },
})

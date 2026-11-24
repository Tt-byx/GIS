/**
 * 地图共享状态（T-042）：图层可见性 / 透明度 / 底图 / 视野快照 / 图例模式。
 * 规则：stores 禁止直接操作地图图层或 DOM（04 §3.1），编排由 map-base/layerControl 完成。
 */
import { defineStore } from 'pinia'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@/config'
import { CATEGORY_SYMBOLS, CATEGORY_ORDER } from '@/config/symbols'

/** 设施图层树节点 id 与大类编码的映射关系（kebab-case，与 theme-viz 命名风格一致） */
const FACILITY_LAYER_IDS = CATEGORY_ORDER.map((code) => `facility-${code.toLowerCase()}`)

export const useMapStore = defineStore('map', {
  state: () => ({
    /** 图层树三组：底图 / 设施 / 分析结果（FR-M1-05 处理规则 1） */
    layers: [
      { id: 'basemap', group: 'basemap', name: '底图', visible: true, opacity: 1 },
      ...FACILITY_LAYER_IDS.map((id, index) => {
        const code = CATEGORY_ORDER[index]
        return {
          id,
          group: 'facility',
          code,
          name: CATEGORY_SYMBOLS[code].l1Name,
          visible: true,
          opacity: 1,
        }
      }),
    ],
    basemap: 'mapgis',
    /** 视野快照，供对比模式退出恢复（FR-M3-06：禁止重置为全可见） */
    viewSnapshot: null,
    view: { center: [...DEFAULT_CENTER], zoom: DEFAULT_ZOOM },
    /** 图例模式：category / class / heat / cluster（FR-M3-07 处理规则 1） */
    legendMode: 'category',
    /** 分级区间文本，仅 class 模式使用（FR-M3-02 处理规则 4） */
    classBreaks: [],
  }),

  getters: {
    /**
     * 按分组取图层列表。
     * @returns {Function} 分组名 → 图层数组
     */
    layersByGroup: (state) => (group) => state.layers.filter((item) => item.group === group),

    /**
     * 按 id 取图层。
     * @returns {Function} 图层 id → 图层对象
     */
    getLayerById: (state) => (layerId) => state.layers.find((item) => item.id === layerId),

    /**
     * 设施图层是否全部可见。
     */
    allFacilityVisible: (state) =>
      state.layers
        .filter((item) => item.group === 'facility')
        .every((item) => item.visible),
  },

  actions: {
    /**
     * 切换图层显隐（FR-M1-05：底图不可关闭）。
     * @param {string} layerId 图层标识
     * @param {boolean} visible 是否可见
     */
    setLayerVisible(layerId, visible) {
      const layer = this.getLayerById(layerId)
      if (layer && layer.group !== 'basemap') {
        layer.visible = visible
      }
    },

    /**
     * 设置图层透明度（FR-M1-05：底图不支持透明度调整）。
     * @param {string} layerId 图层标识
     * @param {number} opacity 0..1
     */
    setLayerOpacity(layerId, opacity) {
      const layer = this.getLayerById(layerId)
      if (layer && layer.group !== 'basemap') {
        layer.opacity = Math.min(1, Math.max(0, opacity))
      }
    },

    /**
     * 切换底图（FR-M1-06）。
     * @param {string} basemap 底图标识
     */
    setBasemap(basemap) {
      this.basemap = basemap
    },

    /**
     * 保存视野快照（FR-M3-06 处理规则 3）。
     */
    saveViewSnapshot() {
      this.viewSnapshot = {
        layers: this.layers.map((item) => ({ id: item.id, visible: item.visible, opacity: item.opacity })),
        view: { ...this.view },
      }
    },

    /**
     * 恢复视野快照并清空（FR-M3-06：恢复到进入前快照）。
     */
    restoreViewSnapshot() {
      if (!this.viewSnapshot) {
        return
      }
      this.viewSnapshot.layers.forEach((saved) => {
        const layer = this.getLayerById(saved.id)
        if (layer) {
          layer.visible = saved.visible
          layer.opacity = saved.opacity
        }
      })
      this.view = { ...this.viewSnapshot.view }
      this.viewSnapshot = null
    },

    /**
     * 添加图层（分析结果等动态图层加入 analysis 分组，FR-M4-06）
     * @param {object} layer 图层对象
     */
    addLayer(layer) {
      const existing = this.getLayerById(layer.id)
      if (existing) {
        Object.assign(existing, layer)
      } else {
        this.layers.push(layer)
      }
    },

    /**
     * 移除指定图层
     * @param {string} layerId 图层标识
     */
    removeLayer(layerId) {
      const idx = this.layers.findIndex((item) => item.id === layerId)
      if (idx !== -1) {
        this.layers.splice(idx, 1)
      }
    },

    /**
     * 清空全部分析结果图层（FR-M4-06）
     */
    clearAnalysisLayers() {
      this.layers = this.layers.filter((item) => item.group !== 'analysis')
    },

    /**
     * 切换图例模式（FR-M3-07）。
     * @param {string} mode category / class / heat / cluster
     * @param {Array<string>} [breaks] 分级区间文本，仅 class 模式使用
     */
    setLegendMode(mode, breaks = []) {
      this.legendMode = mode
      if (mode === 'class') {
        this.classBreaks = breaks
      }
    },
  },
})

export default useMapStore

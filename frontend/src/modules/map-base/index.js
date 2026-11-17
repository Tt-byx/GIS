/**
 * M1 地图基础模块对外出口（AR-21：外部 MUST 只从 index.js 导入）。
 * 当前交付 ensureMap 与 layerControl；measure/basemap/initMap 归 T-041 后续补充。
 */
export { toggleLayer, changeOpacity, reorderLayers, switchBasemap, applyLayerState } from './layerControl'
export { ensureMap } from './mapInit'
export { default as layerControlApi } from './layerControl'

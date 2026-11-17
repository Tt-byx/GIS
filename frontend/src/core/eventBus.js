/**
 * 事件总线（AR-18：只允许使用白名单内的 9 个事件名，白名单外事件一律判定失败）。
 * mitt 实例为模块级单例；事件常量是全项目唯一的事实源。
 */
import mitt from 'mitt'

/** 事件名白名单（04 §2.3，P-04：禁止发明事件名） */
export const EVENTS = {
  MAP_READY: 'map:ready',
  MAP_VIEWCHANGE: 'map:viewchange',
  LAYER_VISIBILITYCHANGE: 'layer:visibilitychange',
  BASEMAP_CHANGE: 'basemap:change',
  FEATURE_SELECT: 'feature:select',
  QUERY_RESULT: 'query:result',
  THEME_CHANGE: 'theme:change',
  ANALYSIS_RESULT: 'analysis:result',
  ANALYSIS_CLEAR_ALL: 'analysis:clearAll',
}

export const eventBus = mitt()

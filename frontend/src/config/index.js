/**
 * 前端唯一配置源（AR-26：12 个键必须全部存在，业务代码禁止出现字面量）。
 * 修改本文件 = 修改配置，禁止把配置散落到任何业务模块（P-06/X-10）。
 */

/** IGServer 反代前缀（A-12：禁止直连 6163） */
export const IGS_BASE = '/igs'

/** 业务接口前缀 */
export const API_BASE = '/api/v1'

/** IGServer 地图文档名 */
export const MAP_DOC_NAME = 'wh_facility'

/** 图层索引（03 §11.2，A-11：必须与 IGServer 发布结果一致） */
export const LAYERS = {
  LAYER_FACILITY: 'wh_facility/0',
  LAYER_DISTRICT: 'wh_facility/1',
  LAYER_STREET: 'wh_facility/2',
  LAYER_RESIDENTIAL: 'wh_facility/3',
}

/** 请求超时（毫秒，03 §2.1） */
export const TIMEOUT = {
  default: 30000,
  analysis: 60000,
}

export const MIN_ZOOM = 8

export const MAX_ZOOM = 18

/** 初始中心（武汉三区概略中心，CGCS2000 与 WGS84 厘米级一致） */
export const DEFAULT_CENTER = [114.32, 30.52]

export const DEFAULT_ZOOM = 11

/** 聚合/散开分界（FR-M3-04：zoom<14 聚合，>=14 散开） */
export const CLUSTER_ZOOM_THRESHOLD = 14

/** 标注显示分界（FR-M3-07） */
export const LABEL_ZOOM_THRESHOLD = 14

/** 名称联想防抖（FR-M2-05：300ms） */
export const SUGGEST_DEBOUNCE_MS = 300

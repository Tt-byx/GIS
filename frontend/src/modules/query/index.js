/**
 * M2 查询模块对外出口（AR-21：外部只能从本文件导入，禁止直接导入子文件）。
 */
export { searchByAttr, buildQueryParams, flyToFeature, EMPTY_RESULT_TEXT, FLY_TO_ZOOM } from './attrQuery'
export {
  queryByGeometry,
  searchNearby,
  queryByClick,
  clearGeometry,
  mapGdbFeature,
  GDB_TO_JSON,
  EMPTY_NEARBY_TEXT,
} from './spatialQuery'
export { suggest, dedupeByName } from './suggest'

/**
 * IGServer 服务对象工厂（AR-17：modules 禁止直接 new Zondy.*，必须经本工厂）。
 * 先行实现：URL 拼装与工厂函数；初始化 load 流程由 R3 联调期完善。
 * 地址规则见 03 §11.1；前端禁止出现 IP/端口字面量（A-12 / DEP-09）。
 */
import { IGS_BASE, MAP_DOC_NAME } from '@/config'

/**
 * 拼装要素服务 URL。
 * @param {string} [docName] 地图文档名，默认取配置
 * @returns {string} 形如 /igs/rest/services/Map/wh_facility/FeatureServer
 */
export function buildFeatureServerUrl(docName = MAP_DOC_NAME) {
  return `${IGS_BASE}/rest/services/Map/${docName}/FeatureServer`
}

/**
 * 拼装地图文档服务 URL。
 * @param {string} [docName] 地图文档名，默认取配置
 * @returns {string} 形如 /igs/rest/services/Map/wh_facility/MapServer
 */
export function buildMapServerUrl(docName = MAP_DOC_NAME) {
  return `${IGS_BASE}/rest/services/Map/${docName}/MapServer`
}

/**
 * 创建要素服务图层对象（空间/属性查询均经此对象，03 §11.3）。
 * @param {string} [docName] 地图文档名
 * @returns {object} zondy.layer.IGSFeatureLayer 实例
 */
export function createFeatureLayer(docName = MAP_DOC_NAME) {
  return new zondy.layer.IGSFeatureLayer({ url: buildFeatureServerUrl(docName) })
}

/**
 * 创建要素服务对象（03 §11.3：点选/画框/周边查询由浏览器直接调要素服务，A-20）。
 * AR-17：modules 禁止 new Zondy.*，FeatureServer 的构造收敛于本工厂。
 * @param {string} [docName] 地图文档名
 * @returns {object} zondy.service.FeatureServer 实例
 */
export function createFeatureServer(docName = MAP_DOC_NAME) {
  return new zondy.service.FeatureServer({ url: buildFeatureServerUrl(docName) })
}

/**
 * 创建 Leaflet 版瓦片底图图层对象。
 * @param {string} tileServiceUrl 瓦片服务完整路径（由 R3 从配置传入）
 * @returns {object} zondy.leaflet.layer.IGSTileLayer 实例
 */
export function createTileLayer(tileServiceUrl) {
  return new zondy.leaflet.layer.IGSTileLayer(tileServiceUrl)
}

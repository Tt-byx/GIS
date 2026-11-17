/**
 * 单测共享工具（仅测试环境使用；生产代码路径不得引用本文件）。
 */
import { vi } from 'vitest'

/**
 * 安装 Leaflet 全局 stub：jsdom 里 index.html 的第三方脚本不会执行，
 * 模块代码引用的全局 L 在测试中由本函数注入。
 * @returns {Array<object>} 本次创建的全部图层 stub，便于断言
 */
export function installLeafletStub() {
  const createdLayers = []
  globalThis.L = {
    geoJSON: vi.fn(() => {
      const layer = { addTo: vi.fn() }
      createdLayers.push(layer)
      return layer
    }),
  }
  return createdLayers
}

/**
 * 构造假地图对象（覆盖 query 模块用到的全部地图方法）。
 * @returns {object} 带调用记录的 fake map
 */
export function createFakeMap() {
  return {
    flyTo: vi.fn(),
    removeLayer: vi.fn(),
    latLngToContainerPoint: vi.fn(() => ({ x: 100, y: 100 })),
    containerPointToLatLng: vi.fn(() => ({ lat: 30.52, lng: 114.32 })),
    distance: vi.fn(() => 20), // 半宽 20 米（容差像素换算的稳定桩值）
  }
}

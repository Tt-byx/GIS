<script setup>
import { onMounted } from 'vue'
import { ensureMap } from '@/modules/map-base'

// 布局骨架（T-003）：顶栏 / 左面板 / 地图 / 右面板 / 底栏
// 完整 initMap（健康检查、IGServer 图层）由 T-041 完成，此处先注入最小地图实例
onMounted(() => {
  ensureMap('map')
})
</script>

<template>
  <div class="app-layout">
    <header class="app-topbar">武汉市三区五类设施服务平台</header>
    <div class="app-body">
      <aside class="app-left-panel"><!-- 图层树 / 查询面板（集成期挂载） --></aside>
      <main class="app-map-container">
        <div id="map" class="map-viewer"></div>
      </main>
      <aside class="app-right-panel"><!-- 属性面板 / 图表面板（集成期挂载） --></aside>
    </div>
    <footer class="app-bottombar">数据版本：—</footer>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.app-topbar,
.app-bottombar {
  height: 48px;
  line-height: 48px;
  padding: 0 16px;
  background: #1f2937;
  color: #f9fafb;
}
.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.app-left-panel,
.app-right-panel {
  width: 320px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  overflow: auto;
}
.app-map-container {
  flex: 1;
  min-width: 0;
}
.map-viewer {
  width: 100%;
  height: 100%;
}
</style>

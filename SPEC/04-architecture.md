# 04 · ARCHITECTURE

| 字段 | 值 |
|---|---|
| `spec.id` | SPEC-04 |
| `spec.version` | 1.0.0 |
| `spec.status` | FROZEN |
| `spec.owner` | 项目组 |
| `spec.updated` | 2026-10-21 |
| `spec.depends_on` | `00-overview.md`、`03-api-contract.md` |
| `spec.authority` | 第 5 顺位。目录、依赖、模块边界的唯一权威。 |

---

## 1. 架构结论

**本系统为「前后端分离的单体应用 + 一个 GIS 中间件」，共 3 个部署单元。明确不使用微服务。**

| # | 部署单元 | 技术 | 端口 | 职责 | 是我们的代码 |
|---|---|---|---|---|---|
| `U1` | `web` | Vue 3 静态站点 + Nginx | `80` | 全部界面与交互 | 是 |
| `U2` | `app` | Spring Boot 单 jar | `8080` | 代理、计算、导出 | 是 |
| `U3` | `igs` | MapGIS IGServer | `9999`（管理端）/ `6163`（IGS） | 地图服务、空间分析 | 否（第三方） |

**辅助端口**：MySQL `3306`。

**强制约束**

| ID | 规则 |
|---|---|
| `AR-01` | MUST NOT 拆分为微服务。MUST NOT 引入服务注册、配置中心、API 网关、消息队列。 |
| `AR-02` | MUST NOT 容器化部署（MapGIS 云授权绑定机器标识，容器重建会导致授权失效）。 |
| `AR-03` | 浏览器 MUST 只访问 `http://localhost`（80），MUST NOT 直连 `8080` 或 `6163`。 |
| `AR-04` | 只有当 `app` 需要空间数据时才调 `igs`；`igs` MUST NOT 回调 `app`。依赖方向单一。 |

### 1.1 路由分发（Nginx）

```
/            → 静态文件（dist/）
/api/        → proxy_pass http://127.0.0.1:8080
/igs/        → proxy_pass http://127.0.0.1:6163
```

**规则 `AR-05`：前端 MUST NOT 出现 `:8080` 或 `:6163` 字面量。全部经 Nginx 同源访问。**

---

## 2. 分层与依赖规则

### 2.1 后端四层

| 层 | 包路径 | 只允许依赖 | MUST NOT |
|---|---|---|---|
| 接口层 | `controller` | `service`、`dto`、`common` | 直接依赖 `mapper`；写业务判断；返回 `Entity` |
| 业务层 | `service` | `mapper`、`entity`、`dto`、`client`、`common` | 依赖 `controller`；返回 `ResponseEntity` |
| 数据层 | `mapper` | `entity` | 依赖 `service` |
| 客户端层 | `client` | `dto`、`common` | 依赖 `service` |

**强制约束**

| ID | 规则 | 检查方式 |
|---|---|---|
| `AR-06` | `controller` MUST NOT `import ...mapper.` | `CHK-DEP` grep |
| `AR-07` | `controller` MUST NOT 返回 `entity` 包下的类，MUST 返回 `dto` | Code Review + `CHK-DEP` |
| `AR-08` | `service` MUST NOT `import ...controller.` | `CHK-DEP` |
| `AR-09` | `mapper` MUST NOT `import ...service.` | `CHK-DEP` |
| `AR-10` | `service` 之间 MUST NOT 循环依赖（A 依赖 B 且 B 依赖 A） | Code Review |
| `AR-11` | 所有对 IGServer 的调用 MUST 经 `client/IgsClient`，MUST NOT 在 service 中拼接 URL | `CHK-DEP` grep `http://127.0.0.1:6163` |

### 2.2 前端分层与 import 白名单

**目录别名（MUST 使用，禁止相对路径跨层引用）**

| 别名 | 实际路径 |
|---|---|
| `@/core` | `src/core` |
| `@/api` | `src/api` |
| `@/modules` | `src/modules` |
| `@/components` | `src/components` |
| `@/stores` | `src/stores` |
| `@/config` | `src/config` |

**允许的依赖矩阵**

| 源 \ 目标 | `core` | `api` | `modules` | `components` | `stores` | `config` |
|---|---|---|---|---|---|---|
| `core` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `api` | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `modules/<X>` | ✅ | ✅ | **仅 `<X>` 自身** | ✅ | ✅ | ✅ |
| `components` | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `stores` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

**强制约束**

| ID | 规则 | 检查方式 |
|---|---|---|
| `AR-12` | `core` MUST NOT import `api`/`modules`/`components`/`stores` | `CHK-DEP` |
| `AR-13` | `api` MUST NOT import `modules`/`components`/`stores` | `CHK-DEP` |
| `AR-14` | `modules/A` MUST NOT import `modules/B`（A ≠ B）。跨模块协作 MUST 经 `core` 事件总线或 `stores` | `CHK-DEP` |
| `AR-15` | `components` MUST NOT import `modules` | `CHK-DEP` |
| `AR-16` | 任何文件 MUST NOT 出现 `../../` 形式的跨层相对引用，MUST 用 `@/` 别名 | `CHK-DEP` grep `from "\.\./\.\.` |
| `AR-17` | `modules` MUST NOT 直接 `new Zondy.*`，MUST 经 `core/serviceFactory` | `CHK-DEP` grep `new Zondy` |

### 2.3 跨模块通信

**只允许三种方式，MUST NOT 使用其他。**

| 方式 | 场景 | API |
|---|---|---|
| 事件总线 | 地图事件通知（如 `map:ready`）、跨模块命令（如 `analysis:clearAll`） | `core/eventBus`（`mitt`） |
| Pinia Store | 共享状态（图层可见性、筛选条件、面板开关） | `stores/*` |
| Props / Emit | 父子组件 | Vue 原生 |

**事件名白名单（`AR-18`：MUST NOT 使用白名单外的事件名）**

| 事件名 | 载荷 | 触发方 | 说明 |
|---|---|---|---|
| `map:ready` | `{center, zoom}` | M1 | 地图初始化完成 |
| `map:viewchange` | `{center, zoom}` | M1 | 视图变化 |
| `layer:visibilitychange` | `{layerId, visible}` | M1 | 图层显隐变化 |
| `basemap:change` | `{basemap}` | M1 | 底图切换 |
| `feature:select` | `{facCode}` | M2 | 选中设施 |
| `query:result` | `{total, list}` | M2 | 查询返回 |
| `theme:change` | `{mode, params}` | M3 | 专题切换 |
| `analysis:result` | `{taskId, type}` | M4 | 分析完成 |
| `analysis:clearAll` | `{}` | M4 | 清除全部分析结果 |

---

## 3. 前端目录约定

```
frontend/
├── index.html                     # 唯一入口 HTML
├── package.json
├── vite.config.js                 # MUST 配置 @ 别名与 /api /igs 代理
├── .eslintrc.cjs
├── public/
│   └── libs/                      # MapGIS 客户端库（直接拷贝，MUST NOT 改）
│       ├── leaflet/leaflet.js
│       ├── leaflet/leaflet.css
│       └── zondyclient/
│           ├── webclient-common.min.js
│           └── webclient-leaflet-plugin.min.js
└── src/
    ├── main.js                    # 挂载 Vue、注册 Pinia、全局样式
    ├── App.vue                    # 布局骨架（顶栏 / 地图 / 左面板 / 右面板 / 底栏）
    ├── core/                      # ★ 地图内核：只懂地图，不懂业务
    │   ├── mapInstance.js         # 地图单例（markRaw）
    │   ├── serviceFactory.js      # IGServer 服务对象工厂（统一 ip/port/Token）
    │   ├── layerRegistry.js       # layerId → Leaflet layer 注册表
    │   ├── eventBus.js            # mitt 实例 + 事件名常量
    │   └── geoUtil.js             # 坐标转换、GeoJSON↔WKT、距离/面积
    ├── api/                       # 接口层：只发请求，不做业务
    │   ├── http.js                # axios 实例 + 请求/响应拦截器
    │   ├── meta.js                # API-01
    │   ├── facility.js            # API-02, API-03
    │   ├── stats.js               # API-04
    │   ├── analysis.js            # API-05, API-06
    │   └── exportApi.js           # API-07
    ├── stores/
    │   ├── mapStore.js            # 图层可见性/透明度/底图/视野快照
    │   ├── filterStore.js         # 类别/区/街道/关键字
    │   └── uiStore.js             # 面板开关、加载态、当前可视化模式
    ├── modules/
    │   ├── map-base/              # M1
    │   │   ├── index.js           # 对外 API：initMap/setBasemap/toggleLayer/measure
    │   │   ├── measure.js
    │   │   ├── basemap.js
    │   │   └── layerControl.js    # 图层显隐/透明度/顺序
    │   ├── query/                 # M2
    │   │   ├── index.js           # searchByAttr/searchNearby/queryByGeometry/flyToFeature
    │   │   ├── attrQuery.js
    │   │   ├── spatialQuery.js
    │   │   ├── suggest.js
    │   │   └── detailPanel.js     # 属性面板数据装配
    │   ├── theme-viz/             # M3
    │   │   ├── index.js           # applyHeatmap/applyClassBreaks/applyCluster/clearTheme
    │   │   ├── heatmap.js
    │   │   ├── classBreaks.js
    │   │   ├── cluster.js
    │   │   └── chartLink.js
    │   ├── analysis/              # M4
    │   │   ├── index.js           # runBuffer/runServiceArea/runAccessibility/clearAnalysis
    │   │   ├── buffer.js
    │   │   ├── serviceArea.js
    │   │   ├── coverage.js        # 覆盖率/达标率矩阵
    │   │   ├── resultManage.js    # 分析结果图层管理
    │   │   └── accessibility.js
    │   └── report/                # M5
    │       ├── index.js           # loadDistrictTable/loadComposition/exportFile
    │       ├── districtTable.js
    │       ├── composition.js     # 设施构成分析
    │       ├── coverage.js        # 达标率矩阵
    │       └── exportFile.js      # 导出编排
    ├── components/                # 通用组件，不含业务逻辑
    │   ├── LayerTree.vue
    │   ├── Legend.vue
    │   ├── PanelShell.vue
    │   ├── ChartPanel.vue         # ECharts 容器
    │   ├── LoadingMask.vue
    │   ├── EmptyState.vue
    │   └── ErrorState.vue
    ├── config/
    │   ├── index.js               # ★ 唯一配置源：IGS_BASE、图层名、超时、开关
    │   └── symbols.js             # 五类颜色与图标（MUST 与 DICT_CATEGORY 一致）
    └── assets/
        ├── css/global.css
        └── icons/
```

### 3.1 目录职责边界（MUST）

| 目录 | 允许放 | MUST NOT 放 |
|---|---|---|
| `core` | 地图实例、服务工厂、图层注册、事件总线、坐标工具 | 业务判断、接口请求、UI 组件 |
| `api` | axios 封装、请求函数、DTO 类型注释 | 业务逻辑、DOM 操作、状态修改 |
| `stores` | 状态定义、getter、action（只调 `api` 或改状态） | 直接操作地图图层、DOM |
| `modules` | 业务编排（调 `api` + 调 `core` + 改 `stores`） | 直接 `new Zondy`、直接改他人 store 内部字段 |
| `components` | 纯展示组件（props 进、emit 出） | 发请求、操作地图 |
| `config` | 常量、配置项 | 任何函数逻辑（除简单派生常量） |

**强制约束**

| ID | 规则 |
|---|---|
| `AR-19` | `src/` 下 MUST NOT 出现 `.min.js` 之外的第三方库文件；第三方库 MUST 放 `public/libs/`。 |
| `AR-20` | MUST NOT 新建本文件未列出的顶层目录。新增目录 MUST 走 SPEC 修订。 |
| `AR-21` | 每个 `modules/<X>/index.js` MUST 导出该模块的**全部**对外函数；外部 MUST 只从 `index.js` 导入，MUST NOT 直接导入子文件。 |

---

## 4. 后端目录约定

```
backend/
├── pom.xml
└── src/main/
    ├── java/com/example/gis/
    │   ├── GisApplication.java
    │   ├── config/
    │   │   ├── WebConfig.java           # 跨域（仅开发期）、JSON 序列化配置
    │   │   ├── MybatisConfig.java
    │   │   └── CacheConfig.java         # Caffeine
    │   ├── controller/
    │   │   ├── MetaController.java      # API-01, API-08
    │   │   ├── FacilityController.java  # API-02, API-03
    │   │   ├── StatsController.java     # API-04
    │   │   ├── AnalysisController.java  # API-05, API-06
    │   │   └── ExportController.java    # API-07
    │   ├── service/
    │   │   ├── DictService.java
    │   │   ├── HealthService.java
    │   │   ├── FacilityService.java
    │   │   ├── SuggestService.java
    │   │   ├── StatsService.java
    │   │   ├── ServiceAreaService.java
    │   │   ├── AccessibilityService.java
    │   │   ├── BreaksUtil.java          # 分级断点（Jenks / 等间距）
    │   │   └── ExportService.java
    │   ├── mapper/
    │   │   ├── DictCategoryMapper.java
    │   │   ├── DictDistrictMapper.java
    │   │   ├── DictStreetMapper.java
    │   │   ├── StatDistrictMapper.java
    │   │   ├── StatCoverageMapper.java
    │   │   ├── AnalysisTaskMapper.java
    │   │   ├── AnalysisResultMapper.java
    │   │   ├── ExportLogMapper.java
    │   │   ├── OdMatrixMetaMapper.java
    │   │   └── SysConfigMapper.java
    │   ├── entity/                      # 与表一一对应，字段名 = 列名（下划线转驼峰）
    │   ├── dto/                         # 请求/响应对象，字段名 = JSON 字段名
    │   ├── client/
    │   │   └── IgsClient.java           # ★ 唯一 IGServer 出口
    │   └── common/
    │       ├── R.java                   # 统一响应包装
    │       ├── ErrorCode.java           # 错误码枚举（与 05 §4 一致）
    │       ├── BizException.java
    │       └── GlobalExceptionHandler.java
    └── resources/
        ├── application.yml              # 唯一配置源
        ├── mapper/                      # MyBatis XML（如需手写 SQL）
        └── db/
            ├── schema.sql               # 与 02 §4 完全一致
            └── seed.sql                 # 与 02 §5 完全一致
```

**强制约束**

| ID | 规则 |
|---|---|
| `AR-22` | `entity` MUST 与表结构一一对应；MUST NOT 在 `entity` 上加业务注解或 DTO 字段。 |
| `AR-23` | `dto` MUST 只含 JSON 字段；MUST NOT 引用 `entity` 类型作为字段。 |
| `AR-24` | `GlobalExceptionHandler` MUST 捕获所有异常并转成 `R` 结构；MUST NOT 让异常冒泡到容器默认页。 |
| `AR-25` | `application.yml` MUST NOT 提交真实密码与 Key；MUST 用 `${ENV_VAR:default}` 形式。 |

---

## 5. 配置管理

### 5.1 前端唯一配置源 `src/config/index.js`

**规则 `AR-26`：以下键 MUST 全部存在，MUST NOT 在业务代码中出现字面量。**

| 键 | 类型 | 值/示例 | 说明 |
|---|---|---|---|
| `IGS_BASE` | string | `/igs` | IGServer 反代前缀 |
| `API_BASE` | string | `/api/v1` | 业务接口前缀 |
| `MAP_DOC_NAME` | string | `wh_facility` | 地图文档名 |
| `LAYERS` | object | `{FACILITY:'wh_facility/0', ...}` | 图层索引 |
| `TIMEOUT` | object | `{default:30000, analysis:60000}` | 超时（毫秒） |
| `MIN_ZOOM` | number | `8` | 最小缩放 |
| `MAX_ZOOM` | number | `18` | 最大缩放 |
| `DEFAULT_CENTER` | [number,number] | `[114.32, 30.52]` | 初始中心 |
| `DEFAULT_ZOOM` | number | `11` | 初始缩放 |
| `CLUSTER_ZOOM_THRESHOLD` | number | `14` | 聚合/散开分界 |
| `LABEL_ZOOM_THRESHOLD` | number | `14` | 标注显示分界 |
| `SUGGEST_DEBOUNCE_MS` | number | `300` | 搜索防抖 |

### 5.2 后端唯一配置源 `application.yml`

| 键 | 示例 | 说明 |
|---|---|---|
| `server.port` | `8080` | 后端端口 |
| `spring.datasource.url` | `jdbc:mysql://127.0.0.1:3306/gis_facility?...` | 数据库 |
| `spring.datasource.username` | `${DB_USER:root}` | 环境变量 |
| `spring.datasource.password` | `${DB_PASS:}` | 环境变量 |
| `igs.ip` | `127.0.0.1` | IGServer IP |
| `igs.port` | `6163` | IGServer 端口 |
| `igs.mapDoc` | `wh_facility` | 地图文档 |
| `igs.timeoutMs` | `60000` | IGServer 调用超时 |
| `amap.key` | `${AMAP_KEY:}` | 高德 Key（环境变量） |
| `od.matrixPath` | `./data/od_matrix.csv` | OD 矩阵路径 |
| `export.dir` | `./data/export` | 导出目录 |

**强制约束**

| ID | 规则 |
|---|---|
| `AR-27` | 任何 Key/密码 MUST 通过环境变量注入，MUST NOT 写在 `application.yml` 的默认值里。 |
| `AR-28` | 前端 MUST NOT 出现 IP、端口、Key 字面量。检查：`grep -rnE "127\.0\.0\.1|localhost:[0-9]+|tk=[0-9a-f]{16,}" frontend/src` MUST 无命中。 |

---

## 6. 构建与启动

### 6.1 命令契约

| 用途 | 命令 | 工作目录 |
|---|---|---|
| 装依赖 | `npm ci` | `frontend/` |
| 开发 | `npm run dev` | `frontend/` |
| 构建 | `npm run build` | `frontend/` |
| 代码检查 | `npm run lint` | `frontend/` |
| 后端构建 | `mvn -q clean package` | `backend/` |
| 后端测试 | `mvn -q test` | `backend/` |
| 后端启动 | `java -jar target/*.jar` | `backend/` |
| 建库 | `mysql -u root -p < db/schema.sql` | `project/` |
| 灌种子 | `mysql -u root -p < db/seed.sql` | `project/` |

**规则 `AR-29`：`npm run build` MUST 输出到 `frontend/dist/`；Nginx 的 `root` MUST 指向该目录。**

### 6.2 启动顺序（强制）

```
1. MySQL 启动（3306 可连）
2. 建库 + 灌种子
3. MapGIS IGServer 启动（9999 管理端可登录、6163 可访问）
4. IGServer 发布地图/瓦片/要素/功能服务
5. 启动 app（java -jar，8080）→ 访问 /api/v1/health 应返回 status=UP
6. 启动 Nginx（80）
7. 浏览器访问 http://localhost
```

**规则 `AR-30`：上一步未验证通过，MUST NOT 执行下一步。每一步的验证方式见 `06-testing.md` §5。**

---

## 7. 禁止事项（R 系列）

| ID | 禁令 | 判定为失败 |
|---|---|---|
| `R-01` | 不得拆微服务、不得引注册中心/配置中心/网关 | 出现 `spring-cloud-*` 依赖 |
| `R-02` | 不得容器化 | 出现 `Dockerfile` / `docker-compose.yml` |
| `R-03` | 不得新增顶层目录 | `frontend/src` 或 `backend/src/main/java` 下出现未列出的目录 |
| `R-04` | 不得跨模块直接 import | `CHK-DEP` 报错 |
| `R-05` | 不得在业务代码写服务地址/端口/Key | `CHK-DEP` 报错 |
| `R-06` | 不得让 `app` 直连 GDB | 出现 GDB 路径或本地数据源连接 |
| `R-07` | 不得在 `controller` 写业务逻辑 | `controller` 中出现 `if` 之外的业务判断或 SQL |
| `R-08` | 不得在 `service` 里拼 IGServer URL | 出现 `http://` 或 `6163` 字面量 |
| `R-09` | 不得把地图实例放进 Vue 响应式 | `ref(` / `reactive(` 包裹了地图/layer |
| `R-10` | 不得混用新旧客户端库 | `index.html` 同时引入 `zondyclient` 与 `zondyclientOld` |
| `R-11` | 不得在 `src/` 放第三方库 | 出现非项目代码的 `.js` 文件 |
| `R-12` | 不得修改 `public/libs/` 下的官方库文件 | 文件哈希变化 |

---

## 8. 修订记录

| 版本 | 日期 | 修订内容 |
|---|---|---|
| 1.0.0 | 2026-10-21 | 初始发布：3 部署单元、依赖矩阵、目录树、配置源、启动顺序 |

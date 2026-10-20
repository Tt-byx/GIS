# 06 · TESTING

| 字段 | 值 |
|---|---|
| `spec.id` | SPEC-06 |
| `spec.version` | 1.0.0 |
| `spec.status` | FROZEN |
| `spec.owner` | 项目组 |
| `spec.updated` | 2026-10-21 |
| `spec.depends_on` | `00-overview.md`、`01-requirements.md`、`05-conventions.md` |
| `spec.authority` | 第 7 顺位。测试与自检的唯一权威。 |

---

## 1. 核心原则

**规则 `T-01`：测试的唯一目的是"证明 AC 不成立时会被发现"。不能失败的测试等于没写。**

**规则 `T-02`：所有"完成"判定 MUST 由命令退出码决定，MUST NOT 由人工判断或模型自述决定。**

**规则 `T-03`：测试 MUST 可离线运行。MUST NOT 依赖外网（天地图、高德、IGServer 的真实调用除外，见 §3.3）。**

---

## 2. 测试层级

| 层级 | 名称 | 覆盖对象 | 运行时机 | 是否必需 |
|---|---|---|---|---|
| `L1` | 静态检查 | 语法、风格、依赖规则 | 每次提交前 | **必需** |
| `L2` | 单元测试 | 纯函数：几何计算、2SFCA、格式化、断点分级 | 每次提交前 | **必需** |
| `L3` | 接口测试 | 8 个 API 的入参校验、响应结构、错误码 | 每日 & 提交前 | **必需** |
| `L4` | 数据检查 | 字典完整性、统计一致性、GDB 数据质量 | 数据变更后 | **必需** |
| `L5` | 端到端 | 浏览器内核心流程 | 里程碑 | SHOULD |
| `L6` | 手工验收 | 视觉、交互、演示脚本 | 里程碑 | **必需** |

---

## 3. 自检命令契约

### 3.1 入口

**规则 `T-04`：项目 MUST 在 `project/scripts/check.sh` 提供统一入口。MUST 同时提供 `check.ps1`（Windows PowerShell 等价实现），二者行为 MUST 一致。**

```bash
scripts/check.sh <CHECK_ID> [<CHECK_ID> ...]
scripts/check.sh all
```

### 3.2 输出与退出码（强制）

| 项 | 规定 |
|---|---|
| 每条检查 MUST 输出**恰好一行**摘要到 stdout | 格式见下 |
| 格式 | `CHECK <CHECK_ID> PASS <摘要>` 或 `CHECK <CHECK_ID> FAIL <摘要>` |
| 详细日志 | MUST 写入 `project/scripts/.log/<CHECK_ID>.log`，MUST NOT 混入 stdout |
| 退出码 | `0` = 全部 PASS；`1` = 至少一个 FAIL；`2` = 检查脚本自身异常（如命令不存在） |

**stdout 样例**

```
CHECK CHK-LINT PASS 0 errors, 0 warnings
CHECK CHK-BUILD PASS dist built in 4213ms
CHECK CHK-DEP PASS 0 violations
CHECK CHK-TEST-M3-03 PASS 4/4 assertions
```

**规则 `T-05`：`FAIL` 行的摘要 MUST 包含失败数量与首个失败位置。样例：`CHECK CHK-UNIT FAIL 2/18 failed, first: heatmap.spec.js:42`**

### 3.3 离线与在线检查的区分

| 类别 | CHECK ID 前缀 | 运行前提 | 说明 |
|---|---|---|---|
| 离线检查 | `CHK-LINT`/`CHK-BUILD`/`CHK-DEP`/`CHK-UNIT` | 无 | MUST 在无网络、无服务时通过 |
| 在线检查 | `CHK-IGS`/`CHK-API`/`CHK-DATA` | 服务已启动 | 失败时 MUST 明确输出"服务未启动"而非"检查失败" |

**规则 `T-06`：在线检查在服务未启动时 MUST 退出码 `2`（脚本自身异常），MUST NOT 退出 `1`（检查失败），以便区分"环境没起"与"代码有问题"。**

---

## 4. CHECK ID 全表

### 4.1 通用检查

| CHECK ID | 检查内容 | 命令 | 通过条件 |
|---|---|---|---|
| `CHK-LINT` | 前端 ESLint + 后端 Checkstyle（如有） | `npm run lint`（`frontend/`） | 退出码 0，0 error |
| `CHK-BUILD` | 前端构建 + 后端编译打包 | `npm run build` && `mvn -q -DskipTests package` | 退出码 0，产物存在 |
| `CHK-DEP` | 依赖规则检查（`04` §2） | 见 §4.2 | 0 violations |
| `CHK-UNIT` | 全部单元测试 | `npm run test:unit` && `mvn -q test` | 全部通过，0 skipped |
| `CHK-IGS` | IGServer 连通与服务可用 | 见 §4.3 | 全部 `PASS` |
| `CHK-API` | 8 个接口冒烟 | 见 §4.4 | 8/8 通过 |
| `CHK-DATA` | 数据完整性（`02` §7 的 DI-01..DI-10） | 见 §4.5 | 10/10 通过 |
| `CHK-AC` | 汇总执行全部 `CHK-TEST-*` | 遍历 | 全部 PASS |

### 4.2 `CHK-DEP` 的具体检查项

| 子检查 | 命令 | 通过条件 |
|---|---|---|
| `DEP-01` 后端分层 | `grep -rn "import.*\.mapper\." backend/src/main/java/**/controller/` | 无命中 |
| `DEP-02` 后端反向依赖 | `grep -rn "import.*\.controller\." backend/src/main/java/**/service/` | 无命中 |
| `DEP-03` 前端 core 纯净 | `grep -rn "from ['\"]@/\(api\|modules\|components\|stores\)" frontend/src/core/` | 无命中 |
| `DEP-04` 前端 api 纯净 | `grep -rn "from ['\"]@/\(modules\|components\|stores\)" frontend/src/api/` | 无命中 |
| `DEP-05` 模块互不引用 | 遍历 `frontend/src/modules/*/`，检查是否 import 其他模块 | 无命中 |
| `DEP-06` 组件不引模块 | `grep -rn "from ['\"]@/modules" frontend/src/components/` | 无命中 |
| `DEP-07` 无跨层相对路径 | `grep -rn "from ['\"]\.\./\.\./" frontend/src/` | 无命中 |
| `DEP-08` 模块不直接用 Zondy | `grep -rn "new Zondy" frontend/src/modules/` | 无命中 |
| `DEP-09` 无硬编码地址 | `grep -rnE "127\.0\.0\.1\|localhost:[0-9]+\|:6163\|:8080" frontend/src/` | 无命中 |
| `DEP-10` 无硬编码 Key | `grep -rnE "tk=[0-9a-f]{16,}\|key=[0-9a-f]{16,}" frontend/src/` | 无命中 |
| `DEP-11` 无半成品标记 | `grep -rnE "TODO\|FIXME\|XXX\|console\.log" frontend/src backend/src` | 无命中 |
| `DEP-12` 无新旧库混用 | `grep -c "zondyclientOld" frontend/index.html` | 结果为 0 |

**规则 `T-07`：`DEP-11` 允许 `console.warn`/`console.error`，MUST NOT 允许 `console.log`。**

### 4.3 `CHK-IGS` 的具体检查项

| 子检查 | 命令 | 通过条件 |
|---|---|---|
| `IGS-01` 管理端可达 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:9999` | `200` 或 `302` |
| `IGS-02` IGS 服务可达 | `curl -s -o /dev/null -w "%{http_code}" http://localhost/igs/` | `200` 或 `404`（不返回 502/503） |
| `IGS-03` 地图文档可预览 | 通过管理端预览页手工确认 | 见 `MA-02` |
| `IGS-04` 图层索引正确 | `curl -s "http://localhost/igs/.../wh_facility/0"` | 返回 JSON 且含 `TotalCount` |

**规则 `T-08`：`IGS-01`/`IGS-02` 失败时 MUST 输出 `CHECK CHK-IGS FAIL 服务未启动：<具体哪个>` 并退出码 `2`。**

### 4.4 `CHK-API` 的具体检查项

| 子检查 | 命令 | 通过条件 |
|---|---|---|
| `API-01` | `curl -s http://localhost/api/v1/meta/dict` | `code=0`，`categories` 长度 5，`districts` 长度 3 |
| `API-02` | `curl -s "http://localhost/api/v1/facilities?size=1"` | `code=0`，`list` 为数组，字段名全为小驼峰 |
| `API-03` | `curl -s "http://localhost/api/v1/facilities/suggest?kw=%E5%85%B3%E5%B1%B1"` | `code∈{0,5001}`；不得出现 500 |
| `API-04` | `curl -s "http://localhost/api/v1/statistics/district?level=street"` | `code∈{0,2001}`，有数据时 `list` 非空 |
| `API-05` | `curl -s -X POST -d '{...}' .../analysis/service-area` | `code∈{0,2002}`，不应 500 |
| `API-06` | 同上 `.../analysis/accessibility` | `code∈{0,2002}` |
| `API-07` | `curl -s -D- -o /tmp/x.xlsx -X POST .../export/excel` | `Content-Type` 正确；文件头 3 字节为 `EF BB BF`（csv） |
| `API-08` | `curl -s http://localhost/api/v1/health` | `code=0`，`data.status ∈ {UP,DEGRADED}` |

**规则 `T-09`：`API-02` 的检查 MUST 额外验证"响应中不含 `FID`/`OBJECTID`/`CAT_L1`"（`A-21`）。**

### 4.5 `CHK-DATA` 的具体检查项

执行 `project/scripts/check_data.sql`（内容见 `02` §7 的 DI-01..DI-10），逐条执行并判断返回行数。

| 子检查 | 通过条件 |
|---|---|
| `DI-01`..`DI-10` | 每条返回行数 = 0（`DI-01`/`DI-02`/`DI-09` 为"差值 = 0"） |
| `DG-01`..`DG-06` | 由 `scripts/check_gdb.py` 输出，全部通过 |

### 4.6 每个 FR 对应的测试检查

**规则 `T-10`：每个 P0/P1 的 FR MUST 有唯一对应的 `CHK-TEST-<FR编号>`。命名规则：`CHK-TEST-M3-03`（对应 `FR-M3-03`）。**

**规则 `T-11`：`CHK-TEST-*` MUST 覆盖该 FR 的**全部** AC。MUST NOT 只覆盖部分。**

| FR | CHECK ID | 测试文件（建议路径） | 断言数下限 |
|---|---|---|---|
| FR-M1-01 | `CHK-TEST-M1-01` | `frontend/src/modules/map-base/__tests__/init.spec.js` | 4 |
| FR-M1-02 | `CHK-TEST-M1-02` | `map-base/__tests__/view.spec.js` | 3 |
| FR-M1-03 | `CHK-TEST-M1-03` | `map-base/__tests__/coord.spec.js` | 3 |
| FR-M1-04 | `CHK-TEST-M1-04` | `map-base/__tests__/measure.spec.js` | 3 |
| FR-M1-05 | `CHK-TEST-M1-05` | `map-base/__tests__/layer.spec.js` | 3 |
| FR-M1-06 | `CHK-TEST-M1-06` | `map-base/__tests__/basemap.spec.js` | 3 |
| FR-M1-07 | `CHK-TEST-M1-07` | `map-base/__tests__/fullscreen.spec.js` | 2 |
| FR-M2-01 | `CHK-TEST-M2-01` | `query/__tests__/attrQuery.spec.js` | 4 |
| FR-M2-02 | `CHK-TEST-M2-02` | `query/__tests__/clickQuery.spec.js` | 3 |
| FR-M2-03 | `CHK-TEST-M2-03` | `query/__tests__/spatialQuery.spec.js` | 2 |
| FR-M2-04 | `CHK-TEST-M2-04` | `query/__tests__/nearby.spec.js` | 3 |
| FR-M2-05 | `CHK-TEST-M2-05` | `query/__tests__/suggest.spec.js` | 3 |
| FR-M2-06 | `CHK-TEST-M2-06` | `query/__tests__/panel.spec.js` | 3 |
| FR-M3-01 | `CHK-TEST-M3-01` | `theme-viz/__tests__/symbol.spec.js` | 2 |
| FR-M3-02 | `CHK-TEST-M3-02` | `theme-viz/__tests__/classBreaks.spec.js` | 3 |
| FR-M3-03 | `CHK-TEST-M3-03` | `theme-viz/__tests__/heatmap.spec.js` | 4 |
| FR-M3-04 | `CHK-TEST-M3-04` | `theme-viz/__tests__/cluster.spec.js` | 3 |
| FR-M3-05 | `CHK-TEST-M3-05` | `theme-viz/__tests__/chartLink.spec.js` | 3 |
| FR-M3-06 | `CHK-TEST-M3-06` | `theme-viz/__tests__/compare.spec.js` | 2 |
| FR-M3-07 | `CHK-TEST-M3-07` | `theme-viz/__tests__/legend.spec.js` | 3 |
| FR-M4-01 | `CHK-TEST-M4-01` | `analysis/__tests__/buffer.spec.js` | 3 |
| FR-M4-02 | `CHK-TEST-M4-02` | `analysis/__tests__/serviceArea.spec.js` | 3 |
| FR-M4-03 | `CHK-TEST-M4-03` | `analysis/__tests__/kde.spec.js` | 2 |
| FR-M4-04 | `CHK-TEST-M4-04` | `analysis/__tests__/accessibility.spec.js` | 4 |
| FR-M4-05 | `CHK-TEST-M4-05` | `analysis/__tests__/coverage.spec.js` | 3 |
| FR-M4-06 | `CHK-TEST-M4-06` | `analysis/__tests__/resultManage.spec.js` | 2 |
| FR-M5-01 | `CHK-TEST-M5-01` | `report/__tests__/districtTable.spec.js` | 3 |
| FR-M5-02 | `CHK-TEST-M5-02` | `report/__tests__/composition.spec.js` | 2 |
| FR-M5-03 | `CHK-TEST-M5-03` | `report/__tests__/qualified.spec.js` | 2 |
| FR-M5-04 | `CHK-TEST-M5-04` | `report/__tests__/export.spec.js` | 3 |

### 4.7 后端单元测试（必须覆盖纯算法）

| 模块 | CHECK ID | 测试文件 | 断言数下限 | 说明 |
|---|---|---|---|---|
| 2SFCA | `CHK-TEST-BE-2SFCA` | `AccessibilityServiceTest.java` | 6 | 含 `BINARY`/`LINEAR`/`GAUSSIAN` 三种衰减 |
| 断点分级 | `CHK-TEST-BE-BREAKS` | `BreaksUtilTest.java` | 4 | Jenks 与等间距两种 |
| Excel 导出 | `CHK-TEST-BE-EXPORT` | `ExportServiceTest.java` | 3 | 含 BOM 校验、空表头校验 |
| 字段映射 | `CHK-TEST-BE-MAPPING` | `FieldMappingTest.java` | 3 | 含 5 条例外映射 |

**2SFCA 测试用例（强制，MUST 逐条实现）**

| 用例 | 输入 | 期望输出 | 目的 |
|---|---|---|---|
| `TC-2SFCA-1` | 1 设施 S=100，1 居住点 D=100，t=0，BINARY | R=1，A=1 | 基本正确性 |
| `TC-2SFCA-2` | 1 设施 S=100，2 居住点各 D=100，t=0 | R=0.5，各 A=0.5 | 分母累加 |
| `TC-2SFCA-3` | 1 设施，居住点 t > threshold | R 分母不含该点，A=0 | 阈值截断 |
| `TC-2SFCA-4` | 设施 S=null | 按 S=1 计算，且 `capacityFallback=true` | 缺规模降级 |
| `TC-2SFCA-5` | 分母为 0（无需求点） | R=0，不抛异常 | 除零保护 |
| `TC-2SFCA-6` | GAUSSIAN，t=threshold/2 | `f(t)=exp(-0.5)`≈0.6065 | 衰减函数正确 |

---

## 5. 启动顺序验证（对应 `04` §6.2）

**规则 `T-12`：每步 MUST 验证通过才进入下一步。验证命令 MUST 原样执行。**

| 步 | 验证命令 | 通过条件 |
|---|---|---|
| 1 | `mysqladmin -u root -p ping` | 输出 `mysqld is alive` |
| 2 | `mysql -u root -p -e "SELECT COUNT(*) FROM gis_facility.DICT_CATEGORY;"` | 结果 `25` |
| 3 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:9999` | `200` 或 `302` |
| 4 | 管理端"地图与数据服务"列表 | 存在地图/瓦片/要素服务各 ≥ 1 |
| 5 | `curl -s http://localhost/api/v1/health` | `data.status=UP` |
| 6 | `curl -s -o /dev/null -w "%{http_code}" http://localhost/` | `200` |
| 7 | 浏览器打开首页 | 地图在 5 秒内渲染完成，console 无 error |

---

## 6. 测试数据规则

| ID | 规则 |
|---|---|
| `T-13` | 单元测试 MUST 使用固定 fixture，MUST NOT 读真实数据库或网络。 |
| `T-14` | Fixture MUST 放在 `__fixtures__/` 目录，命名 `<用途>.json`。 |
| `T-15` | Fixture 中的坐标 MUST 为真实研究区范围内的合理值（`113.5<lon<115.5`，`29.5<lat<31.5`）。 |
| `T-16` | MUST NOT 在测试中使用随机数；如需随机，MUST 固定种子。 |
| `T-17` | 时间相关测试 MUST 注入固定时间，MUST NOT 依赖 `new Date()`。 |
| `T-18` | 接口测试 MUST 使用独立的测试库 `gis_facility_test`，MUST NOT 污染正式库。 |

---

## 7. 手工验收清单（AI 无法自动判定的部分）

**规则 `T-19`：以下验收 MUST 由人工执行，并在《验收记录》中逐条打勾。MUST NOT 由 agent 代替判定。**

| ID | 验收项 | 操作 | 通过标准 |
|---|---|---|---|
| `MA-01` | 稳定性 | 连续操作 30 分钟（缩放/查询/切图/分析） | 无崩溃、无内存溢出、无白屏 |
| `MA-02` | 地图服务可预览 | 管理端点击"预览" | 地图渲染正常，图层目录可见 |
| `MA-03` | 视觉一致性 | 逐页对照设计稿 | 配色/字号/间距与 `05` §2 一致 |
| `MA-04` | 分析成果完整 | 依次生成缓冲/服务区/可达性 | 4 类专题图齐全，图例正确 |
| `MA-05` | 合规检查 | 检查底图来源、界面标注、数据来源说明 | 全部可追溯，无境外底图 |
| `MA-06` | 演示脚本 | 按 3 分钟脚本走一遍 | 11 步全部成功，无卡顿超 3 秒 |
| `MA-07` | 中文无乱码 | 导出 xlsx/csv 用 Excel 打开 | 中文正常，无 `????` |
| `MA-08` | 跨分辨率 | 1366×768 与 1920×1080 各看一遍 | 无遮挡、无溢出 |

---

## 8. 缺陷分级与响应

| 级别 | 定义 | 示例 | 响应时限 |
|---|---|---|---|
| `BLOCKER` | 主流程不可用 | 地图加载失败、服务起不来 | 4 小时内 |
| `MAJOR` | 主要功能异常但有绕过 | 查询无结果、导出乱码 | 当天 |
| `MINOR` | 视觉/文案/次要交互 | 图例错位、文案错别字 | 3 天内 |

**规则 `T-20`：`BLOCKER` 未修复前，MUST NOT 推进新任务。**

---

## 9. 禁止事项（T 系列）

| ID | 禁令 | 判定为失败 |
|---|---|---|
| `T-21` | 不得写不会失败的断言 | `expect(true).toBe(true)`、`assert 1==1` |
| `T-22` | 不得跳过测试 | `.skip`/`.only`/`@Ignore`/`@Disabled` |
| `T-23` | 不得注释断言 | diff 中断言被注释 |
| `T-24` | 不得改测试迁就实现 | 为实现通过的改动只出现在测试文件 |
| `T-25` | 不得让 `CHK-*` 检查"永远 PASS" | 检查脚本里出现 `exit 0` 固定返回 |
| `T-26` | 不得在测试中访问真实外网 | 出现真实 `tianditu`/`amap` 域名 |
| `T-27` | 不得用固定字符串代替真实断言 | `expect(res).toBeDefined()` 作为唯一断言 |
| `T-28` | 不得省略 `CHK-TEST-*` 的 AC 覆盖 | 某 AC 无对应用例 |
| `T-29` | 不得让在线检查在服务未起时报"代码失败" | 退出码用 1 而非 2 |
| `T-30` | 不得在测试中打印敏感信息 | 日志含 Key/密码 |

---

## 10. 修订记录

| 版本 | 日期 | 修订内容 |
|---|---|---|
| 1.0.0 | 2026-10-21 | 初始发布：6 层测试、check.sh 契约、8 个通用 CHECK、30 个 FR 检查、8 项手工验收 |

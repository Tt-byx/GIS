# 07 · TASKS

| 字段 | 值 |
|---|---|
| `spec.id` | SPEC-07 |
| `spec.version` | 1.0.0 |
| `spec.status` | FROZEN（任务状态部分动态更新） |
| `spec.owner` | 项目组 |
| `spec.updated` | 2026-10-21 |
| `spec.depends_on` | `00`–`06` 全部 |
| `spec.authority` | 第 8 顺位。任务拆分与依赖的唯一权威。 |

---

## 1. 拆分原则（强制）

| ID | 原则 |
|---|---|
| `TK-01` | 每个任务 MUST 有**唯一且可观察的产出**（一个文件、一个接口、一份数据）。 |
| `TK-02` | 每个任务 MUST ≤ 8 小时。超出 MUST 继续拆。 |
| `TK-03` | 每个任务 MUST 有**文件白名单**，且 MUST NOT 出现"按需修改"。 |
| `TK-04` | 每个任务的 DoD MUST 全部是**命令 + 退出码**，MUST NOT 含"效果良好""基本可用"。 |
| `TK-05` | 任务依赖 MUST 构成有向无环图（DAG）。MUST NOT 出现循环依赖。 |
| `TK-06` | 一个任务 MUST NOT 同时改前端与后端（联调类任务除外，须在任务名标注 `[联调]`）。 |
| `TK-07` | 任务编号 MUST NOT 复用；作废任务 MUST 标 `REJECTED` 并保留。 |
| `TK-08` | "允许修改"字段中若使用 `...` 缩写，其含义**固定为"紧邻上一条完整路径的目录部分"**。样例：上一条为 `a/b/c.js`，则 `.../d.js` 等价于 `a/b/d.js`。MUST NOT 作其他解释。 |

---

## 2. 任务字段模板（强制格式）

**每个任务 MUST 严格按以下字段书写，缺一即为规范缺陷。**

```
#### T-<三位序号> <名称> [<可选：联调/数据/人工>]

| 字段 | 值 |
|---|---|
| 状态 | TODO / DOING / BLOCKED / DONE / REJECTED |
| 依赖 | T-xxx, T-yyy（无则写 `无`） |
| 允许修改 | `path1`, `path2`（MUST 为完整相对路径或目录前缀） |
| 读这些 | `SPEC/0X-xxx.md` §N（MUST 精确到节） |
| 产出 | 一句话，可观察 |
| DoD | 1) `命令` 退出 0；2) `CHK-xxx` PASS；3) AC-xxx-1..N 通过 |
| 工时 | Nh |
| 提交 | `type(scope): subject` |
```

---

## 3. 任务状态定义

| 状态 | 含义 | 进入条件 |
|---|---|---|
| `TODO` | 未开始 | 初始状态 |
| `DOING` | 进行中 | 已确认依赖全部 `DONE` |
| `BLOCKED` | 阻塞 | 已按 `05` §9 模板登记 |
| `DONE` | 完成 | 全部 DoD 通过 + 完成报告已提交 |
| `REJECTED` | 作废 | 明确不做的任务（如 P2 未排期项） |

**规则 `TK-08`：`DONE` MUST 由完成报告支撑。MUST NOT 只改状态不写报告。**

---

## 4. 阶段 0：环境与骨架

### T-001 仓库骨架与目录初始化

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | 无 |
| 允许修改 | `project/.gitignore`, `project/README.md`, `project/frontend/`, `project/backend/`, `project/db/`, `project/scripts/`, `project/data/.gitkeep` |
| 读这些 | `04-architecture.md` §3, §4 |
| 产出 | 与 `04` §3/§4 完全一致的目录树（空目录用 `.gitkeep` 占位） |
| DoD | 1) `ls -R project` 输出与 `04` §3/§4 一致；2) `CHK-LINT` 退出 0（允许空实现） |
| 工时 | 2h |
| 提交 | `chore(T-001): 初始化仓库骨架与目录结构` |

### T-002 MySQL 建库与种子数据

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | 无 |
| 允许修改 | `project/db/schema.sql`, `project/db/seed.sql` |
| 读这些 | `02-data-model.md` §4, §5 |
| 产出 | 可执行的建库脚本与种子脚本 |
| DoD | 1) `mysql < schema.sql` 退出 0；2) `mysql < seed.sql` 退出 0；3) `CHK-DATA` 中 `DI-01`/`DI-02` 通过（字典 25 条、区 3 条） |
| 工时 | 2h |
| 提交 | `chore(T-002): 建立业务库 DDL 与种子数据` |

### T-003 前端工程脚手架

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-001 |
| 允许修改 | `project/frontend/package.json`, `project/frontend/vite.config.js`, `project/frontend/index.html`, `project/frontend/src/main.js`, `project/frontend/src/App.vue`, `project/frontend/.eslintrc.cjs` |
| 读这些 | `04-architecture.md` §3, §5.1；`05-conventions.md` §3.1 |
| 产出 | 可 `npm run dev` 启动的空壳页面（含顶栏/底栏/左右面板容器） |
| DoD | 1) `npm run build` 退出 0 且 `dist/index.html` 存在；2) `CHK-LINT` 退出 0；3) `@/` 别名可用（`vite.config.js` 配置项存在） |
| 工时 | 4h |
| 提交 | `chore(T-003): 搭建 Vue3 + Vite 前端脚手架` |

### T-004 后端工程脚手架

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-001 |
| 允许修改 | `project/backend/pom.xml`, `project/backend/src/main/java/com/example/gis/GisApplication.java`, `project/backend/src/main/java/com/example/gis/common/`, `project/backend/src/main/java/com/example/gis/config/`, `project/backend/src/main/resources/application.yml` |
| 读这些 | `04-architecture.md` §4, §5.2；`05-conventions.md` §3.2, §4 |
| 产出 | 可启动的 Spring Boot 应用，含 `R` 统一响应、`ErrorCode` 枚举、`GlobalExceptionHandler` |
| DoD | 1) `mvn -q clean package` 退出 0；2) `java -jar target/*.jar` 启动后 `curl /api/v1/health` 返回 JSON；3) `ErrorCode` 枚举值与 `05` §4 完全一致（10 项） |
| 工时 | 5h |
| 提交 | `chore(T-004): 搭建 Spring Boot 后端脚手架与统一响应` |

### T-005 自检脚本骨架

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-001 |
| 允许修改 | `project/scripts/check.sh`, `project/scripts/check.ps1`, `project/scripts/check_data.sql`, `project/scripts/lib/` |
| 读这些 | `06-testing.md` §3, §4 |
| 产出 | 实现 `CHK-LINT`/`CHK-BUILD`/`CHK-DEP` 三项，输出格式符合 `06` §3.2 |
| DoD | 1) `scripts/check.sh CHK-LINT` 输出匹配 `^CHECK CHK-LINT (PASS\|FAIL) `；2) 退出码语义正确（0/1/2）；3) `scripts/check.sh all` 可执行 |
| 工时 | 4h |
| 提交 | `chore(T-005): 实现自检脚本入口与静态检查` |

### T-006 Nginx 配置与反代

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-003, T-004 |
| 允许修改 | `project/deploy/nginx.conf`, `project/README.md` |
| 读这些 | `04-architecture.md` §1.1, §6.2 |
| 产出 | Nginx 配置：`/`→dist、`/api/`→8080、`/igs/`→6163 |
| DoD | 1) `curl -o /dev/null -w "%{http_code}" http://localhost/` 返回 `200`；2) `curl http://localhost/api/v1/health` 返回 JSON；3) `curl -o /dev/null -w "%{http_code}" http://localhost/igs/` 非 502/503 |
| 工时 | 3h |
| 提交 | `chore(T-006): 配置 Nginx 统一入口与反向代理` |

### T-007 MapGIS 客户端库接入与最小地图

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-003, T-006 |
| 允许修改 | `project/frontend/public/libs/`, `project/frontend/index.html`, `project/frontend/src/App.vue` |
| 读这些 | `04-architecture.md` §3, §7（`R-10`） |
| 产出 | 页面加载后显示 MapGIS 地图（可为示例数据），控制台无 error |
| DoD | 1) `CHK-DEP` 中 `DEP-12` 通过（未引入 `zondyclientOld`）；2) `CHK-BUILD` 退出 0；3) 手工：`MA` 项"地图渲染"通过（截图存 `project/docs/screenshots/`） |
| 工时 | 5h |
| 提交 | `feat(FR-M1-01): 接入 MapGIS 客户端库并渲染最小地图` |

### T-008 配置源统一

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-003, T-004 |
| 允许修改 | `project/frontend/src/config/index.js`, `project/frontend/src/config/symbols.js`, `project/backend/src/main/resources/application.yml` |
| 读这些 | `04-architecture.md` §5；`02-data-model.md` §5（颜色） |
| 产出 | 前端 11 个配置键 + 后端 11 个配置键，与 `04` §5 完全一致 |
| DoD | 1) `CHK-DEP` 中 `DEP-09`/`DEP-10` 通过；2) `symbols.js` 的 5 个颜色与 `DICT_CATEGORY.COLOR_HEX` 完全一致（脚本校验）；3) `application.yml` 无明文密码/Key |
| 工时 | 3h |
| 提交 | `chore(T-008): 统一前后端配置源` |

---

## 5. 阶段 1：数据（`[数据]`）

### T-010 POI 网格抓取脚本

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | 无 |
| 允许修改 | `project/data-scripts/01_fetch_poi.py`, `project/data-scripts/.cache/` |
| 读这些 | 需求文档 §5.3.2（抓取规范） |
| 产出 | 按 0.01°×0.01° 网格抓取五类 POI，输出 `data/raw/poi_<cat>_<date>.csv` |
| DoD | 1) 五类各产出 1 个 CSV，行数 > 0；2) 脚本日志记录每格返回条数；3) 重复执行不覆盖已有文件（带日期后缀） |
| 工时 | 8h |
| 提交 | `feat(T-010): 实现 POI 网格抓取脚本` |

### T-011 数据清洗与坐标转换

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-010 |
| 允许修改 | `project/data-scripts/02_clean.py`, `project/data/clean/` |
| 读这些 | 需求文档 §5.3.3（坐标转换）、`02-data-model.md` §3.2 |
| 产出 | 清洗后 CSV，坐标统一为 CGCS2000，字段名对齐 `FACILITY` |
| DoD | 1) 输出行数 ≤ 输入行数且 > 0；2) 抽样 20 点坐标偏移 < 50m（脚本输出偏移统计）；3) 所有 `LON`/`LAT` 落在 `113.5–115.5` / `29.5–31.5` |
| 工时 | 8h |
| 提交 | `feat(T-011): 实现数据清洗与坐标转换` |

### T-012 名称与类别标准化

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-011 |
| 允许修改 | `project/data-scripts/03_normalize.py`, `project/data/clean/` |
| 读这些 | 需求文档 §5.3.4（命名规则）、`02-data-model.md` §3.2, §5 |
| 产出 | 标准化后 CSV，`CAT_L1`/`CAT_L2` 全部命中字典，`FAC_CODE` 已生成 |
| DoD | 1) 未匹配字典的 `CAT_L2` 数量 = 0，否则输出待人工确认清单；2) `FAC_CODE` 唯一性检查通过（重复 = 0）；3) `FAC_CODE` 格式匹配 `^\d{6}-[A-Z]{3}-[A-Z]{3}-\d{4}$` |
| 工时 | 6h |
| 提交 | `feat(T-012): 实现设施名称与类别标准化` |

### T-013 数据质量核验与质量报告

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-012 |
| 允许修改 | `project/data-scripts/04_quality_check.py`, `project/scripts/check_gdb.py`, `project/docs/数据质量报告.md` |
| 读这些 | `02-data-model.md` §7（`DG-01..DG-06`）、需求文档 §5.5 |
| 产出 | 数据质量报告，含 8 项指标实测值 |
| DoD | 1) `CHK-DATA` 中 `DG-01..DG-06` 全部 PASS；2) 报告含 DQ-01..DQ-08 的实测值与达标判定；3) 抽样 30 点核对表已填写 |
| 工时 | 6h |
| 提交 | `feat(T-013): 实现数据质量核验并输出质量报告` |

### T-014 GDB 建库与空间连接（`[数据][人工]`）

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-012 |
| 允许修改 | `project/data/gdb/`, `project/docs/建库记录.md` |
| 读这些 | `02-data-model.md` §3.1, §3.2, §3.3 |
| 产出 | MapGIS GDB，含 `FACILITY`/`DISTRICT`/`STREET`/`RESIDENTIAL`/`ROAD` 五个图层，属性索引已建 |
| DoD | 1) 用 `T-013` 脚本读 GDB，`DG-01..DG-06` 全 PASS；2) `FACILITY` 记录数 ≥ 3000；3) `STREET_CODE` 空值率 < 5% 并在报告中说明；4) 建库记录写明空间连接参数 |
| 工时 | 8h |
| 提交 | `feat(T-014): 完成 GDB 建库与行政区/街道空间连接` |

### T-015 符号库与地图文档（`[数据][人工]`）

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-014 |
| 允许修改 | `project/data/mapdoc/`, `project/docs/制图说明.md` |
| 读这些 | `01-requirements.md` FR-M3-01；`02-data-model.md` §5（颜色） |
| 产出 | `.mapx` 地图文档，五类设施分类符号，配色与字典一致 |
| DoD | 1) 地图文档可被 Desktop 打开且五类符号各异（非仅颜色区分）；2) 截图存 `project/docs/screenshots/mapdoc.png`；3) 制图说明记录符号库路径 |
| 工时 | 6h |
| 提交 | `feat(T-015): 制作符号库与地图文档` |

### T-016 瓦片裁剪

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-015 |
| 允许修改 | `project/data/tiles/`, `project/docs/制图说明.md` |
| 读这些 | `04-architecture.md` §6.2；需求文档 §5.6（动态裁图） |
| 产出 | 底图瓦片目录，可被 IGServer 发布 |
| DoD | 1) 瓦片目录存在且层级 8–18；2) 管理端可预览瓦片；3) 裁图方式为 `天地图裁图方式`（便于叠加），记录在制图说明 |
| 工时 | 4h |
| 提交 | `feat(T-016): 裁剪底图瓦片` |

### T-017 路网拓扑与网络数据集（`[数据][人工]`）

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-014 |
| 允许修改 | `project/data/gdb/`, `project/docs/建库记录.md` |
| 读这些 | `02-data-model.md` §3.4 |
| 产出 | 拓扑连通的路网 + IGServer 可用的网络数据集 |
| DoD | 1) 拓扑检查：悬挂点 = 0 或已逐一说明；2) 网络数据集可被管理端识别；3) `ROAD.WALK_SPEED` 全部 > 0 |
| 工时 | 6h |
| 提交 | `feat(T-017): 构建路网拓扑与网络数据集` |

### T-018 OD 矩阵生成与入库

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-017 |
| 允许修改 | `project/data-scripts/05_build_od.py`, `project/data/od/`, `project/docs/建库记录.md` |
| 读这些 | `03-api-contract.md` §8（2SFCA 定义）、`02-data-model.md` §4（`OD_MATRIX_META`） |
| 产出 | `od_matrix.csv`（列：`facCode,resCode,minutes`）+ `OD_MATRIX_META` 一条 `IS_ACTIVE=1` |
| DoD | 1) CSV 行数 = 设施数 × 居住点数（或已按阈值截断，需说明）；2) `CHK-DATA` 的 `DI-09` 通过（仅 1 个 active）；3) `mvn test` 的 `CHK-TEST-BE-2SFCA` 使用该矩阵可通过 |
| 工时 | 6h |
| 提交 | `feat(T-018): 生成 OD 成本矩阵并登记元信息` |

---

## 6. 阶段 2：服务层

### T-020 IGServer 服务发布

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-015, T-016 |
| 允许修改 | `project/docs/服务发布清单.md` |
| 读这些 | `03-api-contract.md` §11 |
| 产出 | 地图服务、瓦片服务、要素服务各 ≥ 1，服务名与图层索引已记录 |
| DoD | 1) `CHK-IGS` 的 `IGS-01..IGS-04` 全 PASS；2) 发布清单含：服务名、类型、图层索引、预览截图路径；3) 图层索引与 `04` §5.1 的 `LAYERS` 一致 |
| 工时 | 5h |
| 提交 | `chore(T-020): 发布地图/瓦片/要素服务` |

### T-021 空间分析功能服务配置（`[人工]`）

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-020 |
| 允许修改 | `project/docs/服务发布清单.md` |
| 读这些 | `03-api-contract.md` §11.3；`04-architecture.md` `AR-13` |
| 产出 | 网络分析功能服务已发布，服务名记录在清单 |
| DoD | 1) 管理端"功能服务"列表中存在网络分析模板；2) 手工执行一次模板返回非空结果；3) 服务名写入 `application.yml` 的 `igs.serviceName` |
| 工时 | 6h |
| 提交 | `chore(T-021): 配置网络分析功能服务` |

### T-022 IgsClient 封装

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-004, T-020 |
| 允许修改 | `project/backend/src/main/java/com/example/gis/client/IgsClient.java`, `project/backend/src/test/java/.../IgsClientTest.java` |
| 读这些 | `04-architecture.md` `AR-11`；`03-api-contract.md` §11 |
| 产出 | 统一的 IGServer HTTP 客户端：超时、重试（≤2 次）、错误码转换 |
| DoD | 1) `CHK-DEP` 的 `DEP-01..DEP-12` 全 PASS；2) `CHK-TEST-BE-CLIENT` 通过（含超时、502、404 三种情形）；3) service 层无 `http://` 字面量 |
| 工时 | 5h |
| 提交 | `feat(T-022): 封装 IgsClient 统一 IGServer 调用` |

### T-023 API-01 字典接口

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-004, T-002 |
| 允许修改 | `project/backend/src/main/java/.../controller/MetaController.java`, `.../service/DictService.java`, `.../mapper/Dict*Mapper.java`, `.../dto/DictResponse.java` |
| 读这些 | `03-api-contract.md` §3；`02-data-model.md` §6 |
| 产出 | `GET /api/v1/meta/dict` 完整实现 |
| DoD | 1) `CHK-API` 的 `API-01` 通过（5 大类、3 区）；2) `categories` 按 `SORT_NO` 升序；3) `tiandituToken` 为占位符时返回 `""`；4) `CHK-TEST-META` 通过 |
| 工时 | 4h |
| 提交 | `feat(FR-M2-01): 实现字典接口 API-01` |

### T-024 API-02 设施查询

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-022, T-023 |
| 允许修改 | `.../controller/FacilityController.java`, `.../service/FacilityService.java`, `.../dto/FacilityDto.java`, `.../dto/PageResult.java` |
| 读这些 | `03-api-contract.md` §4；`02-data-model.md` §6.2, §6.3 |
| 产出 | `GET /api/v1/facilities` 完整实现（含分页、多条件、字段映射） |
| DoD | 1) `CHK-API` 的 `API-02` 通过；2) 响应不含 `FID`/`CAT_L1`（`A-21`）；3) 5 条例外映射正确（`categoryL1`/`districtName`/`streetName`/`communityName`/`capacityUnit`）；4) `CHK-TEST-BE-MAPPING` 通过 |
| 工时 | 6h |
| 提交 | `feat(FR-M2-01): 实现设施查询接口 API-02` |

### T-025 API-03 名称补全代理

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-023 |
| 允许修改 | `.../service/SuggestService.java`, `.../controller/FacilityController.java`, `.../config/CacheConfig.java` |
| 读这些 | `03-api-contract.md` §5 |
| 产出 | `GET /api/v1/facilities/suggest`，含 Caffeine 缓存与字段裁剪 |
| DoD | 1) `CHK-API` 的 `API-03` 通过；2) 响应仅含 `name`/`district`/`lon`/`lat`；3) Key 不出现在响应与日志（`grep` 校验）；4) 同一 `kw` 二次请求命中缓存（日志验证） |
| 工时 | 4h |
| 提交 | `feat(FR-M2-05): 实现名称补全代理 API-03` |

### T-026 API-08 健康检查

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-022 |
| 允许修改 | `.../controller/MetaController.java`, `.../service/HealthService.java`, `.../dto/HealthResponse.java` |
| 读这些 | `03-api-contract.md` §10 |
| 产出 | `GET /api/v1/health` |
| DoD | 1) `CHK-API` 的 `API-08` 通过；2) 三个组件状态各自可独立返回 `DOWN`（断连测试）；3) 检查超时 ≤ 5s |
| 工时 | 3h |
| 提交 | `feat(FR-M1-01): 实现健康检查 API-08` |

### T-027 API-04 分区统计

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-023 |
| 允许修改 | `.../controller/StatsController.java`, `.../service/StatsService.java`, `.../mapper/StatDistrictMapper.java`, `.../dto/StatDto.java` |
| 读这些 | `03-api-contract.md` §6；`02-data-model.md` §6.4 |
| 产出 | `GET /api/v1/statistics/district` |
| DoD | 1) `CHK-API` 的 `API-04` 通过；2) `unit` 按 `metric` 正确映射三值；3) `value` 为 `NULL` 时返回 `null` 而非 `0`（`A-23`）；4) 只查 `MAX(DATA_DATE)` |
| 工时 | 4h |
| 提交 | `feat(FR-M5-01): 实现分区统计接口 API-04` |

### T-028 API-05 网络服务区

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-021, T-022, T-027 |
| 允许修改 | `.../controller/AnalysisController.java`, `.../service/ServiceAreaService.java`, `.../mapper/Analysis*Mapper.java`, `.../dto/ServiceAreaReq.java`, `.../dto/ServiceAreaResp.java` |
| 读这些 | `03-api-contract.md` §7；`02-data-model.md` §4（`ANALYSIS_TASK`/`RESULT`） |
| 产出 | `POST /api/v1/analysis/service-area`，含任务落库与 24h 幂等缓存 |
| DoD | 1) `CHK-API` 的 `API-05` 通过；2) 相同 `params` 24h 内返回相同 `taskId` 且 `elapsedMs=0`；3) `coverageRate = 1 - uncovered/total`（精度 3 位）；4) 任务状态完整走 `RUNNING→SUCCESS` |
| 工时 | 8h |
| 提交 | `feat(FR-M4-02): 实现网络服务区接口 API-05` |

### T-029 API-06 可达性 2SFCA

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-018, T-027 |
| 允许修改 | `.../service/AccessibilityService.java`, `.../service/BreaksUtil.java`, `.../controller/AnalysisController.java`, `.../dto/AccessibilityReq.java`, `.../dto/AccessibilityResp.java`, `src/test/java/.../AccessibilityServiceTest.java` |
| 读这些 | `03-api-contract.md` §8；`06-testing.md` §4.7（`TC-2SFCA-1..6`） |
| 产出 | `POST /api/v1/analysis/accessibility` |
| DoD | 1) `CHK-TEST-BE-2SFCA` 的 6 个用例全 PASS；2) `CHK-API` 的 `API-06` 通过；3) `breaks` 长度 6、严格递增、首末等于 min/max；4) `thresholdMinutes` 非 5/10/15 返回 `1002` |
| 工时 | 8h |
| 提交 | `feat(FR-M4-04): 实现 2SFCA 可达性接口 API-06` |

### T-030 API-07 Excel 导出

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-027 |
| 允许修改 | `.../controller/ExportController.java`, `.../service/ExportService.java`, `.../mapper/ExportLogMapper.java`, `.../dto/ExportReq.java`, `src/test/java/.../ExportServiceTest.java` |
| 读这些 | `03-api-contract.md` §9 |
| 产出 | `POST /api/v1/export/excel`，支持 xlsx/csv |
| DoD | 1) `CHK-API` 的 `API-07` 通过；2) csv 前 3 字节为 `EF BB BF`；3) 文件名匹配 `.*_\d{14}\.(xlsx\|csv)`；4) 空结果仍生成只有表头的文件且 `X-Row-Count=0` |
| 工时 | 6h |
| 提交 | `feat(FR-M5-04): 实现导出接口 API-07` |

### T-031 openapi.yaml 契约文件

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-023..T-030 全部 |
| 允许修改 | `project/api/openapi.yaml` |
| 读这些 | `03-api-contract.md` 全文 |
| 产出 | 8 个接口的 OpenAPI 3.0 描述 |
| DoD | 1) `npx @redocly/cli lint openapi.yaml` 退出 0（或等价校验）；2) 8 个 path 与 `03` §1 完全一致；3) 所有 schema 字段名与 `02` §6 映射一致 |
| 工时 | 5h |
| 提交 | `docs(T-031): 补充 OpenAPI 契约文件` |

---

## 7. 阶段 3：前端

### T-040 地图内核 core

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-007, T-008 |
| 允许修改 | `project/frontend/src/core/` |
| 读这些 | `04-architecture.md` §2.2, §3.1 |
| 产出 | `mapInstance`（`markRaw`）、`serviceFactory`、`layerRegistry`、`eventBus`（含 9 个事件常量）、`geoUtil` |
| DoD | 1) `CHK-DEP` 的 `DEP-03` 通过（core 不引 api/modules/components/stores）；2) `CHK-UNIT` 中 `geoUtil` 测试通过（坐标/WKT 转换）；3) 事件常量与 `04` §2.3 的 9 个完全一致 |
| 工时 | 8h |
| 提交 | `feat(T-040): 实现前端地图内核 core` |

### T-041 M1 地图基础操作

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-040 |
| 允许修改 | `project/frontend/src/modules/map-base/` |
| 读这些 | `01-requirements.md` FR-M1-01..04, FR-M1-06, FR-M1-07 |
| 产出 | `initMap`/`setBasemap`/`zoomIn`/`zoomOut`/`reset`/`prevView`/`measure`/`clearMeasure`/`toggleFullscreen`/`screenshot` |
| DoD | 1) `CHK-TEST-M1-01..04`、`CHK-TEST-M1-06`、`CHK-TEST-M1-07` 全 PASS；2) `CHK-DEP` 的 `DEP-08` 通过（不直接 `new Zondy`）；3) 手工：`MA-03` 视觉检查通过 |
| 工时 | 8h |
| 提交 | `feat(FR-M1-02): 实现地图基础操作模块` |

### T-042 图层树与图例组件

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-040, T-041 |
| 允许修改 | `project/frontend/src/components/LayerTree.vue`, `project/frontend/src/components/Legend.vue`, `project/frontend/src/modules/map-base/layerControl.js`, `project/frontend/src/stores/mapStore.js` |
| 读这些 | `01-requirements.md` FR-M1-05, FR-M3-07 |
| 产出 | 图层树（三组）、图例（四种模式切换）、透明度控制 |
| DoD | 1) `CHK-TEST-M1-05`、`CHK-TEST-M3-07` 通过；2) 图例随专题模式切换（分类/分级/热力/聚合）；3) 图层顺序调整后实际渲染顺序同步 |
| 工时 | 6h |
| 提交 | `feat(FR-M1-05): 实现图层树与动态图例` |

### T-043 M2 查询与定位

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-024, T-025, T-040 |
| 允许修改 | `project/frontend/src/modules/query/`, `project/frontend/src/api/facility.js`, `project/frontend/src/stores/filterStore.js` |
| 读这些 | `01-requirements.md` FR-M2-01..05；`03-api-contract.md` §4, §5 |
| 产出 | `searchByAttr`/`queryByGeometry`/`searchNearby`/`suggest`/`flyToFeature` |
| DoD | 1) `CHK-TEST-M2-01..05` 全 PASS；2) 防抖 300ms（`CHK-TEST-M2-05` 校验）；3) `distanceM` 为整数且升序 |
| 工时 | 8h |
| 提交 | `feat(FR-M2-01): 实现设施查询与定位模块` |

### T-044 属性面板

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-043 |
| 允许修改 | `project/frontend/src/components/PanelShell.vue`, `project/frontend/src/modules/query/detailPanel.js` |
| 读这些 | `01-requirements.md` FR-M2-06 |
| 产出 | 右侧滑入面板，15 个字段固定顺序，空值显示 `—` |
| DoD | 1) `CHK-TEST-M2-06` 通过；2) 宽度 ≤ 360px；3) 无 `null`/`undefined`/`NaN` 字样（DOM 文本扫描） |
| 工时 | 5h |
| 提交 | `feat(FR-M2-06): 实现设施属性面板` |

### T-045 M3 分类符号、分级设色、图层对比

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-042, T-027 |
| 允许修改 | `project/frontend/src/modules/theme-viz/`, `project/frontend/src/api/stats.js` |
| 读这些 | `01-requirements.md` FR-M3-01, FR-M3-02, FR-M3-06 |
| 产出 | `applySymbols`/`applyClassBreaks`/`enterCompare`/`exitCompare` |
| DoD | 1) `CHK-TEST-M3-01`、`CHK-TEST-M3-02`、`CHK-TEST-M3-06` 通过；2) 分级图例显示 5 个数值区间；3) 退出对比恢复可见性快照 |
| 工时 | 8h |
| 提交 | `feat(FR-M3-02): 实现分级设色与图层对比` |

### T-046 M3 热力图

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-040 |
| 允许修改 | `project/frontend/src/modules/theme-viz/heatmap.js`, `project/frontend/src/modules/theme-viz/index.js` |
| 读这些 | `01-requirements.md` FR-M3-03 |
| 产出 | `applyHeatmap`/`clearHeatmap`，热力层数量恒为 1 |
| DoD | 1) `CHK-TEST-M3-03` 的 4 个断言全 PASS；2) 热力层 z-index < 设施点层；3) 色带冷→暖 |
| 工时 | 6h |
| 提交 | `feat(FR-M3-03): 实现热力图渲染与清除` |

### T-047 M3 聚合图

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-040 |
| 允许修改 | `project/frontend/src/modules/theme-viz/cluster.js`, `project/frontend/src/modules/theme-viz/index.js` |
| 读这些 | `01-requirements.md` FR-M3-04 |
| 产出 | `applyCluster`/`clearCluster`，zoom<14 聚合、≥14 散开 |
| DoD | 1) `CHK-TEST-M3-04` 通过；2) 聚合时原点图层隐藏（无重影）；3) 点击气泡 zoom+2 |
| 工时 | 5h |
| 提交 | `feat(FR-M3-04): 实现聚合图` |

### T-048 M3 图表联动

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-045 |
| 允许修改 | `project/frontend/src/modules/theme-viz/chartLink.js`, `project/frontend/src/components/ChartPanel.vue` |
| 读这些 | `01-requirements.md` FR-M3-05 |
| 产出 | 饼图 + 柱状图，点击联动地图高亮 |
| DoD | 1) `CHK-TEST-M3-05` 通过；2) 配色与 `symbols.js` 一致；3) 数据源为 `API-04`（Network 仅 1 次请求） |
| 工时 | 6h |
| 提交 | `feat(FR-M3-05): 实现统计图表与地图联动` |

### T-049 M4 缓冲区

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-040 |
| 允许修改 | `project/frontend/src/modules/analysis/buffer.js`, `project/frontend/src/modules/analysis/index.js` |
| 读这些 | `01-requirements.md` FR-M4-01 |
| 产出 | `runBuffer`：Turf 生成缓冲、可选 dissolve、覆盖统计 |
| DoD | 1) `CHK-TEST-M4-01` 通过；2) `dissolve=true` 输出 1 个 MultiPolygon；3) 缓冲面置于点层下方 |
| 工时 | 6h |
| 提交 | `feat(FR-M4-01): 实现缓冲区分析` |

### T-050 M4 服务区、覆盖率、结果管理

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-028, T-040 |
| 允许修改 | `project/frontend/src/modules/analysis/serviceArea.js`, `.../coverage.js`, `.../resultManage.js`, `project/frontend/src/api/analysis.js` |
| 读这些 | `01-requirements.md` FR-M4-02, FR-M4-05, FR-M4-06；`03-api-contract.md` §7 |
| 产出 | 服务区分层渲染、覆盖率表格、结果图层管理 |
| DoD | 1) `CHK-TEST-M4-02`、`CHK-TEST-M4-05`、`CHK-TEST-M4-06` 通过；2) 服务区非圆形（圆度 < 0.95 校验）；3) 一键清除后图层与面板归零 |
| 工时 | 8h |
| 提交 | `feat(FR-M4-02): 实现服务区与覆盖率统计` |

### T-051 M4 可达性可视化

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-029, T-045 |
| 允许修改 | `project/frontend/src/modules/analysis/accessibility.js`, `project/frontend/src/api/analysis.js` |
| 读这些 | `01-requirements.md` FR-M4-04；`03-api-contract.md` §8 |
| 产出 | 5 级点图层 + 参数/统计面板 |
| DoD | 1) `CHK-TEST-M4-04` 的 4 个断言通过；2) 分级数 = `breaks.length - 1`；3) 阈值下拉仅 5/10/15 三项 |
| 工时 | 6h |
| 提交 | `feat(FR-M4-04): 实现可达性结果可视化` |

### T-052 M5 统计报表与导出

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-027, T-030 |
| 允许修改 | `project/frontend/src/modules/report/`, `project/frontend/src/api/exportApi.js` |
| 读这些 | `01-requirements.md` FR-M5-01..04 |
| 产出 | 分区统计表、构成分析、达标率矩阵、导出 |
| DoD | 1) `CHK-TEST-M5-01..04` 全 PASS；2) 无 `Infinity`/`NaN`（DOM 扫描）；3) 导出文件名与 BOM 符合 `03` §9 |
| 工时 | 8h |
| 提交 | `feat(FR-M5-01): 实现统计报表与导出` |

---

## 8. 阶段 4：收尾

### T-060 全链路联调 `[联调]`

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-041, T-043, T-045, T-050, T-051, T-052 |
| 允许修改 | `project/frontend/src/`, `project/backend/src/`（仅修复联调缺陷，MUST 逐条登记 BUG） |
| 读这些 | `06-testing.md` §5 |
| 产出 | 8 个接口与全部 P0 功能端到端可用 |
| DoD | 1) `CHK-AC` 全部 PASS；2) `CHK-API` 8/8 通过；3) `MA-01` 稳定性通过 |
| 工时 | 8h |
| 提交 | `fix(T-060): 修复全链路联调缺陷` |

### T-061 性能优化

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-060 |
| 允许修改 | `project/docs/性能报告.md`, `project/frontend/src/core/`, `project/frontend/src/modules/theme-viz/` |
| 读这些 | `01-requirements.md` 非功能性能项 |
| 产出 | 首屏 ≤ 5s、图层切换 ≤ 2s、查询 ≤ 3s |
| DoD | 1) 性能报告含 3 项指标的实测值（Chrome Performance 面板截图存 `docs/screenshots/`）；2) 5000 点渲染不掉帧（≥ 30fps） |
| 工时 | 6h |
| 提交 | `perf(T-061): 优化首屏与渲染性能` |

### T-062 演示脚本与彩排 `[人工]`

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-060 |
| 允许修改 | `project/docs/演示脚本.md` |
| 读这些 | 需求文档 §12.4 |
| 产出 | 3 分钟 11 步演示脚本 + 1 次完整彩排记录 |
| DoD | 1) `MA-06` 通过（11 步全成功，无卡顿 > 3s）；2) 脚本含每步的预期画面描述 |
| 工时 | 4h |
| 提交 | `docs(T-062): 编写演示脚本并完成彩排` |

### T-063 文档补齐

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-060 |
| 允许修改 | `project/README.md`, `project/docs/设计说明.md`, `project/docs/数据说明.md` |
| 读这些 | `00-overview.md` §4（成功标准） |
| 产出 | 三份文档，覆盖 `06` §7 的文档验收项 |
| DoD | 1) README 含启动步骤且命令可直接复制执行；2) 数据说明含来源、处理流程、质量报告引用；3) 设计说明含架构图与依赖规则 |
| 工时 | 6h |
| 提交 | `docs(T-063): 补齐项目文档` |

### T-064 最终验收

| 字段 | 值 |
|---|---|
| 状态 | TODO |
| 依赖 | T-060..T-063 |
| 允许修改 | `project/docs/验收记录.md` |
| 读这些 | `06-testing.md` §7 |
| 产出 | 验收记录，`MA-01..MA-08` 逐条打勾 |
| DoD | 1) `CHK-AC` + `CHK-API` + `CHK-DATA` + `CHK-IGS` 全部 PASS；2) `MA-01..MA-08` 全部通过；3) `SC-01..SC-08` 逐条判定通过 |
| 工时 | 4h |
| 提交 | `docs(T-064): 完成最终验收记录` |

---

## 9. 条件任务

### T-900 修订 SPEC

| 字段 | 值 |
|---|---|
| 状态 | TODO（按需触发） |
| 依赖 | 无 |
| 允许修改 | `project/SPEC/` 下指定文件 |
| 读这些 | `00-overview.md` §10 |
| 产出 | 修订后的 SPEC + 修订记录 + 影响任务清单 |
| DoD | 1) `spec.version` 次版本 +1；2) 修订记录新增一行；3) `00` §11 变更登记表更新；4) 受影响任务的 `读这些` 已同步 |
| 工时 | 按变更范围评估 |
| 提交 | `docs(SPEC-xx): 修订 <文件> 至 vX.Y.Z` |

---

## 10. 依赖关系图（文字版）

```
T-001 ─┬─ T-003 ─┬─ T-006 ───── T-007 ─────────────┐
       │         └─ T-008 ─┐                       │
       ├─ T-004 ───────────┼───────────────┐       │
       └─ T-005             │               │       │
                            │               │       │
T-002 ──────────────────────┴─ T-023 ─┬─ T-024 ─┐   │
                                      ├─ T-025  │   │
                                      └─ T-027 ─┼───┤
T-010 ─ T-011 ─ T-012 ─┬─ T-013        │        │   │
                       └─ T-014 ─┬─ T-015 ─ T-016 ─ T-020 ─ T-021 ─┐
                                 └─ T-017 ─ T-018 ─┐               │
                                                   │               │
T-022 ← T-004, T-020 ──────────────────────────────┼───────────────┤
T-026 ← T-022                                      │               │
T-028 ← T-021, T-022, T-027                        │               │
T-029 ← T-018, T-027                               │               │
T-030 ← T-027                                      │               │
T-031 ← T-023..T-030                               │               │
                                                   │               │
T-040 ← T-007, T-008 ──────────────────────────────┴───────────────┘
T-041 ← T-040
T-042 ← T-040, T-041
T-043 ← T-024, T-025, T-040
T-044 ← T-043
T-045 ← T-042, T-027
T-046 ← T-040
T-047 ← T-040
T-048 ← T-045
T-049 ← T-040
T-050 ← T-028, T-040
T-051 ← T-029, T-045
T-052 ← T-027, T-030
T-060 ← T-041, T-043, T-045, T-050, T-051, T-052
T-061, T-062, T-063 ← T-060
T-064 ← T-060..T-063
```

---

## 11. 并行建议（6 人 / 6 agent 同时开工）

**规则 `TK-09`：同一时刻最多 3 个任务共用同一目录，避免冲突。**

| 轮次 | 可并行任务 | 说明 |
|---|---|---|
| 第 1 轮 | T-001, T-002, T-010 | 骨架/DB/采集无依赖 |
| 第 2 轮 | T-003, T-004, T-005, T-011 | 前端/后端/脚本/清洗 |
| 第 3 轮 | T-006, T-008, T-012, T-014 | 反代/配置/标准化/建库 |
| 第 4 轮 | T-007, T-013, T-015, T-017 | 地图接入/质检/制图/拓扑 |
| 第 5 轮 | T-016, T-018, T-020, T-022 | 瓦片/OD/发布/客户端 |
| 第 6 轮 | T-021, T-023, T-026, T-040 | 功能服务/字典/健康/地图内核 |
| 第 7 轮 | T-024, T-025, T-027, T-041 | 查询/补全/统计/地图操作 |
| 第 8 轮 | T-028, T-029, T-042, T-043 | 服务区/可达性/图层树/查询前端 |
| 第 9 轮 | T-030, T-044, T-045, T-046 | 导出/面板/分级/热力 |
| 第 10 轮 | T-031, T-047, T-049, T-050 | 契约/聚合/缓冲/服务区前端 |
| 第 11 轮 | T-048, T-051, T-052 | 图表/可达性前端/报表 |
| 第 12 轮 | T-060 | 全链路联调（串行） |
| 第 13 轮 | T-061, T-062, T-063 | 性能/彩排/文档 |
| 第 14 轮 | T-064 | 最终验收 |

---

## 12. BLOCKED 登记区

> 按 `05-conventions.md` §9 模板登记。登记后 MUST 更新对应任务状态为 `BLOCKED`。

（暂无）

---

## 13. 禁止事项（K 系列）

| ID | 禁令 | 判定为失败 |
|---|---|---|
| `K-01` | 不得承接依赖未 `DONE` 的任务 | 开工时依赖非 `DONE` |
| `K-02` | 不得跨任务合并提交 | 一个 commit 含两个任务号 |
| `K-03` | 不得跳过单元测试直接标 `DONE` | DoD 中测试项未执行 |
| `K-04` | 不得在联调任务外同时改前后端 | diff 同时含 `frontend/` 与 `backend/` |
| `K-05` | 不得自行新增任务 | 出现本文件未定义的 T-xxx |
| `K-06` | 不得删除或改写他人任务条目 | 非 `T-900` 任务修改了本文件的任务定义 |
| `K-07` | 不得把 `BLOCKED` 直接改为 `DONE` | 状态跳变 |
| `K-08` | 不得让 DoD 变成"手工目测" | DoD 含"效果良好"等表述 |

---

## 14. 修订记录

| 版本 | 日期 | 修订内容 |
|---|---|---|
| 1.0.0 | 2026-10-21 | 初始发布：47 个任务（阶段 0–4）+ 1 个条件任务 + 依赖图 + 14 轮并行建议 |

# 05 · CONVENTIONS

| 字段 | 值 |
|---|---|
| `spec.id` | SPEC-05 |
| `spec.version` | 1.0.0 |
| `spec.status` | FROZEN |
| `spec.owner` | 项目组 |
| `spec.updated` | 2026-10-21 |
| `spec.depends_on` | `00-overview.md`、`02-data-model.md`、`03-api-contract.md` |
| `spec.authority` | 第 6 顺位。**错误码的唯一权威。** 编码风格与禁令的权威。 |

---

## 1. 命令词定义

**规则 `C-01`：本套文档中，以下词汇具有唯一含义。MUST NOT 将其理解为"建议"或"视情况"。**

| 词 | 含义 | 违反后果 |
|---|---|---|
| **MUST** | 必须做。无例外。 | 交付判定 `REJECTED` |
| **MUST NOT** | 禁止做。无例外。 | 交付判定 `REJECTED` |
| **SHOULD** | 应该做。不做需在完成报告中写明理由并获批准。 | 未说明即扣分 |
| **MAY** | 可以做。不做不影响判定。 | — |
| 未使用上述词的陈述 | **描述性，无强制力** | — |

**规则 `C-02`：凡文档中出现"尽量""适当""合理""酌情""建议"等模糊词，MUST 视为 `MUST NOT 执行`（即：没有明确规则时不做）。**

---

## 2. 命名规范

### 2.1 通用

| 对象 | 规则 | 正例 | 反例 |
|---|---|---|---|
| 文件名（JS/Java） | 见 2.2 / 2.3 | — | — |
| 常量 | `UPPER_SNAKE_CASE` | `MAX_ZOOM`, `LAYER_FACILITY` | `maxZoom`, `layerFacility` |
| 布尔变量 | MUST 以 `is`/`has`/`can`/`should` 开头 | `isVisible`, `hasCapacity` | `visible`, `capacityFlag` |
| 函数 | MUST 以动词开头 | `loadDistrictStat`, `applyHeatmap` | `districtStat`, `heatmap` |
| 事件名 | `domain:action` 小写 | `map:ready`, `layer:visibilitychange` | `MapReady`, `onLayerChange` |
| 枚举值（字符串） | 全大写 | `WALK`, `GAUSSIAN`, `SUCCESS` | `walk`, `Gaussian` |

### 2.2 前端

| 对象 | 规则 | 正例 | 反例 |
|---|---|---|---|
| 目录 | `kebab-case` | `theme-viz`, `map-base` | `themeViz`, `ThemeViz` |
| JS 文件 | `kebab-case` 或 `camelCase`（工具类） | `service-area.js`, `mapInstance.js` | `ServiceArea.js` |
| Vue 组件文件 | `PascalCase.vue` | `LayerTree.vue` | `layer-tree.vue` |
| Vue 组件名 | 多单词 `PascalCase` | `LayerTree`, `EmptyState` | `Tree`, `Empty` |
| CSS 类 | `kebab-case`，模块前缀 | `panel-shell`, `layer-tree__item` | `panelShell`, `item` |
| Store | `xxxStore.js` | `mapStore.js` | `store-map.js` |

### 2.3 后端

| 对象 | 规则 | 正例 | 反例 |
|---|---|---|---|
| 包名 | 全小写 | `com.example.gis.service` | `com.example.GIS.Service` |
| 类名 | `PascalCase`，后缀表类型 | `FacilityController`, `AnalysisTaskMapper` | `Facility`, `FacilityCtrl` |
| 方法名 | `camelCase`，动词开头 | `queryByCondition`, `calc2sfca` | `facility()`, `doIt()` |
| 常量 | `UPPER_SNAKE_CASE` | `DEFAULT_PAGE_SIZE` | `defaultPageSize` |
| Entity 字段 | `camelCase`，与列名下划线转驼峰对应 | `facCode` ← `FAC_CODE` | `FAC_CODE` 作为字段名 |

### 2.4 数据与配置

| 对象 | 规则 |
|---|---|
| GDB 图层名 | 全大写英文 | `FACILITY` |
| GDB / MySQL 字段 | 全大写 + 下划线 | `FAC_CODE` |
| JSON 字段 | 小驼峰，按 `02` §6 映射表 | `facCode` |
| 配置键（前端） | 全大写 + 下划线 | `IGS_BASE` |
| 配置键（后端 yml） | 小写点分 | `igs.port` |
| 数据文件名 | `类型_区域_日期` | `facility_wh_20261105.shp` |
| 导出文件名 | `内容_yyyyMMddHHmmss.ext` | `分区统计_20261021103000.xlsx` |

**规则 `C-03`：代码标识符 MUST NOT 使用拼音。** 只能用英文单词或标准术语表内的词。

| 反例 | 正例 |
|---|---|
| `shsheshi` / `gongjiaozhan` | `facility` / `busStop` |
| `quyu` | `district` |

---

## 3. 编码规范

### 3.1 前端（JavaScript）

| ID | 规则 |
|---|---|
| `C-04` | MUST 使用 ES Module（`import`/`export`），MUST NOT 使用 `require`。 |
| `C-05` | MUST 使用 `const`；需重新赋值才用 `let`；MUST NOT 使用 `var`。 |
| `C-06` | MUST 用严格相等 `===` / `!==`。 |
| `C-07` | 异步 MUST 用 `async/await`；MUST NOT 混用 `.then` 链与 `await`。 |
| `C-08` | 每个 `catch` MUST 至少做一件事：记录日志、转成用户提示、或重新抛出。MUST NOT 空捕获。 |
| `C-09` | 地图/图层实例 MUST 用 `markRaw()` 或存于模块级变量。MUST NOT 放入 `ref`/`reactive`。 |
| `C-10` | MUST NOT 使用 `innerHTML` 拼接用户数据（XSS）。 |
| `C-11` | 用户可见文案 MUST 为中文，MUST NOT 出现英文技术术语。 |
| `C-12` | MUST NOT 使用 `alert`/`confirm`/`prompt`，统一用 Element Plus 的 `ElMessage`/`ElMessageBox`。 |
| `C-13` | 生产代码 MUST NOT 含 `console.log`；允许 `console.warn`/`console.error` 用于异常路径。 |
| `C-14` | 单个函数 MUST ≤ 50 行；超出 MUST 拆分。 |

### 3.2 后端（Java）

| ID | 规则 |
|---|---|
| `C-15` | MUST 使用 `@RestController` + `@RequestMapping("/api/v1/...")`，路径 MUST 与 `03` 一致。 |
| `C-16` | Controller MUST 只做：参数校验 → 调 Service → 包装 `R` 返回。MUST NOT 含 `if` 之外的业务分支。 |
| `C-17` | 所有对外方法 MUST 显式声明返回类型，MUST NOT 用 `var` 作为返回值声明。 |
| `C-18` | MUST NOT 使用 `System.out.println`；统一用 SLF4J `log.info/warn/error`。 |
| `C-19` | 捕获异常 MUST 转成 `BizException` + `ErrorCode`，由 `GlobalExceptionHandler` 统一处理。 |
| `C-20` | DTO MUST 用 Lombok `@Data`；MUST NOT 手写 getter/setter。 |
| `C-21` | 空集合 MUST 返回 `Collections.emptyList()` 或 `List.of()`，MUST NOT 返回 `null`。 |
| `C-22` | 除法 MUST 显式判分母为 0。MUST NOT 依赖 `ArithmeticException`。 |
| `C-23` | 所有 `@Transactional` 方法 MUST 明确 `rollbackFor = Exception.class`。 |
| `C-24` | MUST NOT 在循环内调用数据库或 HTTP。 |

### 3.3 注释

| ID | 规则 |
|---|---|
| `C-25` | 每个导出函数/公开方法 MUST 有注释，说明：作用、参数、返回值、副作用。 |
| `C-26` | 注释 MUST 为中文。MUST NOT 写"// TODO""// 临时""// 先这样"。 |
| `C-27` | 注释 MUST 描述"为什么"，MUST NOT 复述"做了什么"（代码已表达）。 |
| `C-28` | 涉及业务规则的代码 MUST 在注释中引用 FR 编号，如 `// FR-M3-03: 热力层数量恒为 1`。 |
| `C-29` | MUST NOT 保留被注释掉的代码块。删除或提交，二选一。 |

---

## 4. 错误码主表（唯一权威）

**规则 `C-30`：错误码 MUST 只能取以下值。新增 MUST 走 SPEC 修订（`T-900`）。MUST NOT 在实现中自定义错误码。**

| code | HTTP | msg（MUST 逐字使用） | 语义 | 前端处理 |
|---|---|---|---|---|
| `0` | 200 | `success` | 成功 | — |
| `1001` | 400 | `参数校验失败` | 必填缺失、类型错误、格式错误 | 高亮出错字段 |
| `1002` | 400 | `参数超出允许范围` | 数值越界、枚举非法、长度超限 | 提示合法范围 |
| `2001` | 404 | `数据不存在` | 按 ID 查询无记录 | 显示空状态 |
| `2002` | 422 | `数据未就绪` | OD 矩阵缺失、服务未发布 | 提示"请先完成前置准备" |
| `3001` | 503 | `地图服务连接失败，请检查 IGServer 是否启动` | IGServer 不可达 | 显示重试按钮 |
| `3002` | 502 | `地图服务返回错误` | IGServer 返回非 0 | 显示 `msg` + 重试 |
| `4001` | 504 | `计算超时，建议缩小范围` | 分析超时 | 提示缩小范围 |
| `5000` | 500 | `系统异常` | 未捕获异常 | 显示 `traceId` |
| `5001` | 429 | `今日查询额度已用尽` | 第三方配额超限 | 提示改用地图点选 |

**强制约束**

| ID | 规则 |
|---|---|
| `C-31` | `msg` MUST 与上表逐字一致（含标点）。MUST NOT 改写、加前缀、拼接变量。 |
| `C-32` | `msg` MUST NOT 包含 `Exception`、`Error`、`SQL`、`null`、堆栈、英文技术名词。 |
| `C-33` | 后端 MUST 用 `ErrorCode` 枚举，MUST NOT 在代码里写数字字面量。 |
| `C-34` | 前端 MUST 用 `code` 分支处理，MUST NOT 用 `msg` 文本匹配。 |

---

## 5. 日志规范

| ID | 规则 |
|---|---|
| `C-35` | 级别语义：`ERROR` 需人工介入；`WARN` 可自愈但需关注；`INFO` 关键流程节点；`DEBUG` 仅开发期。 |
| `C-36` | 每条日志 MUST 含 `traceId`。 |
| `C-37` | 日志 MUST 结构化，格式固定：`[traceId] [level] [className#method] msg key=value`。 |
| `C-38` | 异常日志 MUST 打印完整堆栈（`log.error("...", e)`），MUST NOT 只打 `e.getMessage()`。 |
| `C-39` | MUST NOT 在日志中打印：完整 Key、密码、连接串、用户坐标精确值。 |
| `C-40` | 接口入口 MUST 打 `INFO` 日志（方法 + 关键参数摘要）。接口出口 MUST 打 `INFO` 日志（耗时 + code）。 |

**样例**

```
[7f3a9c21b4d0] [INFO ] [FacilityController#query] start categoryL1=MED page=1
[7f3a9c21b4d0] [INFO ] [FacilityController#query] end elapsedMs=42 code=0
[7f3a9c21b4d0] [ERROR] [AccessibilityService#calc] od matrix missing taskId=AC-20261021-0001
```

---

## 6. Git 规范

### 6.1 分支

| 分支 | 用途 |
|---|---|
| `main` | 可运行版本。MUST 保护，MUST NOT 直接 push。 |
| `feat/<task-id>` | 单个任务开发，如 `feat/T-046` |
| `fix/<task-id>` | 缺陷修复 |

### 6.2 提交信息（强制格式）

```
<type>(<scope>): <subject>

<body>
```

| 字段 | 规则 |
|---|---|
| `type` | 仅 `feat` / `fix` / `docs` / `refactor` / `test` / `chore` |
| `scope` | FR 编号或任务号，如 `FR-M3-03` / `T-046` |
| `subject` | 中文，≤ 30 字，动词开头，不加句号 |
| `body` | 可选。写明：变更点、验证方式、影响范围 |

**正例**

```
feat(FR-M3-03): 实现热力图渲染与清除

- 新增 modules/theme-viz/heatmap.js
- 热力层数量恒为 1，切换时先移除旧的
- 验证：scripts/check.sh CHK-TEST-M3-03 退出 0
```

**反例（MUST NOT）**

```
update          ← 无 type/scope，subject 无信息量
修复了一些问题      ← 未说明修了什么
```

### 6.3 提交前自检（强制）

**规则 `C-41`：每次提交前 MUST 执行以下命令且全部退出 0，MUST 把输出粘贴进完成报告。**

```bash
scripts/check.sh CHK-LINT
scripts/check.sh CHK-BUILD
scripts/check.sh CHK-DEP
```

---

## 7. 完成报告模板（强制格式）

**规则 `C-42`：每个任务完成 MUST 按此模板输出，MUST NOT 省略任何小节。字段值为空时 MUST 写 `无`，MUST NOT 留空。**

```markdown
## 完成报告 · <任务号> <任务名>

### 1. 变更文件
| 文件 | 变更类型 | 说明 |
|---|---|---|
| path/to/file.js | 新增 / 修改 / 删除 | 一句话 |

### 2. 对照需求
- 实现的需求：FR-xxx
- 覆盖的验收标准：AC-xxx-1, AC-xxx-2
- 未覆盖：无 / <AC 编号 + 原因>

### 3. 自检输出（原始 stdout，MUST NOT 摘要）
```
$ scripts/check.sh CHK-LINT
CHECK CHK-LINT PASS 0 errors

$ scripts/check.sh CHK-TEST-M3-03
CHECK CHK-TEST-M3-03 PASS 4/4
```

### 4. 手工验证
| AC | 操作步骤 | 实际结果 |
|---|---|---|

### 5. 偏离与冲突
- 与规范的偏离：无 / <描述 + 依据>
- 发现的文档冲突：无 / <冲突点 + 按 O-06 的裁决结果>

### 6. 遗留问题
- 无 / <问题 + 已登记到何处>

### 7. 新增依赖
- 无 / <依赖名 + 版本 + 用途 + 批准人>
```

---

## 8. 缺陷报告模板

```markdown
## 缺陷报告 · BUG-<三位序号>

| 字段 | 值 |
|---|---|
| 发现时间 | yyyy-MM-dd HH:mm |
| 关联任务 | T-xxx |
| 关联需求 | FR-xxx |
| 严重级别 | BLOCKER / MAJOR / MINOR |
| 状态 | OPEN / FIXING / FIXED / VERIFIED |

### 复现步骤
1.
2.

### 期望行为
<引用具体 AC 编号>

### 实际行为
<客观描述，附 traceId 或截图路径>

### 影响范围
<哪些功能不可用>
```

**规则 `C-43`：`BLOCKER` MUST 在 4 小时内响应；`MAJOR` MUST 当天响应。**

---

## 9. 阻塞登记模板（写入 `07-tasks.md` 的 BLOCKED 区）

**规则 `C-44`：遇到 `G-02`（需推断）或依赖缺失时，MUST 停止并登记。MUST NOT 自行决定后继续。**

```markdown
### BLOCKED · <任务号>

| 字段 | 值 |
|---|---|
| 阻塞时间 | yyyy-MM-dd HH:mm |
| 阻塞类型 | 规范缺失 / 依赖未完成 / 环境不可用 / 需求冲突 |
| 缺失的信息 | <具体到"哪份文档的哪一节没说清"> |
| 已尝试的方案 | <做了什么，为什么不行> |
| 需要的决策 | <一句话，可被直接回答> |
| 决策人 | 项目经理 |
```

---

## 10. 禁令清单（P 系列）

**这 30 条是 AI agent 最容易犯的错误。每条都给出"判定为失败的行为"。**

### 10.1 关于"发明"（虚构）

| ID | 禁令 | 判定为失败的行为 |
|---|---|---|
| `P-01` | 不得发明接口 | 调用 `/api/v1/` 下 8 个之外的路径 |
| `P-02` | 不得发明字段 | 响应或请求中出现 `02` §6 映射表之外的字段名 |
| `P-03` | 不得发明错误码 | 出现 `05` §4 之外的 `code` 值 |
| `P-04` | 不得发明事件名 | 使用 `04` §2.3 白名单之外的事件名 |
| `P-05` | 不得发明依赖 | `package.json`/`pom.xml` 出现未登记项 |
| `P-06` | 不得发明配置键 | 使用 `04` §5 之外的配置键 |

### 10.2 关于"越界"（超范围）

| ID | 禁令 | 判定为失败的行为 |
|---|---|---|
| `P-07` | 不得改任务白名单外的文件 | `git diff --name-only` 含白名单外文件 |
| `P-08` | 不得顺手修相邻问题 | 完成报告中出现"顺便优化了…"且未登记缺陷 |
| `P-09` | 不得改 SPEC 文件 | `SPEC/` 下文件被修改（除 `T-900` 任务） |
| `P-10` | 不得改他人模块 | `modules/A` 的文件出现在 `T-046`（M3 任务）的 diff 中 |
| `P-11` | 不得删除他人代码以"简化" | diff 中出现与本任务无关的删除行 |
| `P-12` | 不得扩大接口能力 | 给接口加了未在 `03` 定义的参数或返回字段 |

### 10.3 关于"谎报"（虚假完成）

| ID | 禁令 | 判定为失败的行为 |
|---|---|---|
| `P-13` | 不得无输出声称完成 | 完成报告第 3 节为空或写"已验证" |
| `P-14` | 不得摘要自检输出 | 把多行 `check.sh` 输出压成一句"全部通过" |
| `P-15` | 不得用截图/描述代替命令 | 第 3 节只有图片或自然语言 |
| `P-16` | 不得不跑自检就提交 | 提交前无 `CHK-LINT`/`CHK-BUILD` 记录 |
| `P-17` | 不得把失败包装成"部分完成" | DoD 未全通过却标 `DONE` |

### 10.4 关于"作弊"（测试造假）

| ID | 禁令 | 判定为失败的行为 |
|---|---|---|
| `P-18` | 不得写空断言 | `expect(true).toBe(true)`、`assertTrue(true)` |
| `P-19` | 不得跳过测试 | `.skip`、`.only`、`xit`、`@Ignore`、`@Disabled` |
| `P-20` | 不得注释掉失败断言 | diff 中出现断言被注释 |
| `P-21` | 不得改测试迁就实现 | 为实现通过的改动出现在 `__tests__/` 而非源码 |
| `P-22` | 不得用 mock 冒充真实数据交付 | 生产代码路径含硬编码假数据 |

### 10.5 关于"静默失败"

| ID | 禁令 | 判定为失败的行为 |
|---|---|---|
| `P-23` | 不得空捕获异常 | `catch {}` / `catch (e) {}` |
| `P-24` | 不得忽略返回值 | 调用 `api.getXxx()` 不接返回值也不 `await` |
| `P-25` | 不得用 `console.log` 处理错误 | 错误路径只有打印，无用户提示或错误码 |
| `P-26` | 不得让异常冒泡到默认页 | 未走 `GlobalExceptionHandler` |

### 10.6 关于"技术底线"

| ID | 禁令 | 判定为失败的行为 |
|---|---|---|
| `P-27` | 不得把地图实例放进 Vue 响应式 | `ref(map)` / `reactive(layer)` |
| `P-28` | 不得混用新旧客户端库 | 同时引入 `zondyclient` 与 `zondyclientOld` |
| `P-29` | 不得用不合规底图 | 引入 Google/Apple/Bing/OSM 直连/Mapbox 底图 |
| `P-30` | 不得在前端出现 Key/端口/IP | `grep -rnE "tk=|127\.0\.0\.1|localhost:[0-9]+" frontend/src` 有命中 |

---

## 11. 反作弊专项条款

**针对 AI agent 的典型失效模式，以下行为单独列出，一律判定失败。**

| ID | 行为 | 为什么禁止 | 替代做法 |
|---|---|---|---|
| `X-01` | 声称"已验证"但未贴命令输出 | 无法区分"真跑过"与"以为跑过" | 原样粘贴 stdout |
| `X-02` | 只改测试数据让断言通过 | 掩盖真实缺陷 | 改实现，或登记缺陷 |
| `X-03` | 遇到报错时降低检查标准 | 把问题推给下游 | 登记 `BLOCKED`，找人决策 |
| `X-04` | 用 try-catch 包住整段逻辑吞掉错误 | 表面通过 | 精确定位并转 `ErrorCode` |
| `X-05` | 把 `TODO` 留在交付代码里 | 半成品当成品 | 实现或登记缺陷 |
| `X-06` | 在完成报告中写"基本完成""大部分可用" | 无法判定 | 按 AC 逐条给 `PASS`/`FAIL` |
| `X-07` | 复制示例代码后改个名字就算实现 | 未针对本需求 | 必须能通过本 FR 的 AC |
| `X-08` | 用 `as any` / 忽略类型错误绕过检查 | 掩盖不匹配 | 修正类型或映射 |
| `X-09` | 同一功能在两处各写一份 | 违反单一事实源 | 抽到 `core` 或 `api` |
| `X-10` | 把配置写死在业务代码里 | 无法换环境 | 走 `config/index.js` 或 `application.yml` |

---

## 12. 提交前自检清单（人工/AI 通用）

**规则 `C-45`：勾选全部为"是"才可提交。**

| # | 检查项 | 判定方法 |
|---|---|---|
| 1 | 只改了白名单内的文件 | `git diff --name-only` 对照任务白名单 |
| 2 | 无新增依赖（或已登记） | `git diff package.json pom.xml` |
| 3 | `CHK-LINT` 通过 | 命令退出码 0 |
| 4 | `CHK-BUILD` 通过 | 命令退出码 0 |
| 5 | `CHK-DEP` 通过 | 命令退出码 0 |
| 6 | 任务 DoD 的测试全部通过 | 对应 `CHK-TEST-*` 退出 0 |
| 7 | 无 `TODO`/`FIXME`/`console.log` | `grep -rn` 无命中 |
| 8 | 完成报告 7 个小节齐全 | 逐节核对 |
| 9 | 提交信息符合格式 | 正则 `^(feat\|fix\|docs\|refactor\|test\|chore)\([A-Z0-9-]+\): .{1,30}$` |
| 10 | 新术语已登记 | 对照 `00` §5 术语表 |

---

## 13. 修订记录

| 版本 | 日期 | 修订内容 |
|---|---|---|
| 1.0.0 | 2026-10-21 | 初始发布：命令词、命名、编码、错误码主表、日志、Git、3 个模板、30 条禁令、10 条反作弊条款 |

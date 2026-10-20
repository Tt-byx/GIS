# 03 · API CONTRACT

| 字段 | 值 |
|---|---|
| `spec.id` | SPEC-03 |
| `spec.version` | 1.0.0 |
| `spec.status` | FROZEN |
| `spec.owner` | 项目组 |
| `spec.updated` | 2026-10-21 |
| `spec.depends_on` | `00-overview.md`、`02-data-model.md` |
| `spec.authority` | **第 3 顺位。接口路径、参数、响应结构的唯一权威。** |

---

## 1. 接口范围声明

**本系统业务 API 共 8 个，全部列于本节。MUST NOT 新增、MUST NOT 省略、MUST NOT 改路径。**

| # | 方法 | 路径 | 用途 | 对应 FR | 优先级 |
|---|---|---|---|---|---|
| `API-01` | GET | `/api/v1/meta/dict` | 字典与地图令牌 | FR-M1-06, FR-M2-01 | P0 |
| `API-02` | GET | `/api/v1/facilities` | 设施查询（分页） | FR-M2-01 | P0 |
| `API-03` | GET | `/api/v1/facilities/suggest` | 名称补全（代理） | FR-M2-05 | P0 |
| `API-04` | GET | `/api/v1/statistics/district` | 分区统计 | FR-M3-02, FR-M5-01, FR-M5-02 | P1 |
| `API-05` | POST | `/api/v1/analysis/service-area` | 网络服务区 | FR-M4-02 | P1 |
| `API-06` | POST | `/api/v1/analysis/accessibility` | 2SFCA 可达性 | FR-M4-04 | P1 |
| `API-07` | POST | `/api/v1/export/excel` | 导出 | FR-M5-04 | P1 |
| `API-08` | GET | `/api/v1/health` | 健康检查 | FR-M1-01 | P0 |

**不在本清单内的接口，MUST 视为不存在。Agent 调用或实现它们，判定为 `G-01` 违反。**

---

## 2. 通用规范

### 2.1 基础约定

| 项 | 规定 |
|---|---|
| 协议 | HTTP/1.1（本地部署，不启用 HTTPS） |
| 基址 | `http://localhost`（经 Nginx 反代），**前端 MUST NOT 直连 8080** |
| 前缀 | `/api/v1` |
| 编码 | `UTF-8` |
| 请求头 | `Content-Type: application/json; charset=utf-8`（POST）；`Accept: application/json` |
| 超时 | 前端默认 30s；`API-05` 60s；`API-06` 30s；`API-07` 60s |
| 幂等 | `GET` 天然幂等；`POST` 的 `API-05/06` MUST 幂等（相同 `params` 返回相同 `taskId` 缓存结果） |

### 2.2 统一响应包装

**除 `API-07`（文件流）外，全部响应 MUST 为以下结构。**

```json
{
  "code": 0,
  "msg": "success",
  "data": {},
  "traceId": "a1b2c3d4e5f6"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | int | 是 | `0` 成功；非 0 见 §2.3 |
| `msg` | string | 是 | 中文提示，MUST 可直接展示给用户 |
| `data` | object \| array \| null | 是 | 成功时为业务数据；失败时 MUST 为 `null` |
| `traceId` | string | 是 | 12 位十六进制；失败时 MUST 在界面显示 |

**强制约束**

| ID | 规则 |
|---|---|
| `A-01` | `code != 0` 时 `data` MUST 为 `null`。MUST NOT 返回部分数据。 |
| `A-02` | `msg` MUST NOT 包含英文技术术语、堆栈、SQL。 |
| `A-03` | 成功响应 MUST 带 `traceId`（即便成功，也用于排障）。 |

### 2.3 错误码

> **唯一权威在 `05-conventions.md` §4。本节仅列出本 API 可能返回的码。MUST NOT 使用本节之外的码。**

| code | HTTP | msg（MUST 逐字使用） | 触发场景 |
|---|---|---|---|
| `0` | 200 | `success` | 成功 |
| `1001` | 400 | `参数校验失败` | 必填缺失、格式错误 |
| `1002` | 400 | `参数超出允许范围` | 数值越界、枚举非法 |
| `2001` | 404 | `数据不存在` | 按 ID 查询无记录 |
| `2002` | 422 | `数据未就绪` | OD 矩阵缺失 |
| `3001` | 503 | `地图服务连接失败，请检查 IGServer 是否启动` | IGServer 不可达 |
| `3002` | 502 | `地图服务返回错误` | IGServer 返回非 0 |
| `4001` | 504 | `计算超时，建议缩小范围` | 分析超时 |
| `5000` | 500 | `系统异常` | 未捕获异常 |
| `5001` | 429 | `今日查询额度已用尽` | 第三方配额超限 |

### 2.4 字段命名

| 规则 ID | 规定 |
|---|---|
| `A-04` | JSON 字段名 MUST 与 `02-data-model.md` §6 映射表完全一致。MUST NOT 发明字段。 |
| `A-05` | 响应中 MUST NOT 出现 `FID`、`OBJECTID` 等内部字段。 |
| `A-06` | `null` 与"字段缺失"语义不同：字段有值域但当前无值 MUST 返回 `null` 并保留键；字段不适用的 MUST 省略键。 |

### 2.5 分页

请求参数：`page`（从 1 开始）、`size`（1–200，默认 20）。

响应 `data` 结构固定：

```json
{ "total": 0, "page": 1, "size": 20, "list": [] }
```

**规则 `A-07`：`total` MUST 为满足条件的总数（非当前页数）。`list` 为空时 MUST 返回 `[]`，MUST NOT 返回 `null`。**

### 2.6 坐标与时间

| 规则 ID | 规定 |
|---|---|
| `A-08` | 所有经纬度 MUST 为 CGCS2000（EPSG:4490），字段 `lon`/`lat`，6 位小数。 |
| `A-09` | `DATE` 序列化为 `yyyy-MM-dd`；`DATETIME` 序列化为 ISO 8601 带时区。 |
| `A-10` | MUST NOT 返回 Unix 时间戳。 |

---

## 3. API-01 字典与地图令牌

| 项 | 值 |
|---|---|
| 方法 / 路径 | `GET /api/v1/meta/dict` |
| 鉴权 | 无 |
| 超时 | 5s |
| 缓存 | 前端启动时请求一次，缓存于 `Pinia`，会话内不重复请求 |

**请求参数**

无。

**响应 `data` 字段**

| 字段 | 类型 | 说明 |
|---|---|---|
| `categories` | array | 设施类别，按 `SORT_NO` 升序 |
| `categories[].l1` | string | 大类编码 |
| `categories[].l1Name` | string | 大类名称 |
| `categories[].color` | string | 颜色 `#RRGGBB` |
| `categories[].children` | array | 中类列表 |
| `categories[].children[].l2` | string | 中类编码 |
| `categories[].children[].l2Name` | string | 中类名称 |
| `categories[].children[].lifeCircle` | int \| null | 生活圈分钟数 |
| `districts` | array | 行政区 `{code, name}` |
| `streets` | array | 街道 `{code, name, districtCode}` |
| `tiandituToken` | string | 天地图令牌（由后端配置注入） |
| `dataDate` | string | 数据版本日期 `yyyy-MM-dd` |

**响应示例**

```json
{
  "code": 0, "msg": "success",
  "data": {
    "categories": [
      { "l1": "EDU", "l1Name": "教育设施", "color": "#4A90D9",
        "children": [
          { "l2": "KIN", "l2Name": "幼儿园", "lifeCircle": 5 },
          { "l2": "PRI", "l2Name": "小学", "lifeCircle": 10 }
        ] }
    ],
    "districts": [{ "code": "420111", "name": "洪山区" }],
    "streets": [{ "code": "420111001", "name": "关山街道", "districtCode": "420111" }],
    "tiandituToken": "由后端注入",
    "dataDate": "2026-11-05"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**业务规则**
1. `categories` MUST 按 `SORT_NO` 升序，MUST NOT 按字母序。
2. `categories` MUST 恰好 5 个大类，每个大类的中类数 MUST 与 `DICT_CATEGORY` 一致。
3. `tiandituToken` MUST 从 `SYS_CONFIG` 读取；值为 `__FILL_AT_DEPLOY__` 时 MUST 返回空字符串 `""`，MUST NOT 返回占位符原文。
4. `districts` MUST 恰好 3 条。

**错误情形**

| 场景 | code |
|---|---|
| 数据库不可达 | `5000` |

**禁止事项**
- MUST NOT 在此接口返回设施数据。
- MUST NOT 返回数据库原始列名（如 `CAT_L1`），MUST 用映射后的 `l1`/`l2`。

---

## 4. API-02 设施查询

| 项 | 值 |
|---|---|
| 方法 / 路径 | `GET /api/v1/facilities` |
| 鉴权 | 无 |
| 超时 | 10s |

**请求参数**

| 参数 | 类型 | 必填 | 取值 | 默认 | 说明 |
|---|---|---|---|---|---|
| `categoryL1` | string | 否 | `EDU`/`MED`/`CUL`/`WEL`/`COM` | 空 | 大类筛选 |
| `categoryL2` | string | 否 | 见字典 | 空 | 中类筛选 |
| `districtCode` | string | 否 | `420111`/`420106`/`420105` | 空 | 行政区筛选 |
| `streetCode` | string | 否 | 见字典 | 空 | 街道筛选 |
| `keyword` | string | 否 | 长度 0–50 | 空 | 名称包含匹配 |
| `status` | string | 否 | `正常`/`停办`/`在建`/`未知`/`ALL` | `正常` | 状态筛选 |
| `page` | int | 否 | ≥ 1 | `1` | 页码 |
| `size` | int | 否 | 1–200 | `20` | 每页条数 |

**响应 `data`**

`{ total, page, size, list: [Facility] }`，`Facility` 字段见 `02` §6.2（不含 `fid`）。

**响应示例**

```json
{
  "code": 0, "msg": "success",
  "data": {
    "total": 42, "page": 1, "size": 20,
    "list": [{
      "facCode": "420111-MED-CHS-0007",
      "name": "关山街社区卫生服务中心",
      "categoryL1": "MED", "categoryL2": "CHS",
      "address": "武汉市洪山区关山大道 100 号",
      "districtCode": "420111", "districtName": "洪山区",
      "streetCode": "420111001", "streetName": "关山街道",
      "communityName": "关山社区",
      "lon": 114.398765, "lat": 30.512345,
      "capacity": 120, "capacityUnit": "床位", "area": 15000,
      "level": "一级", "status": "正常",
      "srcType": "政府名录", "srcDetail": "武汉市小学一览表 2026",
      "srcDate": "2026-11-05", "confidence": "高", "remark": null
    }]
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**业务规则**
1. 参数以 AND 组合；空值参数 MUST 被忽略，MUST NOT 拼成 `AND x = ''`。
2. `keyword` MUST 为 `LIKE '%kw%'`；`%` 与 `_` MUST 转义。
3. 排序 MUST 为 `facCode ASC`（稳定分页）。
4. `status=ALL` 时 MUST 不加状态条件。
5. 该接口 MUST 由 `app` 转发到 IGServer 要素服务，并在转发层完成字段名映射。

**错误情形**

| 场景 | code |
|---|---|
| `size > 200` | `1002` |
| `categoryL1` 非枚举值 | `1002` |
| IGServer 不可达 | `3001` |

**禁止事项**
- MUST NOT 在前端做二次过滤。
- MUST NOT 返回 `fid`。
- MUST NOT 无 `size` 上限地返回全部记录。

---

## 5. API-03 名称补全（代理）

| 项 | 值 |
|---|---|
| 方法 / 路径 | `GET /api/v1/facilities/suggest` |
| 鉴权 | 无（Key 在后端） |
| 超时 | 8s |
| 缓存 | Caffeine，key=`kw|city`，TTL 10 分钟 |

**请求参数**

| 参数 | 类型 | 必填 | 取值 | 默认 | 说明 |
|---|---|---|---|---|---|
| `kw` | string | 是 | 长度 2–30 | — | 关键字 |
| `city` | string | 否 | 默认 `武汉` | `武汉` | 城市限定 |
| `limit` | int | 否 | 1–20 | `10` | 返回条数 |

**响应 `data`**

| 字段 | 类型 | 说明 |
|---|---|---|
| `list[].name` | string | 名称 |
| `list[].district` | string | 所在区 |
| `list[].lon` | number | 经度 |
| `list[].lat` | number | 纬度 |

**响应示例**

```json
{ "code": 0, "msg": "success",
  "data": { "list": [
    { "name": "关山街社区卫生服务中心", "district": "洪山区", "lon": 114.398, "lat": 30.512 }
  ] },
  "traceId": "a1b2c3d4e5f6" }
```

**业务规则**
1. `kw` 长度 < 2 → `1001`。
2. 后端 MUST 从 `application.yml` 读取高德 Key，MUST NOT 从请求参数接收。
3. 后端 MUST 只保留 `name`/`district`/`lon`/`lat` 四个字段，MUST NOT 整包透传第三方响应。
4. 第三方返回空 → `data.list = []`，`code = 0`（空结果不是错误）。
5. 第三方配额超限（HTTP 429 或业务码表示超限）→ `5001`。

**错误情形**

| 场景 | code |
|---|---|
| `kw` 过短 | `1001` |
| 第三方超时 | `3001`（视为上游不可用） |
| 配额超限 | `5001` |

**禁止事项**
- MUST NOT 把高德 Key 写入响应、日志、前端代码。
- MUST NOT 缓存超过 10 分钟。

---

## 6. API-04 分区统计

| 项 | 值 |
|---|---|
| 方法 / 路径 | `GET /api/v1/statistics/district` |
| 鉴权 | 无 |
| 超时 | 10s |
| 数据源 | MySQL `STAT_DISTRICT`（预计算，MUST NOT 实时算） |

**请求参数**

| 参数 | 类型 | 必填 | 取值 | 默认 | 说明 |
|---|---|---|---|---|---|
| `level` | string | 是 | `district`/`street` | — | 统计层级 |
| `categoryL1` | string | 否 | 大类编码 或 `ALL` | `ALL` | 设施大类 |
| `metric` | string | 否 | `count`/`density`/`perCapita` | `count` | 指标 |
| `districtCode` | string | 否 | 三区之一 | 空 | 仅在 `level=street` 时生效 |

**响应 `data`**

| 字段 | 类型 | 说明 |
|---|---|---|
| `level` | string | 回显请求层级 |
| `metric` | string | 回显请求指标 |
| `unit` | string | 单位：`个`/`个/km²`/`个/万人` |
| `dataDate` | string | 数据版本 |
| `list[].unitCode` | string | 单元代码 |
| `list[].unitName` | string | 单元名称 |
| `list[].value` | number \| null | 指标值；分母为 0 时 `null` |
| `list[].popTotal` | int \| null | 常住人口 |
| `list[].facCount` | int | 设施数量 |

**响应示例**

```json
{ "code": 0, "msg": "success",
  "data": {
    "level": "street", "metric": "perCapita", "unit": "个/万人",
    "dataDate": "2026-11-05",
    "list": [
      { "unitCode": "420111001", "unitName": "关山街道", "value": 2.31, "popTotal": 186000, "facCount": 43 }
    ]
  },
  "traceId": "a1b2c3d4e5f6" }
```

**业务规则**
1. `unit` MUST 按 `metric` 严格映射：`count`→`个`，`density`→`个/km²`，`perCapita`→`个/万人`。
2. `value` 为 `NULL` 时 MUST 返回 `null`，MUST NOT 返回 `0`。
3. 查询 MUST 取 `MAX(DATA_DATE)` 版本。
4. `list` MUST 按 `unitCode` 升序。

**错误情形**

| 场景 | code |
|---|---|
| `level` 非枚举 | `1002` |
| 该版本无数据 | `2001` |

**禁止事项**
- MUST NOT 在接口内做聚合计算（数据必须来自 `STAT_DISTRICT`）。
- MUST NOT 返回 `0` 代替 `null`。

---

## 7. API-05 网络服务区分析

| 项 | 值 |
|---|---|
| 方法 / 路径 | `POST /api/v1/analysis/service-area` |
| 鉴权 | 无 |
| 超时 | 60s |
| 副作用 | 写 `ANALYSIS_TASK`、`ANALYSIS_RESULT` |

**请求体**

| 字段 | 类型 | 必填 | 取值 | 默认 | 说明 |
|---|---|---|---|---|---|
| `categoryL2` | string | 是 | 中类编码 | — | 设施类型 |
| `travelMode` | string | 是 | `WALK`/`DRIVE` | — | 出行方式 |
| `thresholds` | int[] | 是 | 长度 1–3，值 ∈ {5,10,15} | — | 分钟阈值 |
| `districtCode` | string | 否 | 三区之一 | 空 | 限定行政区 |
| `dissolve` | boolean | 否 | — | `true` | 是否融合 |

```json
{ "categoryL2": "CHC", "travelMode": "WALK",
  "thresholds": [5, 10, 15], "districtCode": "420111", "dissolve": true }
```

**响应 `data`**

| 字段 | 类型 | 说明 |
|---|---|---|
| `taskId` | string | 任务号，格式 `SA-yyyyMMdd-四位序号` |
| `elapsedMs` | int | 耗时 |
| `areas` | array | 每个阈值一条 |
| `areas[].threshold` | int | 阈值（分钟） |
| `areas[].geomWkt` | string | 结果几何 WKT（`MULTIPOLYGON` 或 `POLYGON`） |
| `areas[].coveredCommunityCount` | int | 覆盖居住小区数 |
| `summary.totalCommunity` | int | 参与统计的居住小区总数 |
| `summary.uncoveredCommunity` | int | 未覆盖数 |
| `summary.coverageRate` | number | 覆盖率（以最大阈值计），3 位小数 |
| `uncoveredList` | array | 未覆盖小区清单 `{resCode, resName, streetName}` |

**响应示例**

```json
{ "code": 0, "msg": "success",
  "data": {
    "taskId": "SA-20261021-0001", "elapsedMs": 8420,
    "areas": [
      { "threshold": 5,  "geomWkt": "MULTIPOLYGON(((...)))", "coveredCommunityCount": 12 },
      { "threshold": 15, "geomWkt": "MULTIPOLYGON(((...)))", "coveredCommunityCount": 41 }
    ],
    "summary": { "totalCommunity": 56, "uncoveredCommunity": 15, "coverageRate": 0.732 },
    "uncoveredList": [{ "resCode": "R0001", "resName": "某某小区", "streetName": "关山街道" }]
  },
  "traceId": "a1b2c3d4e5f6" }
```

**业务规则**
1. `thresholds` MUST 去重并升序处理；重复值只算一次。
2. `areas` MUST 按 `threshold` 升序返回。
3. `coverageRate` MUST 等于 `1 - uncoveredCommunity / totalCommunity`，保留 3 位小数。
4. 结果几何 MUST 为沿路网生成，判定标准：圆度 = `面积 / (周长²/4π)` < 0.95。
5. 相同 `params` 24 小时内 MUST 命中缓存，返回相同 `taskId`，`elapsedMs` 为 0。
6. 任务 MUST 先写 `ANALYSIS_TASK`（`RUNNING`），完成后更新为 `SUCCESS`/`FAILED`/`TIMEOUT`。

**错误情形**

| 场景 | code |
|---|---|
| `thresholds` 含非法值 | `1002` |
| `categoryL2` 不存在 | `2001` |
| 路网网络数据集未发布 | `2002` |
| 计算超时（> 55s） | `4001` |
| IGServer 分析服务异常 | `3002` |

**禁止事项**
- MUST NOT 用缓冲区代替服务区。
- MUST NOT 在前端计算覆盖率。
- MUST NOT 返回空 `geomWkt` 却标记成功。

---

## 8. API-06 可达性分析（2SFCA）

| 项 | 值 |
|---|---|
| 方法 / 路径 | `POST /api/v1/analysis/accessibility` |
| 鉴权 | 无 |
| 超时 | 30s |
| 副作用 | 写 `ANALYSIS_TASK`、`ANALYSIS_RESULT` |

**请求体**

| 字段 | 类型 | 必填 | 取值 | 默认 | 说明 |
|---|---|---|---|---|---|
| `categoryL2` | string | 是 | 中类编码 | — | 设施类型 |
| `thresholdMinutes` | int | 是 | `5`/`10`/`15` | — | 服务阈值 |
| `decay` | string | 是 | `GAUSSIAN`/`LINEAR`/`BINARY` | — | 距离衰减 |
| `capacityField` | string | 否 | `CAPACITY` | `CAPACITY` | 供给量字段 |
| `districtCode` | string | 否 | 三区之一 | 空 | 限定行政区 |

**响应 `data`**

| 字段 | 类型 | 说明 |
|---|---|---|
| `taskId` | string | 格式 `AC-yyyyMMdd-四位序号` |
| `elapsedMs` | int | 耗时 |
| `decay` | string | 回显 |
| `stats.min` / `max` / `mean` / `p50` | number | 统计值，4 位小数 |
| `breaks` | number[] | 分级断点，长度 6（5 级） |
| `results` | array | 每个居住点一条 |
| `results[].unitCode` | string | 居住单元代码 |
| `results[].unitName` | string | 名称 |
| `results[].lon` / `lat` | number | 坐标 |
| `results[].score` | number | 可达性指数，4 位小数 |
| `results[].level` | int | 1–5 |

**响应示例**

```json
{ "code": 0, "msg": "success",
  "data": {
    "taskId": "AC-20261021-0001", "elapsedMs": 1240, "decay": "GAUSSIAN",
    "stats": { "min": 0.0, "max": 8.42, "mean": 2.17, "p50": 1.93 },
    "breaks": [0, 0.8, 1.6, 2.6, 4.0, 8.42],
    "results": [
      { "unitCode": "420111001001", "unitName": "关山社区",
        "lon": 114.401, "lat": 30.508, "score": 3.72, "level": 4 }
    ]
  },
  "traceId": "a1b2c3d4e5f6" }
```

**业务规则**
1. `thresholdMinutes` MUST ∈ {5,10,15}；其他值 → `1002`。
2. `breaks` MUST 长度 6、严格递增、首值 = `stats.min`、末值 = `stats.max`。
3. `level` MUST ∈ 1–5，且由 `score` 落在 `breaks` 的区间决定。
4. 结果条数 MUST 等于参与计算的居住点数。
5. `decay` 函数定义（唯一版本）：
   - `BINARY`：`f(t) = 1`（当 `t <= threshold`）
   - `LINEAR`：`f(t) = 1 - t / threshold`
   - `GAUSSIAN`：`f(t) = exp(-0.5 * (t / (threshold/2))²)`
6. 2SFCA 计算步骤（唯一版本）：
   - 第一步：对每个设施 j，`R_j = S_j / Σ_k (D_k * f(t_kj))`，k 为阈值内居住点
   - 第二步：对每个居住点 i，`A_i = Σ_j (R_j * f(t_ij))`，j 为阈值内设施
   - `S_j` 取 `CAPACITY`；若为 `null` 或 0，MUST 用 1 代替并在响应 `stats` 后附加说明 `capacityFallback: true`
7. 分母为 0 时 `R_j` MUST 取 0，MUST NOT 抛 `ArithmeticException`。

**错误情形**

| 场景 | code |
|---|---|
| `thresholdMinutes` 非法 | `1002` |
| OD 矩阵缺失或 `IS_ACTIVE=0` | `2002` |
| 该类别无设施 | `2001` |
| 计算超时 | `4001` |

**禁止事项**
- MUST NOT 允许自定义阈值（只允许 5/10/15）。
- MUST NOT 在前端实现 2SFCA。
- MUST NOT 省略 `breaks` 让前端自行分级。

---

## 9. API-07 导出

| 项 | 值 |
|---|---|
| 方法 / 路径 | `POST /api/v1/export/excel` |
| 鉴权 | 无 |
| 超时 | 60s |
| 响应类型 | **文件流（不套统一包装）** |
| 副作用 | 写 `EXPORT_LOG` |

**请求体**

| 字段 | 类型 | 必填 | 取值 | 默认 | 说明 |
|---|---|---|---|---|---|
| `type` | string | 是 | `STAT_DISTRICT`/`COVERAGE`/`ANALYSIS` | — | 导出类型 |
| `format` | string | 是 | `xlsx`/`csv` | — | 文件格式 |
| `params` | object | 是 | 对应查询的筛选条件 | — | 与界面当前条件一致 |
| `filename` | string | 否 | 长度 1–50 | `export` | 文件名前缀（不含扩展名与时间戳） |

**响应头**

| 头 | 值 |
|---|---|
| `Content-Type` | `xlsx`: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`；`csv`: `text/csv; charset=utf-8` |
| `Content-Disposition` | `attachment; filename="<filename>_<yyyyMMddHHmmss>.<ext>"; filename*=UTF-8''<urlencoded>` |
| `X-Row-Count` | 数据行数（不含表头） |

**响应体**：文件二进制流。

**业务规则**
1. 文件 MUST 为 **UTF-8 with BOM**（前 3 字节 `EF BB BF`）。
2. 文件名时间戳 MUST 为服务器当前时间，格式 `yyyyMMddHHmmss`。
3. 表头 MUST 为中文，且与界面列名逐字一致。
4. 导出内容 MUST 与 `params` 指定的条件一致，MUST NOT 忽略筛选。
5. 行数 0 时 MUST 仍生成文件（只有表头），并返回 `X-Row-Count: 0`，MUST NOT 返回错误。

**错误情形**

| 场景 | 场景 token | code |
|---|---|---|
| `type` 非枚举 | — | `1001`（**以 JSON 包装返回**） |
| 生成失败 | — | `5000`（**以 JSON 包装返回**） |

> 注：错误时 MUST 返回 JSON 包装（`Content-Type: application/json`），成功时返回文件流。前端 MUST 按 `Content-Type` 分支处理。

**禁止事项**
- MUST NOT 用 GBK 编码。
- MUST NOT 在文件名中使用 `/` `\` `:` `*` `?` `"` `<` `>` `|`。
- MUST NOT 忽略 `params` 返回全量数据。

---

## 10. API-08 健康检查

| 项 | 值 |
|---|---|
| 方法 / 路径 | `GET /api/v1/health` |
| 鉴权 | 无 |
| 超时 | 5s |

**响应 `data`**

| 字段 | 类型 | 取值 | 说明 |
|---|---|---|---|
| `status` | string | `UP`/`DEGRADED`/`DOWN` | 整体状态 |
| `components.mysql` | string | `UP`/`DOWN` | 数据库连通 |
| `components.igs` | string | `UP`/`DOWN` | IGServer 连通 |
| `components.odMatrix` | string | `LOADED`/`MISSING` | OD 矩阵状态 |
| `version` | string | 语义化版本 | 后端版本 |

**响应示例**

```json
{ "code": 0, "msg": "success",
  "data": { "status": "UP",
    "components": { "mysql": "UP", "igs": "UP", "odMatrix": "LOADED" },
    "version": "1.0.0" },
  "traceId": "a1b2c3d4e5f6" }
```

**业务规则**
1. `status` 判定：全部 `UP`/`LOADED` → `UP`；`igs` 或 `mysql` 任一 `DOWN` → `DOWN`；仅 `odMatrix=MISSING` → `DEGRADED`。
2. 本接口 MUST NOT 因 `odMatrix=MISSING` 返回非 0 `code`（可达性缺失不影响主流程）。
3. `code` MUST 始终为 `0`（除非后端自身不可用，此时返回 5xx 且无响应体）。
4. 检查 MUST 有 2s 超时，MUST NOT 因 IGServer 无响应而阻塞超过 5s。

**禁止事项**
- MUST NOT 在本接口暴露数据库连接串、Key、文件路径。

---

## 11. IGServer 服务调用契约

> 这些不是我们定义的接口，但**调用参数属于契约**。MUST 全部集中在 `config/index.js`（前端）与 `application.yml`（后端），MUST NOT 散落在业务代码中。

### 11.1 连接参数

| 配置项 | 前端键名 | 后端键名 | 值 |
|---|---|---|---|
| IGServer 基址 | `IGS_BASE` | — | `/igs`（经 Nginx 反代） |
| IGServer IP | — | `igs.ip` | `127.0.0.1` |
| IGServer 端口 | — | `igs.port` | `6163` |
| 地图文档名 | `MAP_DOC_NAME` | `igs.mapDoc` | `wh_facility` |

### 11.2 图层索引

| 键名 | 值 | 说明 |
|---|---|---|
| `LAYER_FACILITY` | `wh_facility/0` | 设施点 |
| `LAYER_DISTRICT` | `wh_facility/1` | 行政区面 |
| `LAYER_STREET` | `wh_facility/2` | 街道面 |
| `LAYER_RESIDENTIAL` | `wh_facility/3` | 居住小区点 |

### 11.3 服务类型与调用方

| 服务 | 类型 | 调用方 | 用途 |
|---|---|---|---|
| 地图文档 | REST | 浏览器 | 加载主图层（FR-M1-01） |
| 瓦片 | MapGIS Tile | 浏览器 | 底图（FR-M1-06） |
| 要素查询 | REST | 浏览器 + `app` | 属性/空间查询（FR-M2-02/03/04） |
| 缓冲区 | 功能服务 | — | **不使用**（前端 Turf 计算） |
| 网络分析 | 功能服务 | `app` | 服务区（API-05） |
| 栅格分析 | 功能服务 | `app` | 核密度（FR-M4-03） |

**强制约束**

| ID | 规则 |
|---|---|
| `A-11` | 图层索引 MUST 与发布结果一致；发布后变更 MUST 同步改配置并通知全组。 |
| `A-12` | 前端 MUST NOT 直连 `6163`，MUST 走 `/igs` 反代。 |
| `A-13` | 功能服务（网络分析、栅格分析）MUST 先在工作流编辑器搭好并发布模板，服务名写入配置。MUST NOT 假设它们像 REST 一样可直接调用。 |
| `A-14` | Token 默认为**关闭**状态。若开启，`serviceFactory` MUST 统一注入，业务代码 MUST NOT 各自拼接。 |

---

## 12. 契约冻结与变更

| ID | 规则 |
|---|---|
| `A-15` | 本文件的 8 个接口为 **FROZEN**。新增/改路径/改字段 MUST 走 SPEC 修订（`T-900`）。 |
| `A-16` | `project/api/openapi.yaml` MUST 与本文件保持一致。不一致时以本文件为准，并 MUST 修正 YAML。 |
| `A-17` | 变更 MUST 同时更新：本文件、`openapi.yaml`、受影响前端 `api/*.js`、受影响后端 DTO。四项缺一即为未完成。 |
| `A-18` | 前端 MUST NOT 为了适配后端实现而改动字段名；应由后端按本文件输出。 |

---

## 13. 禁止事项（A 系列）

| ID | 禁令 | 判定为失败 |
|---|---|---|
| `A-19` | 不得新增第 9 个业务接口 | 出现 `/api/v1/` 下清单外的路径 |
| `A-20` | 不得复用 `API-02` 实现点选/周边查询 | FR-M2-02/04 走了 `/facilities` |
| `A-21` | 不得在响应中返回数据库原始列名 | 响应 JSON 含 `CAT_L1`、`FAC_CODE`、`METRIC_VALUE` |
| `A-22` | 不得省略 `traceId` | 任一响应缺该字段 |
| `A-23` | 不得用 `0` 代替 `null` 表示"无值" | `perCapita` 分母为 0 时返回 0 |
| `A-24` | 不得在前端硬编码任何 Key | `grep -rn "key=\|tk=" frontend/src` 有命中 |
| `A-25` | 不得让 `POST` 接口产生非幂等副作用（重复调用产生多条相同结果） | 相同 `params` 24h 内返回不同 `taskId` |
| `A-26` | 不得在错误响应中返回堆栈 | `msg` 或 `data` 含 `Exception`、`at com.`、`SQL` |

---

## 14. 修订记录

| 版本 | 日期 | 修订内容 |
|---|---|---|
| 1.0.0 | 2026-10-21 | 初始发布：8 个业务接口 + IGServer 调用契约 |

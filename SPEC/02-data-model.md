# 02 · DATA MODEL

| 字段 | 值 |
|---|---|
| `spec.id` | SPEC-02 |
| `spec.version` | 1.0.0 |
| `spec.status` | FROZEN |
| `spec.owner` | 项目组 |
| `spec.updated` | 2026-10-21 |
| `spec.depends_on` | `00-overview.md` |
| `spec.authority` | **第 2 顺位。字段名、类型、约束的唯一权威。任何文件与本文件冲突，以本文件为准。** |

---

## 1. 数据域总览

| 域 | 载体 | 内容 | 唯一写入者 | 访问方式 |
|---|---|---|---|---|
| **空间域** | MapGIS GDB | 设施点、区/街道面、居住小区、路网、核密度栅格 | MapGIS Desktop / IGServer | IGServer 服务 |
| **业务域** | MySQL 8.0 | 字典、统计结果、分析任务与结果、导出日志、配置 | `app`（Spring Boot） | JDBC |
| **文件域** | 本地文件系统 | 瓦片目录、OD 矩阵 CSV、导出文件 | 各生成方 | 文件读取 |

### 三条铁律（违反即失败）

| ID | 规则 |
|---|---|
| `DM-01` | **几何数据只存 GDB。** MySQL 除 `ANALYSIS_RESULT.GEOM_WKT`（结果快照）外，MUST NOT 存任何几何。 |
| `DM-02` | **`app` MUST NOT 直接读写 GDB。** 需要空间数据一律经 IGServer。 |
| `DM-03` | **MySQL 只存派生数据。** 删库后 MUST 能由 GDB + 算法完整重建（`ANALYSIS_TASK`/`EXPORT_LOG` 除外，其为过程日志）。 |

---

## 2. 命名与类型强制约定

| 项 | 规定 |
|---|---|
| 表名 | 全大写 + 下划线，单数，前缀表类别（`DICT_`/`STAT_`/`ANALYSIS_`/`SYS_`） |
| 字段名 | 全大写 + 下划线 |
| 主键名 | 表名去前缀 + `_ID`，或业务键本身（如 `FAC_CODE`） |
| 布尔字段 | MUST 用 `TINYINT(1)`，取值 `0/1`，MUST NOT 用 `BOOLEAN` 关键字 |
| 金额/比率 | `DECIMAL(p,s)`，MUST NOT 用 `FLOAT`/`DOUBLE` 存需精确比较的值 |
| 经纬度 | `DECIMAL(10,6)`，保留 6 位小数 |
| 时间 | `DATETIME`，**不使用 `TIMESTAMP`**（避免时区隐式转换） |
| 枚举 | `VARCHAR(n)` + 注释列出合法值，MUST NOT 用 MySQL `ENUM` 类型（改值需 DDL） |
| JSON | `JSON` 类型，MUST NOT 用 `TEXT` 存 JSON |
| 大文本 | `LONGTEXT` |
| 字符集 | 全库 `utf8mb4` / `utf8mb4_general_ci` |
| 引擎 | 全表 `InnoDB` |
| 注释 | **每张表、每个字段 MUST 有 `COMMENT`**，缺失即为规范缺陷 |

**强制约束**

| ID | 规则 |
|---|---|
| `DM-04` | 字段类型 MUST 与本文件 DDL 完全一致。MUST NOT 以"更合适"为由修改。 |
| `DM-05` | 新增字段 MUST 通过 SPEC 修订（`T-900`），MUST NOT 在实现中直接 `ALTER TABLE`。 |

---

## 3. 空间域（MapGIS GDB）图层契约

### 3.1 图层清单

| 图层名 | 几何类型 | 说明 | 记录量级 | 必须建属性索引 |
|---|---|---|---|---|
| `FACILITY` | Point | 五类设施点 | 3000–5000 | `FAC_CODE`（唯一）、`CAT_L1`、`CAT_L2`、`DISTRICT_CODE`、`STREET_CODE` |
| `DISTRICT` | Polygon | 行政区面（3 个） | 3 | `DIST_CODE`（唯一） |
| `STREET` | Polygon | 街道面 | 约 40 | `STREET_CODE`（唯一）、`DIST_CODE` |
| `RESIDENTIAL` | Point | 居住小区点 | 1000–3000 | `RES_CODE`（唯一）、`STREET_CODE` |
| `ROAD` | Line | 路网（含拓扑） | 5000–20000 | `ROAD_ID`（唯一） |
| `KDE_RASTER` | Raster | 核密度结果（按类别多份） | 5–10 幅 | — |

### 3.2 `FACILITY` 字段契约（唯一权威）

| 字段 | 类型 | 必填 | 说明 | 示例 |
|---|---|---|---|---|
| `FID` | Integer | 是 | GDB 空间域代理主键，**不对外暴露** | 10001 |
| `FAC_CODE` | String(32) | 是 | **业务主键，全局唯一，永不变更**。格式 `区码-大类-中类-四位序号` | `420111-MED-CHS-0007` |
| `NAME` | String(100) | 是 | 标准化后名称 | 关山街社区卫生服务中心 |
| `NAME_RAW` | String(200) | 否 | 原始名称（溯源用） | 关山街社区卫生服务中心（原） |
| `CAT_L1` | String(3) | 是 | 大类编码 | `MED` |
| `CAT_L2` | String(3) | 是 | 中类编码 | `CHC` |
| `CAT_L3` | String(20) | 否 | 小类编码 | — |
| `ADDRESS` | String(200) | 否 | 详细地址 | 武汉市洪山区关山大道 100 号 |
| `DISTRICT_CODE` | String(6) | 是 | 行政区代码，**由空间连接生成** | `420111` |
| `DISTRICT` | String(20) | 是 | 行政区名称 | 洪山区 |
| `STREET_CODE` | String(9) | 否 | 街道代码，由空间连接生成 | `420111001` |
| `STREET` | String(50) | 否 | 街道名称 | 关山街道 |
| `COMMUNITY` | String(50) | 否 | 社区名称 | 关山社区 |
| `LON` | Double(10,6) | 是 | 经度，**CGCS2000** | 114.398765 |
| `LAT` | Double(10,6) | 是 | 纬度，**CGCS2000** | 30.512345 |
| `CAPACITY` | Integer | 否 | 服务能力数值 | 120 |
| `CAP_UNIT` | String(10) | 否 | 能力单位 | 床位 |
| `AREA` | Double | 否 | 占地面积（m²） | 15000 |
| `LEVEL` | String(20) | 否 | 等级 | 一级 |
| `STATUS` | String(10) | 是 | 运营状态，取值 `正常`/`停办`/`在建`/`未知` | 正常 |
| `SRC_TYPE` | String(20) | 是 | 来源类型，取值 `政府名录`/`部门名录`/`POI`/`实地` | 政府名录 |
| `SRC_DETAIL` | String(100) | 否 | 来源明细 | 武汉市小学一览表 2026 |
| `SRC_DATE` | Date | 是 | 采集/更新日期 | 2026-11-05 |
| `CONFIDENCE` | String(4) | 否 | 置信度，取值 `高`/`中`/`低` | 高 |
| `REMARK` | String(200) | 否 | 备注 | 含分校区 |

**强制约束**

| ID | 规则 |
|---|---|
| `DM-06` | `FAC_CODE` 分配后 MUST NOT 变更。设施改名、搬迁、状态变化均不改码。 |
| `DM-07` | `DISTRICT_CODE` / `STREET_CODE` MUST 由空间连接（Spatial Join）生成，MUST NOT 手工录入。 |
| `DM-08` | `STREET_CODE` 允许为空（边界地带或路网外），`DISTRICT_CODE` MUST NOT 为空。 |
| `DM-09` | `STATUS != '正常'` 的设施 MUST 仍保留在库中，仅在前端默认筛选中排除。MUST NOT 物理删除。 |

### 3.3 `RESIDENTIAL` 字段契约

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `RES_CODE` | String(20) | 是 | 居住小区唯一编码 |
| `RES_NAME` | String(100) | 是 | 小区名称 |
| `DISTRICT_CODE` | String(6) | 是 | 所属行政区代码 |
| `STREET_CODE` | String(9) | 否 | 所属街道代码 |
| `HOUSEHOLDS` | Integer | 否 | 户数 |
| `POP_EST` | Integer | 否 | 估算人口（住户数 × 2.8，须在《数据说明》注明） |
| `LON` | Double(10,6) | 是 | 经度 |
| `LAT` | Double(10,6) | 是 | 纬度 |

### 3.4 `ROAD` 字段契约

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `ROAD_ID` | Integer | 是 | 主键 |
| `ROAD_NAME` | String(100) | 否 | 道路名称 |
| `ROAD_CLASS` | String(20) | 是 | 取值 `主干道`/`次干道`/`支路`/`步行道` |
| `LENGTH_M` | Double | 是 | 长度（米） |
| `WALK_SPEED` | Double | 是 | 步行速度（米/分钟），默认 `75` |
| `DRIVE_SPEED` | Double | 是 | 车行速度（km/h），按等级赋值：主干道 40、次干道 30、支路 20 |
| `ONE_WAY` | Integer | 是 | `0` 双向 / `1` 单行 |

---

## 4. MySQL DDL（可直接执行）

> **规则 `DM-10`：以下 DDL MUST 原样保存为 `project/db/schema.sql`。MUST NOT 增删改任何字符（注释除外）。**

```sql
-- ============================================================
-- 城市公共服务设施分布 WebGIS 平台 - 业务库
-- 版本: 1.0.0  日期: 2026-10-21
-- 字符集: utf8mb4  引擎: InnoDB
-- ============================================================

CREATE DATABASE IF NOT EXISTS gis_facility
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

USE gis_facility;

-- ------------------------------------------------------------
-- 1. 字典：设施类别
-- ------------------------------------------------------------
CREATE TABLE DICT_CATEGORY (
  CAT_L1      CHAR(3)      NOT NULL                COMMENT '大类编码：EDU/MED/CUL/WEL/COM',
  CAT_L2      CHAR(3)      NOT NULL                COMMENT '中类编码，见 seed',
  L1_NAME     VARCHAR(30)  NOT NULL                COMMENT '大类中文名',
  L2_NAME     VARCHAR(50)  NOT NULL                COMMENT '中类中文名',
  LIFE_CIRCLE TINYINT      NULL                    COMMENT '生活圈分钟数 5/10/15；NULL=车行或不适用',
  COLOR_HEX   CHAR(7)      NOT NULL                COMMENT '前端配色，格式 #RRGGBB',
  SORT_NO     INT          NOT NULL DEFAULT 0      COMMENT '排序号，升序显示',
  PRIMARY KEY (CAT_L1, CAT_L2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设施类别字典（25 条中类）';

-- ------------------------------------------------------------
-- 2. 字典：行政区
-- ------------------------------------------------------------
CREATE TABLE DICT_DISTRICT (
  DIST_CODE   CHAR(6)      NOT NULL                COMMENT '行政区代码（GB/T 2260）',
  DIST_NAME   VARCHAR(20)  NOT NULL                COMMENT '行政区名称',
  AREA_KM2    DECIMAL(10,2) NULL                   COMMENT '面积（km²）',
  POP_TOTAL   INT          NULL                    COMMENT '常住人口（人）',
  SORT_NO     INT          NOT NULL DEFAULT 0      COMMENT '排序号',
  PRIMARY KEY (DIST_CODE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='行政区字典（3 条）';

-- ------------------------------------------------------------
-- 3. 字典：街道
-- ------------------------------------------------------------
CREATE TABLE DICT_STREET (
  STREET_CODE CHAR(9)      NOT NULL                COMMENT '街道代码',
  STREET_NAME VARCHAR(50)  NOT NULL                COMMENT '街道名称',
  DIST_CODE   CHAR(6)      NOT NULL                COMMENT '所属行政区代码',
  AREA_KM2    DECIMAL(10,2) NULL                   COMMENT '面积（km²）',
  POP_TOTAL   INT          NULL                    COMMENT '常住人口（人）',
  SORT_NO     INT          NOT NULL DEFAULT 0      COMMENT '排序号',
  PRIMARY KEY (STREET_CODE),
  KEY IDX_STREET_DIST (DIST_CODE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='街道字典（约 40 条）';

-- ------------------------------------------------------------
-- 4. 统计：分区指标
-- ------------------------------------------------------------
CREATE TABLE STAT_DISTRICT (
  STAT_ID      BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  LEVEL        VARCHAR(10)  NOT NULL                COMMENT '统计层级：district/street',
  UNIT_CODE    VARCHAR(15)  NOT NULL                COMMENT '统计单元代码',
  UNIT_NAME    VARCHAR(50)  NOT NULL                COMMENT '统计单元名称',
  CAT_L1       CHAR(3)      NOT NULL                COMMENT '设施大类编码；ALL 表示全类合计',
  METRIC       VARCHAR(20)  NOT NULL                COMMENT '指标：count/density/perCapita',
  METRIC_VALUE DECIMAL(12,4) NULL                   COMMENT '指标值；分母为 0 时为 NULL',
  POP_TOTAL    INT          NULL                    COMMENT '常住人口（冗余，便于展示）',
  FAC_COUNT    INT          NOT NULL DEFAULT 0      COMMENT '设施数量',
  DATA_DATE    DATE         NOT NULL                COMMENT '数据版本日期',
  CALC_TIME    DATETIME     NOT NULL                COMMENT '计算时间',
  PRIMARY KEY (STAT_ID),
  UNIQUE KEY UK_STAT (LEVEL, UNIT_CODE, CAT_L1, METRIC, DATA_DATE),
  KEY IDX_STAT_CAT (CAT_L1, METRIC),
  KEY IDX_STAT_DATE (DATA_DATE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分区统计结果（派生，可重算）';

-- ------------------------------------------------------------
-- 5. 统计：覆盖率 / 达标率
-- ------------------------------------------------------------
CREATE TABLE STAT_COVERAGE (
  COV_ID         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  UNIT_CODE      VARCHAR(15)  NOT NULL                COMMENT '统计单元代码（街道）',
  UNIT_NAME      VARCHAR(50)  NOT NULL                COMMENT '统计单元名称',
  CAT_L2         CHAR(3)      NOT NULL                COMMENT '设施中类编码',
  THRESHOLD_MIN  TINYINT      NOT NULL                COMMENT '判定阈值（分钟）',
  COVERAGE_RATE  DECIMAL(6,3) NOT NULL                COMMENT '覆盖率 0.000-1.000',
  QUALIFIED      TINYINT(1)   NOT NULL                COMMENT '是否达标：1 达标 / 0 未达标',
  GAP_COUNT      INT          NOT NULL DEFAULT 0      COMMENT '未覆盖居住小区数',
  DATA_DATE      DATE         NOT NULL                COMMENT '数据版本日期',
  CALC_TIME      DATETIME     NOT NULL                COMMENT '计算时间',
  PRIMARY KEY (COV_ID),
  UNIQUE KEY UK_COV (UNIT_CODE, CAT_L2, THRESHOLD_MIN, DATA_DATE),
  KEY IDX_COV_CAT (CAT_L2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='覆盖率与达标率（派生，可重算）';

-- ------------------------------------------------------------
-- 6. 分析任务
-- ------------------------------------------------------------
CREATE TABLE ANALYSIS_TASK (
  TASK_ID      VARCHAR(32)  NOT NULL                COMMENT '任务号：AC/SA/BF-yyyyMMdd-四位序号',
  TASK_TYPE    VARCHAR(20)  NOT NULL                COMMENT 'BUFFER/SERVICE_AREA/ACCESSIBILITY',
  PARAMS_JSON  JSON         NOT NULL                COMMENT '完整入参，复现依据',
  STATUS       VARCHAR(15)  NOT NULL                COMMENT 'RUNNING/SUCCESS/FAILED/TIMEOUT',
  ELAPSED_MS   INT          NULL                    COMMENT '耗时（毫秒）',
  ERROR_MSG    VARCHAR(500) NULL                    COMMENT '失败原因',
  CREATE_TIME  DATETIME     NOT NULL                COMMENT '创建时间',
  FINISH_TIME  DATETIME     NULL                    COMMENT '完成时间',
  PRIMARY KEY (TASK_ID),
  KEY IDX_TASK_TYPE_TIME (TASK_TYPE, CREATE_TIME)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分析任务记录（过程日志，不可重建）';

-- ------------------------------------------------------------
-- 7. 分析结果快照
-- ------------------------------------------------------------
CREATE TABLE ANALYSIS_RESULT (
  RESULT_ID    BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  TASK_ID      VARCHAR(32)  NOT NULL                COMMENT '关联任务号',
  THRESHOLD    INT          NULL                    COMMENT '阈值（分钟或米）',
  GEOM_WKT     LONGTEXT     NULL                    COMMENT '结果几何 WKT 文本（仅快照，不做空间查询）',
  UNIT_CODE    VARCHAR(15)  NULL                    COMMENT '统计单元代码（可达性场景）',
  UNIT_NAME    VARCHAR(50)  NULL                    COMMENT '统计单元名称',
  LON          DECIMAL(10,6) NULL                   COMMENT '经度',
  LAT          DECIMAL(10,6) NULL                   COMMENT '纬度',
  SCORE        DECIMAL(10,4) NULL                   COMMENT '可达性分值',
  LEVEL        TINYINT      NULL                    COMMENT '分级 1-5',
  EXTRA_JSON   JSON         NULL                    COMMENT '附带统计（覆盖小区数等）',
  CREATE_TIME  DATETIME     NOT NULL                COMMENT '生成时间',
  PRIMARY KEY (RESULT_ID),
  KEY IDX_RESULT_TASK (TASK_ID),
  KEY IDX_RESULT_UNIT (UNIT_CODE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分析结果快照（派生，可重算）';

-- ------------------------------------------------------------
-- 8. 导出日志
-- ------------------------------------------------------------
CREATE TABLE EXPORT_LOG (
  LOG_ID      BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  EXPORT_TYPE VARCHAR(20)  NOT NULL                COMMENT 'STAT_DISTRICT/COVERAGE/ANALYSIS',
  FORMAT      VARCHAR(10)  NOT NULL                COMMENT 'xlsx/csv/png/geojson',
  PARAMS_JSON JSON         NULL                    COMMENT '导出条件快照',
  FILE_NAME   VARCHAR(200) NOT NULL                COMMENT '生成文件名',
  ROW_COUNT   INT          NULL                    COMMENT '数据行数',
  CREATE_TIME DATETIME     NOT NULL                COMMENT '导出时间',
  PRIMARY KEY (LOG_ID),
  KEY IDX_EXPORT_TIME (CREATE_TIME)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='导出记录（审计用）';

-- ------------------------------------------------------------
-- 9. OD 矩阵元信息
-- ------------------------------------------------------------
CREATE TABLE OD_MATRIX_META (
  MATRIX_ID     VARCHAR(32) NOT NULL               COMMENT '矩阵号：OD-yyyyMMdd-序号',
  FAC_COUNT     INT         NOT NULL               COMMENT '参与计算的设施数',
  RES_COUNT     INT         NOT NULL               COMMENT '参与计算的居住点数',
  TRAVEL_MODE   VARCHAR(10) NOT NULL               COMMENT 'WALK/DRIVE',
  FILE_PATH     VARCHAR(300) NOT NULL              COMMENT 'CSV 相对路径',
  GENERATE_TIME DATETIME    NOT NULL               COMMENT '生成时间',
  IS_ACTIVE     TINYINT(1)  NOT NULL DEFAULT 0     COMMENT '是否当前生效：1 是 / 0 否',
  PRIMARY KEY (MATRIX_ID),
  KEY IDX_OD_ACTIVE (IS_ACTIVE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OD 成本矩阵元信息';

-- ------------------------------------------------------------
-- 10. 系统配置
-- ------------------------------------------------------------
CREATE TABLE SYS_CONFIG (
  CFG_KEY    VARCHAR(50)  NOT NULL                 COMMENT '配置键',
  CFG_VALUE  VARCHAR(500) NOT NULL                 COMMENT '配置值',
  REMARK     VARCHAR(200) NULL                     COMMENT '说明',
  UPDATED_AT DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (CFG_KEY)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置（含地图 Key 等）';
```

**强制约束**

| ID | 规则 |
|---|---|
| `DM-11` | MUST NOT 建物理外键（`FOREIGN KEY`）。关联靠逻辑外键 + 索引 + 完整性检查脚本。 |
| `DM-12` | MUST NOT 建触发器、存储过程、视图。逻辑 MUST 在应用层。 |
| `DM-13` | `DATA_DATE` MUST 用于区分数据版本；查询默认取最新版本。MUST NOT 覆盖历史版本。 |

---

## 5. 种子数据（`project/db/seed.sql`）

> **规则 `DM-14`：以下 INSERT MUST 原样执行。人口数据为七普近似值，MUST 由 `T-013` 用统计年鉴数据替换，替换时 MUST 在变更登记表记录。**

```sql
USE gis_facility;

-- 设施类别字典（25 条中类）
INSERT INTO DICT_CATEGORY (CAT_L1, CAT_L2, L1_NAME, L2_NAME, LIFE_CIRCLE, COLOR_HEX, SORT_NO) VALUES
('EDU','KIN','教育设施','幼儿园',5,'#4A90D9',101),
('EDU','PRI','教育设施','小学',10,'#4A90D9',102),
('EDU','JUN','教育设施','初中',15,'#4A90D9',103),
('EDU','SEN','教育设施','高中',15,'#4A90D9',104),
('EDU','VOC','教育设施','中等职业学校',NULL,'#4A90D9',105),
('MED','HGE','医疗卫生','综合医院',NULL,'#E05252',201),
('MED','HSP','医疗卫生','专科医院',NULL,'#E05252',202),
('MED','HTM','医疗卫生','中医医院',NULL,'#E05252',203),
('MED','CHC','医疗卫生','社区卫生服务中心',15,'#E05252',204),
('MED','CHS','医疗卫生','社区卫生服务站',5,'#E05252',205),
('MED','CLN','医疗卫生','门诊部',15,'#E05252',206),
('CUL','LIB','文化体育','图书馆',15,'#8B5CF6',301),
('CUL','MUS','文化体育','博物馆',NULL,'#8B5CF6',302),
('CUL','CCC','文化体育','文化馆（站）',10,'#8B5CF6',303),
('CUL','STD','文化体育','体育场馆',15,'#8B5CF6',304),
('CUL','FIT','文化体育','全民健身中心',15,'#8B5CF6',305),
('CUL','PRK','文化体育','城市公园',15,'#8B5CF6',306),
('WEL','NUR','社会福利','养老院',15,'#F59E0B',401),
('WEL','CAR','社会福利','老年养护院',15,'#F59E0B',402),
('WEL','DAY','社会福利','日间照料中心',5,'#F59E0B',403),
('WEL','DIS','社会福利','残疾人服务设施',NULL,'#F59E0B',404),
('WEL','CHW','社会福利','儿童福利院',NULL,'#F59E0B',405),
('COM','SVC','社区服务','社区服务中心（街道级）',15,'#10B981',501),
('COM','STA','社区服务','社区服务站',5,'#10B981',502),
('COM','POL','社区服务','派出所',15,'#10B981',503);

-- 行政区（3 条）
INSERT INTO DICT_DISTRICT (DIST_CODE, DIST_NAME, AREA_KM2, POP_TOTAL, SORT_NO) VALUES
('420111','洪山区',570.00,1406000,1),
('420106','武昌区', 82.00,1097000,2),
('420105','汉阳区',111.00, 837000,3);

-- 系统配置
INSERT INTO SYS_CONFIG (CFG_KEY, CFG_VALUE, REMARK) VALUES
('TIANDITU_TOKEN','__FILL_AT_DEPLOY__','天地图 Key，部署时由后端环境变量注入，禁止提交真实值'),
('MAP_DOC_NAME','wh_facility','IGServer 地图文档名'),
('DATA_DATE','2026-11-05','当前数据版本日期');
```

**强制约束**

| ID | 规则 |
|---|---|
| `DM-15` | `TIANDITU_TOKEN` 的 `CFG_VALUE` MUST 保持 `__FILL_AT_DEPLOY__`。真实值 MUST 由部署时环境变量写入。MUST NOT 提交真实 Key。 |
| `DM-16` | 种子数据 MUST 幂等：重复执行不产生重复行（用 `INSERT ... ON DUPLICATE KEY UPDATE` 或执行前 `DELETE`）。 |

---

## 6. 字段映射表（唯一权威）

> **规则 `DM-17`：JSON 字段名 MUST 按下表映射。MUST NOT 自行发明别名。表外字段一律不得出现在 API 响应中。**

### 6.1 通用映射规则

`JSON 名 = DB/GDB 字段名转小驼峰`，例外见 6.3。

示例：`FAC_CODE` → `facCode`；`CAT_L1` → `categoryL1`（**注意不是 `catL1`**，见例外）。

### 6.2 `FACILITY` 映射表

| GDB 字段 | JSON 字段 | 类型 | 是否对外 |
|---|---|---|---|
| `FID` | — | — | **否** |
| `FAC_CODE` | `facCode` | string | 是 |
| `NAME` | `name` | string | 是 |
| `NAME_RAW` | `nameRaw` | string | 是 |
| `CAT_L1` | `categoryL1` | string | 是 |
| `CAT_L2` | `categoryL2` | string | 是 |
| `CAT_L3` | `categoryL3` | string | 是 |
| `ADDRESS` | `address` | string | 是 |
| `DISTRICT_CODE` | `districtCode` | string | 是 |
| `DISTRICT` | `districtName` | string | 是 |
| `STREET_CODE` | `streetCode` | string | 是 |
| `STREET` | `streetName` | string | 是 |
| `COMMUNITY` | `communityName` | string | 是 |
| `LON` | `lon` | number | 是 |
| `LAT` | `lat` | number | 是 |
| `CAPACITY` | `capacity` | number | 是 |
| `CAP_UNIT` | `capacityUnit` | string | 是 |
| `AREA` | `area` | number | 是 |
| `LEVEL` | `level` | string | 是 |
| `STATUS` | `status` | string | 是 |
| `SRC_TYPE` | `srcType` | string | 是 |
| `SRC_DETAIL` | `srcDetail` | string | 是 |
| `SRC_DATE` | `srcDate` | string(`yyyy-MM-dd`) | 是 |
| `CONFIDENCE` | `confidence` | string | 是 |
| `REMARK` | `remark` | string | 是 |

### 6.3 例外映射（必须记住）

| 来源字段 | JSON 字段 | 例外原因 |
|---|---|---|
| `CAT_L1` / `CAT_L2` / `CAT_L3` | `categoryL1` / `categoryL2` / `categoryL3` | 展开 `CAT` 为 `category`，避免 `catL1` 歧义 |
| `DISTRICT`（名称） | `districtName` | 与 `districtCode` 区分 |
| `STREET`（名称） | `streetName` | 同上 |
| `COMMUNITY`（名称） | `communityName` | 同上 |
| `CAP_UNIT` | `capacityUnit` | 展开 `CAP` 为 `capacity` |

### 6.4 统计表映射

| DB 字段 | JSON 字段 | 说明 |
|---|---|---|
| `UNIT_CODE` | `unitCode` | 统计单元代码 |
| `UNIT_NAME` | `unitName` | 统计单元名称 |
| `LEVEL`（STAT_DISTRICT） | `level` | `district`/`street` |
| `METRIC` | `metric` | `count`/`density`/`perCapita` |
| `METRIC_VALUE` | `value` | **注意：不是 `metricValue`** |
| `POP_TOTAL` | `popTotal` | 常住人口 |
| `FAC_COUNT` | `facCount` | 设施数量 |
| `COVERAGE_RATE` | `coverageRate` | 覆盖率 |
| `QUALIFIED` | `qualified` | **布尔**，`true`/`false`（DB 存 0/1） |
| `GAP_COUNT` | `gapCount` | 缺口数 |
| `DATA_DATE` | `dataDate` | `yyyy-MM-dd` |

**强制约束**

| ID | 规则 |
|---|---|
| `DM-18` | `QUALIFIED` 从 `TINYINT(1)` 转 JSON 时 MUST 转为 `true`/`false`，MUST NOT 返回 `0`/`1`。 |
| `DM-19` | `DATE` 类型 MUST 序列化为 `yyyy-MM-dd` 字符串，MUST NOT 返回时间戳。 |
| `DM-20` | `DATETIME` MUST 序列化为 ISO 8601 带时区，如 `2026-10-21T00:11:56+08:00`。 |
| `DM-21` | `DECIMAL` MUST 序列化为 JSON number，MUST NOT 序列化为字符串。 |

---

## 7. 数据完整性规则（可 SQL 检查）

**规则 `DM-22`：以下检查 MUST 实现为 `project/scripts/check_data.sql`，由 `scripts/check.sh CHK-DATA` 执行。任一返回行数 > 0 即判定失败。**

| 检查 ID | 检查内容 | SQL |
|---|---|---|
| `DI-01` | 类别字典条数应为 25 | `SELECT 25 - COUNT(*) FROM DICT_CATEGORY;` |
| `DI-02` | 行政区字典条数应为 3 | `SELECT 3 - COUNT(*) FROM DICT_DISTRICT;` |
| `DI-03` | 行政区代码必须为三区之一 | `SELECT DIST_CODE FROM DICT_DISTRICT WHERE DIST_CODE NOT IN ('420111','420106','420105');` |
| `DI-04` | 统计表中的单元必须存在于字典 | `SELECT DISTINCT UNIT_CODE FROM STAT_DISTRICT WHERE LEVEL='street' AND UNIT_CODE NOT IN (SELECT STREET_CODE FROM DICT_STREET);` |
| `DI-05` | 统计表单元必须存在于字典（区级） | `SELECT DISTINCT UNIT_CODE FROM STAT_DISTRICT WHERE LEVEL='district' AND UNIT_CODE NOT IN (SELECT DIST_CODE FROM DICT_DISTRICT);` |
| `DI-06` | 覆盖率必须在 [0,1] | `SELECT COV_ID FROM STAT_COVERAGE WHERE COVERAGE_RATE < 0 OR COVERAGE_RATE > 1;` |
| `DI-07` | 达标标志必须为 0 或 1 | `SELECT COV_ID FROM STAT_COVERAGE WHERE QUALIFIED NOT IN (0,1);` |
| `DI-08` | 分析任务的失败必须有错误信息 | `SELECT TASK_ID FROM ANALYSIS_TASK WHERE STATUS IN ('FAILED','TIMEOUT') AND (ERROR_MSG IS NULL OR ERROR_MSG='');` |
| `DI-09` | 同时只能有 1 个生效的 OD 矩阵 | `SELECT COUNT(*) - 1 FROM OD_MATRIX_META WHERE IS_ACTIVE = 1;` |
| `DI-10` | 人均指标的分母必须 > 0 | `SELECT STAT_ID FROM STAT_DISTRICT WHERE METRIC='perCapita' AND METRIC_VALUE IS NOT NULL AND (POP_TOTAL IS NULL OR POP_TOTAL <= 0);` |

**GDB 侧检查（由 `T-013` 脚本完成，输出到《数据质量报告》）**

| 检查 ID | 检查内容 | 判定 |
|---|---|---|
| `DG-01` | 五类设施均非空 | 每类 `COUNT > 0` |
| `DG-02` | `FAC_CODE` 全局唯一 | 重复数 = 0 |
| `DG-03` | `LON`/`LAT` 在合理范围 | `113.5 < LON < 115.5` 且 `29.5 < LAT < 31.5` |
| `DG-04` | 坐标系为 CGCS2000 | 元数据检查 |
| `DG-05` | `DISTRICT_CODE` 无空值 | 空值数 = 0 |
| `DG-06` | `CAT_L2` 均在字典中 | 未匹配数 = 0 |

---

## 8. 数据流转与重算规则

| 事件 | MUST 重算 | 触发方式 |
|---|---|---|
| 设施增删改 | `STAT_DISTRICT`、`STAT_COVERAGE`、`OD_MATRIX` | 手工跑 `T-013` 脚本 |
| 人口数据更新 | `STAT_DISTRICT`（`perCapita`） | 同上 |
| 边界调整 | 全部（先重做空间连接） | 同上 |
| 分类规则调整 | `DICT_CATEGORY` + 全部统计 | 同上 |

**强制约束**

| ID | 规则 |
|---|---|
| `DM-23` | 重算 MUST 幂等：先按 `DATA_DATE` 删除当日旧数据，再插入。MUST NOT 执行增量累加。 |
| `DM-24` | 重算完成后 MUST 更新 `SYS_CONFIG.DATA_DATE`。 |
| `DM-25` | `IS_ACTIVE=1` 的 OD 矩阵 MUST 与当前设施数据同版本；不一致时可达性接口 MUST 返回 `2002`。 |

---

## 9. 禁止事项（D 系列）

| ID | 禁令 | 判定为失败 |
|---|---|---|
| `D-01` | 不得修改本文件 DDL 的任何字段名/类型/约束 | 表结构与本文件不一致 |
| `D-02` | 不得在 MySQL 存原始几何 | 出现 `GEOMETRY`/`POINT` 列类型 |
| `D-03` | 不得让 `app` 直连 GDB | 代码中出现 GDB 文件路径或 MapGIS 本地数据源连接 |
| `D-04` | 不得建物理外键、触发器、存储过程、视图 | `SHOW CREATE TABLE` 含 `FOREIGN KEY`/`TRIGGER` |
| `D-05` | 不得用 `FLOAT`/`DOUBLE` 存需要精确比较的比率 | 出现 `FLOAT`/`DOUBLE` 列 |
| `D-06` | 不得用 `TIMESTAMP` 类型 | 出现 `TIMESTAMP` 列 |
| `D-07` | 不得用 MySQL `ENUM` 类型 | 出现 `ENUM(` |
| `D-08` | 不得在代码里硬编码 `TIANDITU_TOKEN` 真实值 | `grep -rn "tk=" frontend/` 有命中 |
| `D-09` | 不得物理删除设施记录（`STATUS` 逻辑标记） | 出现 `DELETE FROM FACILITY` |
| `D-10` | 不得手工填 `DISTRICT_CODE`/`STREET_CODE` | 数据中出现与空间连接结果不符的记录 |

---

## 10. 修订记录

| 版本 | 日期 | 修订内容 |
|---|---|---|
| 1.0.0 | 2026-10-21 | 初始发布：10 张表 DDL + 6 个 GDB 图层契约 + 字段映射表 + 10 条完整性规则 |

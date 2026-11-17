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

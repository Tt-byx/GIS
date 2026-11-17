-- ============================================================
-- 城市公共服务设施分布 WebGIS 平台 - 种子数据
-- 版本: 1.0.0  日期: 2026-10-21
-- 依据: SPEC/02-data-model.md §5
-- 说明: INSERT 的字段与取值逐字取自 SPEC；为满足 DM-16 幂等，
--       每条 INSERT 附加 ON DUPLICATE KEY UPDATE，重复执行不产生重复行。
-- 执行: mysql --default-character-set=utf8mb4 -u root < db/seed.sql
-- ============================================================

USE gis_facility;

-- 固定连接字符集，避免 Windows 客户端默认 GBK 导致中文乱码或超长
SET NAMES utf8mb4;

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
('COM','POL','社区服务','派出所',15,'#10B981',503)
ON DUPLICATE KEY UPDATE
  L1_NAME     = VALUES(L1_NAME),
  L2_NAME     = VALUES(L2_NAME),
  LIFE_CIRCLE = VALUES(LIFE_CIRCLE),
  COLOR_HEX   = VALUES(COLOR_HEX),
  SORT_NO     = VALUES(SORT_NO);

-- 行政区（3 条）
INSERT INTO DICT_DISTRICT (DIST_CODE, DIST_NAME, AREA_KM2, POP_TOTAL, SORT_NO) VALUES
('420111','洪山区',570.00,1406000,1),
('420106','武昌区', 82.00,1097000,2),
('420105','汉阳区',111.00, 837000,3)
ON DUPLICATE KEY UPDATE
  DIST_NAME = VALUES(DIST_NAME),
  AREA_KM2  = VALUES(AREA_KM2),
  POP_TOTAL = VALUES(POP_TOTAL),
  SORT_NO   = VALUES(SORT_NO);

-- 系统配置
INSERT INTO SYS_CONFIG (CFG_KEY, CFG_VALUE, REMARK) VALUES
('TIANDITU_TOKEN','__FILL_AT_DEPLOY__','天地图 Key，部署时由后端环境变量注入，禁止提交真实值'),
('MAP_DOC_NAME','wh_facility','IGServer 地图文档名'),
('DATA_DATE','2026-11-05','当前数据版本日期')
ON DUPLICATE KEY UPDATE
  CFG_VALUE = VALUES(CFG_VALUE),
  REMARK    = VALUES(REMARK);

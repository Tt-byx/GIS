# GIS 平台数据资产总览与使用说明书

更新时间: 2026-11-18 14:10:51
研究区域: 武汉市 **青山区 (420107)、武昌区 (420106)、汉阳区 (420105)**
规范遵循: 严格符合 `SPEC/00-overview.md`、`SPEC/02-data-model.md`、`SPEC/03-api-contract.md`

---

## 一、数据资产目录拓扑

```text
GIS/data/
├── admin/                         # 行政区划空间边界底数 (WGS84 EPSG:4326)
│   ├── study_area_union.geojson   # 三区行政边界统一外包面
│   ├── wuchang.geojson            # 武昌区行政区划多边形
│   ├── qingshan.geojson           # 青山区行政区划多边形
│   ├── hanyang.geojson            # 汉阳区行政区划多边形
│   └── wuhan_districts_ref.geojson# 武汉市 13 区全域参考面
├── raw/                           # 原始采集不可变存档
│   └── poi_raw_gcj02.csv          # 高德 API 原始 POI (25,384 条，带 GCJ02/WGS84 纠偏双坐标)
├── clean/                         # 规范清洗与契约对齐要素库
│   ├── facility_clean.csv         # 五类设施清洗表 (5534 条，24 契约字段，含 FAC_CODE)
│   ├── facility_clean.gpkg        # 五类设施空间图层 (WGS84)
│   ├── residential_clean.csv      # 居住小区点位 (3041 个，含 RES_CODE、户数、估算人口)
│   └── residential_clean.gpkg     # 居住小区空间图层 (WGS84)
├── road/                          # 路网拓扑与连通性底数
│   ├── study_area_drive.graphml   # OSM 行车路网 NetworkX 拓扑图
│   ├── study_area_edges.gpkg      # 道路网边要素 (高斯投影 EPSG:32650)
│   ├── study_area_nodes.gpkg      # 道路网节点要素 (高斯投影 EPSG:32650)
│   ├── [wuchang|qingshan|hanyang]_*# 分区路网拓扑文件
│   └── transit/                   # 公共交通系统专题
│       ├── transit_stops.gpkg     # 公交/地铁站点 (含接驳换乘枢纽度指标)
│       ├── transit_routes.gpkg    # 公交/地铁运营线路
│       └── transit_service_buffers.gpkg # 500m/800m 空间服务区缓冲区
├── od/                            # OD 成本矩阵专题
│   └── od_matrix.csv              # 设施-居住点路网耗时成本矩阵 (facCode, resCode, minutes)
├── od_matrix.csv                  # 目标项目根级就位文件 (支撑 HealthService 探测)
├── raster/                        # 连续空间栅格表面 (GeoTIFF, LZW 无损压缩)
│   ├── pop_total_2020.tif         # WorldPop 2020 常住总人口连续表面
│   ├── pop_elderly_total_2020.tif # 老龄人口空间分布栅格
│   ├── pop_elderly_ratio_2020.tif # 老龄化率空间连续表面 (%)
│   ├── pop_density_km2_2020.tif   # 人口密度空间表面 (人/km²)
│   ├── clcd_landcover_2024.tif    # CLCD 2024 30m 土地覆被利用
│   └── clcd_[builtup|ecological]_mask.tif # 建设用地与生态水体二值掩膜
├── stats/                         # 统计与评价分析成果
│   ├── stat_district_import.sql   # STAT_DISTRICT 分区统计初始化预计算 SQL
│   ├── population_zonal_statistics.csv # 三区人口分区统计
│   ├── landcover_zonal_statistics.csv  # 三区土地覆被分区统计
│   └── transit_population_coverage_analysis.csv # 公共交通人口覆盖评价
└── meta/                          # 元数据规范说明
    ├── crs.md                     # 坐标系统一说明书 (EPSG:4326 / EPSG:32650 / GCJ-02)
    └── sources.md                 # 数据源清单与合规说明
```

---

## 二、核心契约指标对照表

| 规范检查 ID | 契约项 | 规范要求 | 本数据集实测值 | 达标判定 |
|:---|:---|:---|:---|:---:|
| `SC-01` | 设施数据完整性 | 五类设施每类 > 0，总数 ≥ 3000 | 5 大类均覆盖，共 **5534** 条 | **PASS** |
| `DG-01` | 五类设施非空 | EDU/MED/CUL/WEL/COM 均有值 | 全部 > 0 | **PASS** |
| `DG-02` | FAC_CODE 唯一性 | 重复数 = 0，格式 `区-大类-中类-序号` | 重复数 0，100% 匹配正则 | **PASS** |
| `DG-03` | 空间坐标范围 | 经度 113.5~115.5，纬度 29.5~31.5 | 100% 落在三区范围内 | **PASS** |
| `DG-04` | 空间坐标基准 | WGS 84 / CGCS2000 经纬度 | EPSG:4326 (度) | **PASS** |
| `DG-05` | DISTRICT_CODE 完整性 | 必须为 420107/420106/420105 | 空值率 0% | **PASS** |
| `DG-06` | 中类 CAT_L2 命中字典 | 必须落在 25 类标准字典内 | 100% 命中字典 | **PASS** |
| `API-08` | 系统健康探活 | od.matrixPath 文件可读 | `data/od_matrix.csv` 就位 | **LOADED** |

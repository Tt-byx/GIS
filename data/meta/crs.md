# 项目空间坐标系登记说明书 (CRS Specification)

更新时间: 2026-11-17
研究区域: 武汉市 **武昌区 (420106)、青山区 (420107)、汉阳区 (420105)**

## 一、坐标基准定义

| 序号 | 坐标系统名称 | EPSG 代号 | 投影类型 | 适用图层 | 用途说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **WGS 84** | **EPSG:4326** | 地理坐标系 (经纬度/度) | `00_admin/*.geojson`<br>`01_poi/poi_wgs84.gpkg`<br>`02_road/transit/*.gpkg`<br>`04_stats/raster/pop_*.tif`<br>`02_road/*_drive.graphml` | 全球通用标准，数据存储、网络传输、WebGIS 渲染基准 |
| 2 | **WGS 84 / UTM zone 50N** | **EPSG:32650** | 高斯投影 / 投影坐标系 (米) | `02_road/*_edges.gpkg`<br>`02_road/*_nodes.gpkg` | 武汉本地高精度度量，用于真实道路长度、面积与通行耗时计算 |
| 3 | **Albers Conic Equal Area** | 自定义 | 椭球阿尔伯斯等面积投影 | `04_stats/raster/clcd_landcover_2024.tif` | 土地利用与生态空间覆盖面积统计专用 |
| 4 | **GCJ-02 (火星坐标)** | 自定义加密 | 国家测绘加密坐标 | `01_poi/poi_raw_gcj02.csv` (字段保留) | 保留原始采集坐标，供后续高德底图校准与合规审查比对 |

---

## 二、项目统一目录树与坐标系映射清单

```text
project-data/
├── 00_admin/
│   ├── wuchang.geojson                 EPSG:4326 (WGS84)
│   ├── qingshan.geojson                EPSG:4326 (WGS84)
│   ├── hanyang.geojson                 EPSG:4326 (WGS84)
│   ├── study_area_union.geojson        EPSG:4326 (WGS84)
│   └── ref/
│       ├── wuhan_districts_ref.geojson EPSG:4326 (WGS84) [武汉13区标准行政矢量]
│       ├── wuhan_admin_reference.csv   武汉市行政区划代码与中心经纬度表
│       └── hubei_admin_reference.csv   湖北省行政区划参考表
├── 01_poi/
│   ├── poi_raw_gcj02.csv               双字段 (gcj_lon/lat & wgs_lon/lat)
│   └── poi_wgs84.gpkg                  EPSG:4326 (WGS84)
├── 02_road/
│   ├── study_area_drive.graphml        EPSG:4326 (WGS84)
│   ├── study_area_edges.gpkg           EPSG:32650 (UTM 50N)
│   ├── study_area_nodes.gpkg           EPSG:32650 (UTM 50N)
│   ├── *_edges.gpkg / *_nodes.gpkg     EPSG:32650 (UTM 50N)
│   └── transit/                        
│       ├── transit_stops.gpkg          EPSG:4326 (WGS84) [bus_stops, metro_stops 回填接驳属性]
│       ├── transit_routes.gpkg         EPSG:4326 (WGS84) [bus_routes, metro_routes 纠偏三区内实长]
│       ├── transit_service_buffers.gpkg EPSG:4326 (WGS84) [500m公交/800m地铁服务区]
│       ├── transit_stops_summary.csv   经纬度汇总表
│       ├── district_transit_metrics.csv 三区公交供给指标表
│       └── metro_bus_transfer_analysis.csv 地铁-公交接驳枢纽度表
└── 04_stats/
    ├── population_zonal_statistics.csv 三区人口与老龄化分区统计表
    ├── landcover_zonal_statistics.csv  三区土地利用结构统计表
    ├── transit_population_coverage_analysis.csv 交通设施人口覆盖效能分析表
    └── raster/
        ├── pop_total_2020.tif          EPSG:4326 (WGS84) [100m总人口]
        ├── pop_density_km2_2020.tif    EPSG:4326 (WGS84) [100m常住人口密度(人/km²)]
        ├── pop_elderly_total_2020.tif  EPSG:4326 (WGS84) [100m老龄人口(LZW压缩)]
        ├── pop_elderly_ratio_2020.tif  EPSG:4326 (WGS84) [100m老龄化率连续表面(%)]
        ├── clcd_landcover_2024.tif     Albers Equal Area [30m土地覆被分类]
        ├── clcd_builtup_mask.tif       Albers Equal Area [建设用地二值掩膜]
        └── clcd_ecological_mask.tif    Albers Equal Area [生态蓝绿空间掩膜]
```

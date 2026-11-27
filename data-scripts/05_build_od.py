#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""T-018 OD 成本矩阵生成脚本。

产出：data/od/od_matrix.csv（列 facCode,resCode,minutes）
口径（与 GDB 网络类 ROAD_NET 对齐）：
  - 路网：data/road/road_clean.gpkg（EPSG:32650），权值取 ROAD.LENGTH_M（米）；
  - 拓扑：端点捏合，2 m 网格合并（对应 MapGIS 网络类捕捉半径 1.5e-5°≈1.7 m、端点策略）；
  - 步行速度：ROAD.WALK_SPEED = 75 m/min，minutes = 路径长度(m) / 75；
  - 截断：只保留 t <= 15 min（1125 m）的 OD 对。API-06 的 2SFCA 阈值只允许 5/10/15，
    超过 15 min 的对本来就会被丢弃，故按最大阈值截断（行数远小于 5534×3041，见《建库记录》）；
  - 接入：设施/居住点投影到最近路网线，垂距计入步行成本；同一路段上的两点经端点绕行（略保守）。

用法：
  python data-scripts/05_build_od.py [--out data/od/od_matrix.csv]
"""
import argparse
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import geopandas as gpd
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
from shapely.strtree import STRtree

SPEED_M_PER_MIN = 75.0
MAX_MINUTES = 15.0
MAX_METERS = SPEED_M_PER_MIN * MAX_MINUTES  # 1125 m
SNAP_GRID_M = 2.0

ROOT = Path(__file__).resolve().parents[1]


def build_network(roads):
    """端点按 2 m 网格合并建图，返回节点坐标、无向边表与端点索引。"""
    node_index = {}
    node_xy = []
    edges = []
    for geom, length in zip(roads.geometry, roads["LENGTH_M"]):
        if geom is None or geom.is_empty:
            continue
        coords = list(geom.coords)
        ids = []
        for p in (coords[0], coords[-1]):
            key = (round(p[0] / SNAP_GRID_M), round(p[1] / SNAP_GRID_M))
            idx = node_index.get(key)
            if idx is None:
                idx = len(node_xy)
                node_index[key] = idx
                node_xy.append((p[0], p[1]))
            ids.append(idx)
        a, b = ids
        if a != b:
            edges.append((a, b, float(length)))
    return np.asarray(node_xy, dtype=float), edges, node_index


def attach_points(points, roads, node_index):
    """点投影到最近路网线：返回 (端点a, 端点b, 到a权重, 到b权重, 垂距)。"""
    geoms = list(roads.geometry)
    lengths = list(roads["LENGTH_M"].astype(float))
    tree = STRtree(geoms)
    conns = []
    for pt in points:
        j = tree.nearest(pt)
        line = geoms[j]
        seg_len = line.length
        ratio = 0.0 if seg_len <= 0 else max(0.0, min(1.0, line.project(pt) / seg_len))
        coords = list(line.coords)
        a = node_index[(round(coords[0][0] / SNAP_GRID_M), round(coords[0][1] / SNAP_GRID_M))]
        b = node_index[(round(coords[-1][0] / SNAP_GRID_M), round(coords[-1][1] / SNAP_GRID_M))]
        perp = pt.distance(line.interpolate(line.project(pt)))
        length_attr = lengths[j]
        conns.append((a, b, ratio * length_attr, (1.0 - ratio) * length_attr, perp))
    return conns


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "data" / "od" / "od_matrix.csv"))
    ap.add_argument("--road", default=str(ROOT / "data" / "road" / "road_clean.gpkg"))
    ap.add_argument("--facility", default=str(ROOT / "data" / "clean" / "facility_clean.csv"))
    ap.add_argument("--residential", default=str(ROOT / "data" / "clean" / "residential_clean.csv"))
    args = ap.parse_args()

    t0 = time.time()
    roads = gpd.read_file(args.road).to_crs(32650)
    nodes, edges, node_index = build_network(roads)
    print(f"[1/5] 路网 {len(roads)} 线，{len(nodes)} 节点，{len(edges)} 边", flush=True)

    facilities = pd.read_csv(args.facility, encoding="utf-8")
    residents = pd.read_csv(args.residential, encoding="utf-8")
    fac = gpd.GeoDataFrame(facilities, geometry=gpd.points_from_xy(facilities.LON, facilities.LAT), crs=4326).to_crs(32650)
    res = gpd.GeoDataFrame(residents, geometry=gpd.points_from_xy(residents.LON, residents.LAT), crs=4326).to_crs(32650)
    print(f"[2/5] 设施 {len(fac)}，居住点 {len(res)}", flush=True)

    fac_conn = attach_points(fac.geometry, roads, node_index)
    res_conn = attach_points(res.geometry, roads, node_index)
    print(f"[3/5] 投影完成（{time.time()-t0:.1f}s）", flush=True)

    n = len(nodes)
    fac_offset = n
    res_offset = n + len(fac)
    total = n + len(fac) + len(res)

    rows, cols, data = [], [], []
    for a, b, w in edges:
        rows += [a, b]
        cols += [b, a]
        data += [w, w]
    for i, (a, b, wa, wb, perp) in enumerate(res_conn):
        v = res_offset + i
        rows += [v, v]
        cols += [a, b]
        data += [wa + perp, wb + perp]
    for i, (a, b, wa, wb, perp) in enumerate(fac_conn):
        v = fac_offset + i
        rows += [v, v]
        cols += [a, b]
        data += [wa + perp, wb + perp]
    graph = coo_matrix((data, (rows, cols)), shape=(total, total)).tocsr()
    print(f"[4/5] 图 {total} 节点，{len(data)} 有向边", flush=True)

    fac_codes = fac["FAC_CODE"].astype(str).to_numpy()
    res_codes = res["RES_CODE"].astype(str).to_numpy()
    fac_nodes = np.arange(fac_offset, fac_offset + len(fac))

    out = []
    unreachable = 0
    for i in range(len(res)):
        dist = dijkstra(graph, directed=False, indices=res_offset + i, limit=MAX_METERS)
        d = dist[fac_nodes]
        mask = np.isfinite(d)
        if not mask.any():
            unreachable += 1
            continue
        totals = d[mask]
        keep = totals <= MAX_METERS
        if not keep.any():
            unreachable += 1
            continue
        idxs = np.nonzero(mask)[0][keep]
        mins = np.round(totals[keep] / SPEED_M_PER_MIN, 2)
        for k, m in zip(idxs, mins):
            out.append((fac_codes[k], res_codes[i], float(m)))
        if i and i % 500 == 0:
            print(f"    {i}/{len(res)} 居住点，累计 {len(out)} 行（{time.time()-t0:.1f}s）", flush=True)

    df = pd.DataFrame(out, columns=["facCode", "resCode", "minutes"])
    df.sort_values(["facCode", "resCode"], inplace=True, kind="mergesort")
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.out, index=False, encoding="utf-8", float_format="%.2f")
    print(f"[5/5] 写出 {args.out}：{len(df)} 行；无 15 min 内设施的居住点 {unreachable} 个；"
          f"minutes {df.minutes.min():.2f}–{df.minutes.max():.2f}；耗时 {time.time()-t0:.1f}s", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

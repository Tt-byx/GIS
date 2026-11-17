package com.example.gis.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * API-05 服务区分析响应体（SPEC/03 §7）。几何一律返回 WKT，
 * 覆盖率以最大阈值计算并保留 3 位小数，字段名不得增删。
 */
@Data
public class ServiceAreaResp {

    private String taskId;
    private int elapsedMs;
    private List<Area> areas = new ArrayList<>();
    private Summary summary;
    private List<Uncovered> uncoveredList = new ArrayList<>();

    @Data
    public static class Area {
        private int threshold;
        private String geomWkt;
        private int coveredCommunityCount;
    }

    @Data
    public static class Summary {
        private int totalCommunity;
        private int uncoveredCommunity;
        private double coverageRate;
    }

    @Data
    public static class Uncovered {
        private String resCode;
        private String resName;
        private String streetName;
    }
}

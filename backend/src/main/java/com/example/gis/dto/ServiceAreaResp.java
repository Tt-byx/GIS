package com.example.gis.dto;

import lombok.Data;

import java.util.List;

/**
 * API-05 网络服务区响应。见 SPEC/03 §7。
 */
@Data
public class ServiceAreaResp {

    /** 任务号，格式 SA-yyyyMMdd-四位序号 */
    private String taskId;

    /** 计算耗时（ms） */
    private int elapsedMs;

    /** 每个阈值一条服务区 */
    private List<Area> areas;

    /** 覆盖率汇总 */
    private Summary summary;

    /** 未覆盖小区清单 */
    private List<Uncovered> uncoveredList;

    @Data
    public static class Area {
        /** 阈值（分钟） */
        private int threshold;
        /** 结果几何 WKT（MULTIPOLYGON 或 POLYGON） */
        private String geomWkt;
        /** 覆盖居住小区数 */
        private int coveredCommunityCount;
    }

    @Data
    public static class Summary {
        /** 参与统计的居住小区总数 */
        private int totalCommunity;
        /** 未覆盖数（以最大阈值计） */
        private int uncoveredCommunity;
        /** 覆盖率 1 - uncovered/total，3 位小数 */
        private double coverageRate;
    }

    @Data
    public static class Uncovered {
        private String resCode;
        private String resName;
        private String streetName;
    }
}

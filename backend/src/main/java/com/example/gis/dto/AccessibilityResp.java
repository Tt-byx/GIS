package com.example.gis.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * API-06 可达性分析响应体（SPEC/03-api-contract.md §8）。
 * stats 与 score 保留 4 位小数；breaks 长度固定 6。
 */
@Data
public class AccessibilityResp {

    /** 格式 AC-yyyyMMdd-四位序号。 */
    private String taskId;

    private int elapsedMs;

    private String decay;

    private Stats stats;

    /** 分级断点，长度 6，首末等于 min/max。 */
    private double[] breaks;

    /** 每个参与计算的居住点一条。 */
    private List<Item> results;

    @Data
    public static class Stats {
        private BigDecimal min;
        private BigDecimal max;
        private BigDecimal mean;
        private BigDecimal p50;
        /** S_j 为 null 或 0 时是否用了 1 代替（契约规则 6）。 */
        private boolean capacityFallback;
    }

    @Data
    public static class Item {
        private String unitCode;
        private String unitName;
        private double lon;
        private double lat;
        private BigDecimal score;
        private int level;
    }
}

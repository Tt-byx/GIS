package com.example.gis.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * API-04 分区统计响应体（SPEC/03-api-contract.md §6，映射见 02-data-model.md §6.4）。
 * 注意：指标值的 JSON 名是 value，MUST NOT 用 metricValue（DM 表明确列为易错点）；
 * DECIMAL 必须序列化为 JSON number（DM-21），因此用 BigDecimal 而非 String。
 */
@Data
public class StatDto {

    /** 回显请求层级 district/street。 */
    private String level;

    /** 回显请求指标 count/density/perCapita。 */
    private String metric;

    /** 单位：个 / 个/km² / 个/万人，由 metric 严格映射。 */
    private String unit;

    /** 数据版本 yyyy-MM-dd。 */
    private String dataDate;

    /** 按 unitCode 升序。 */
    private List<Item> list;

    @Data
    public static class Item {
        private String unitCode;
        private String unitName;
        /** 分母为 0 时为 null，MUST NOT 用 0 代替（A-23）。 */
        private BigDecimal value;
        private Integer popTotal;
        private Integer facCount;
    }
}

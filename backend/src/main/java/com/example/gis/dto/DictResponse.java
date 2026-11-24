package com.example.gis.dto;

import lombok.Data;

import java.util.List;

/**
 * API-01 字典响应体（SPEC/03-api-contract.md §3）。
 * 字段名逐字对应契约：categories[].l1/l1Name/color/children[]、
 * children[].l2/l2Name/lifeCircle、districts[].code/name、
 * streets[].code/name/districtCode、tiandituToken、dataDate。
 * MUST NOT 出现数据库原始列名（如 CAT_L1）。
 */
@Data
public class DictResponse {

    /** 设施类别，按 SORT_NO 升序，固定 5 个大类。 */
    private List<Category> categories;

    /** 行政区，固定 3 条。 */
    private List<District> districts;

    /** 街道；字典未灌数据时为空数组，不返回 null。 */
    private List<Street> streets;

    /** 天地图令牌；配置为占位符时返回空字符串。 */
    private String tiandituToken;

    /** 数据版本日期 yyyy-MM-dd。 */
    private String dataDate;

    @Data
    public static class Category {
        private String l1;
        private String l1Name;
        private String color;
        private List<Child> children;
    }

    @Data
    public static class Child {
        private String l2;
        private String l2Name;
        /** 生活圈分钟数；null 表示车行或不适用，序列化时必须保留 null 键。 */
        private Integer lifeCircle;
    }

    @Data
    public static class District {
        private String code;
        private String name;
    }

    @Data
    public static class Street {
        private String code;
        private String name;
        private String districtCode;
    }
}

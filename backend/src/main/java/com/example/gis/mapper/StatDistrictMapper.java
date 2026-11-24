package com.example.gis.mapper;

import lombok.Data;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.math.BigDecimal;
import java.util.List;

/**
 * 分区统计查询。数据全部来自预计算表 STAT_DISTRICT，
 * 本层 MUST NOT 做任何聚合（契约 §6 禁止事项）。
 *
 * 两个查询必须用同一组过滤条件，否则会出现「取到的版本号与行不匹配」。
 */
@Mapper
public interface StatDistrictMapper {

    /**
     * 取该序列的最新数据版本。无数据时返回 null。
     * districtCode 只在 level=street 时由 service 传入，为 null 时不过滤（SQL 里用 IS NULL 短路）。
     */
    @Select("""
            SELECT DATE_FORMAT(MAX(DATA_DATE), '%Y-%m-%d')
              FROM STAT_DISTRICT
             WHERE LEVEL = #{level}
               AND CAT_L1 = #{catL1}
               AND METRIC = #{metric}
               AND (#{districtCode,jdbcType=VARCHAR} IS NULL
                    OR LEFT(UNIT_CODE, 6) = #{districtCode,jdbcType=VARCHAR})
            """)
    String findMaxDataDate(@Param("level") String level,
                           @Param("catL1") String catL1,
                           @Param("metric") String metric,
                           @Param("districtCode") String districtCode);

    /** 按版本取明细行，unitCode 升序（契约规则 4）。 */
    @Select("""
            SELECT UNIT_CODE   AS unitCode,
                   UNIT_NAME   AS unitName,
                   METRIC_VALUE AS value,
                   POP_TOTAL   AS popTotal,
                   FAC_COUNT   AS facCount
              FROM STAT_DISTRICT
             WHERE LEVEL = #{level}
               AND CAT_L1 = #{catL1}
               AND METRIC = #{metric}
               AND DATA_DATE = #{dataDate}
               AND (#{districtCode,jdbcType=VARCHAR} IS NULL
                    OR LEFT(UNIT_CODE, 6) = #{districtCode,jdbcType=VARCHAR})
             ORDER BY UNIT_CODE ASC
            """)
    List<Row> findByVersion(@Param("level") String level,
                            @Param("catL1") String catL1,
                            @Param("metric") String metric,
                            @Param("dataDate") String dataDate,
                            @Param("districtCode") String districtCode);

    @Data
    class Row {
        private String unitCode;
        private String unitName;
        private BigDecimal value;
        private Integer popTotal;
        private Integer facCount;
    }
}

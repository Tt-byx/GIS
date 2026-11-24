package com.example.gis.mapper;

import lombok.Data;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 设施类别字典查询。排序在 SQL 层完成（SORT_NO 升序），
 * 业务层只做分组，不重排，保证规则 API-01-1「MUST NOT 按字母序」。
 */
@Mapper
public interface DictCategoryMapper {

    @Select("""
            SELECT CAT_L1   AS l1,
                   CAT_L2   AS l2,
                   L1_NAME  AS l1Name,
                   L2_NAME  AS l2Name,
                   LIFE_CIRCLE AS lifeCircle,
                   COLOR_HEX AS color,
                   SORT_NO  AS sortNo
              FROM DICT_CATEGORY
             ORDER BY SORT_NO ASC
            """)
    List<Row> findAllOrderBySortNo();

    /** 数据库行投影，仅在 mapper 与 service 之间流转，不对外暴露。 */
    @Data
    class Row {
        private String l1;
        private String l2;
        private String l1Name;
        private String l2Name;
        private Integer lifeCircle;
        private String color;
        private Integer sortNo;
    }
}

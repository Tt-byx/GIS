package com.example.gis.mapper;

import lombok.Data;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 行政区字典查询，按 SORT_NO 升序，契约要求恰好 3 条（青山区/武昌区/汉阳区）。
 */
@Mapper
public interface DictDistrictMapper {

    @Select("""
            SELECT DIST_CODE AS code,
                   DIST_NAME AS name
              FROM DICT_DISTRICT
             ORDER BY SORT_NO ASC
            """)
    List<Row> findAllOrderBySortNo();

    @Data
    class Row {
        private String code;
        private String name;
    }
}

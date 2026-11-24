package com.example.gis.mapper;

import lombok.Data;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 街道字典查询。DICT_STREET 当前可能为空（街道边界数据尚未入库），
 * 此处返回空列表即可，不得因此抛异常，契约允许 streets 为 []。
 */
@Mapper
public interface DictStreetMapper {

    @Select("""
            SELECT STREET_CODE AS code,
                   STREET_NAME AS name,
                   DIST_CODE   AS districtCode
              FROM DICT_STREET
             ORDER BY SORT_NO ASC
            """)
    List<Row> findAllOrderBySortNo();

    @Data
    class Row {
        private String code;
        private String name;
        private String districtCode;
    }
}

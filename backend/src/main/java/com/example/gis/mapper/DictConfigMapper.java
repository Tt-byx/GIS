package com.example.gis.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 系统配置读取。API-01 只取两个键：TIANDITU_TOKEN 与 DATA_DATE。
 * 配置值可能含令牌，禁止在日志中打印返回值。
 */
@Mapper
public interface DictConfigMapper {

    @Select("SELECT CFG_VALUE FROM SYS_CONFIG WHERE CFG_KEY = #{key}")
    String findValue(@Param("key") String key);
}

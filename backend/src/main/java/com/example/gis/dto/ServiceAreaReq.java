package com.example.gis.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/**
 * API-05 服务区分析请求体（SPEC/03 §7）。字段名必须与契约一致，不得增删。
 * 阈值取值范围与去重排序在 Service 层校验，越界返回 1002。
 */
@Data
public class ServiceAreaReq {

    @NotBlank
    private String categoryL2;

    @NotBlank
    private String travelMode;

    @NotEmpty
    private List<Integer> thresholds;

    private String districtCode;

    private Boolean dissolve = Boolean.TRUE;
}

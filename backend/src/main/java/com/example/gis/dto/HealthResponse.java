package com.example.gis.dto;

import lombok.Data;

/**
 * API-08 健康检查响应体（SPEC/03 §10）。status 由三个组件状态按规则推导，
 * 不暴露连接串、文件路径等敏感信息。
 */
@Data
public class HealthResponse {

    private String status;
    private Components components;
    private String version;

    @Data
    public static class Components {
        private String mysql;
        private String igs;
        private String odMatrix;
    }
}

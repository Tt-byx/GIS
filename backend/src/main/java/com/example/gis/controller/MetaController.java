package com.example.gis.controller;

import com.example.gis.common.R;
import com.example.gis.dto.HealthResponse;
import com.example.gis.service.HealthService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 元信息接口：API-08 健康检查。Controller 只做参数校验与包装，不含业务判断。
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class MetaController {

    private final HealthService healthService;

    @GetMapping("/health")
    public R<HealthResponse> health() {
        return R.ok(healthService.check());
    }
}

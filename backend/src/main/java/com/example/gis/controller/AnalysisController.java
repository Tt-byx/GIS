package com.example.gis.controller;

import com.example.gis.common.R;
import com.example.gis.dto.ServiceAreaReq;
import com.example.gis.dto.ServiceAreaResp;
import com.example.gis.service.ServiceAreaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 分析接口：API-05 网络服务区。Controller 只做参数校验与包装。
 */
@RestController
@RequestMapping("/api/v1/analysis")
@RequiredArgsConstructor
public class AnalysisController {

    private final ServiceAreaService serviceAreaService;

    @PostMapping("/service-area")
    public R<ServiceAreaResp> serviceArea(@Valid @RequestBody ServiceAreaReq request) {
        return R.ok(serviceAreaService.analyze(request));
    }
}

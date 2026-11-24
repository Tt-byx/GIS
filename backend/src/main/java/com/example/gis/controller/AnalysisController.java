package com.example.gis.controller;

import com.example.gis.common.R;
import com.example.gis.dto.AccessibilityReq;
import com.example.gis.dto.AccessibilityResp;
import com.example.gis.service.AccessibilityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 分析接口。当前实现 API-06 可达性（T-029）；
 * API-05 网络服务区（T-028）由 R6 在本类中追加 serviceArea 方法。
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AnalysisController {

    private final AccessibilityService accessibilityService;

    /** API-06：阈值只允许 5/10/15，枚举校验在 service（非法返回 1002）。 */
    @PostMapping("/analysis/accessibility")
    public R<AccessibilityResp> accessibility(@Valid @RequestBody AccessibilityReq req) {
        return R.ok(accessibilityService.analyze(req));
    }
}

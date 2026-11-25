package com.example.gis.controller;

import com.example.gis.common.R;
import com.example.gis.dto.AccessibilityReq;
import com.example.gis.dto.AccessibilityResp;
import com.example.gis.dto.ServiceAreaReq;
import com.example.gis.dto.ServiceAreaResp;
import com.example.gis.service.AccessibilityService;
import com.example.gis.service.ServiceAreaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 分析接口。
 * <ul>
 *   <li>API-05 网络服务区 — T-028，IGServer 网络分析依赖（当前抛 2002）</li>
 *   <li>API-06 可达性 2SFCA — T-029，已实现</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AnalysisController {

    private final AccessibilityService accessibilityService;
    private final ServiceAreaService serviceAreaService;

    /** API-06：阈值只允许 5/10/15，枚举校验在 service（非法返回 1002）。 */
    @PostMapping("/analysis/accessibility")
    public R<AccessibilityResp> accessibility(@Valid @RequestBody AccessibilityReq req) {
        return R.ok(accessibilityService.analyze(req));
    }

    /**
     * API-05 网络服务区分析。
     * 规则 SPEC/03 §7：
     * <ul>
     *   <li>MUST NOT 用缓冲区代替服务区</li>
     *   <li>MUST NOT 在前端计算覆盖率</li>
     *   <li>当前 IGServer 网络分析功能服务未发布 → 统一抛 DATA_NOT_READY(2002)</li>
     * </ul>
     */
    @PostMapping("/analysis/service-area")
    public R<ServiceAreaResp> serviceArea(@Valid @RequestBody ServiceAreaReq req) {
        return R.ok(serviceAreaService.analyze(req));
    }
}

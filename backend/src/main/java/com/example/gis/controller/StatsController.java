package com.example.gis.controller;

import com.example.gis.common.R;
import com.example.gis.dto.StatDto;
import com.example.gis.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 统计接口：API-04 分区统计。
 * Controller 只做参数接收与包装，枚举校验与数据版本选择在 service。
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;

    /**
     * API-04：level 必填（缺失由 Spring 抛 MissingServletRequestParameterException → 1001），
     * categoryL1 默认 ALL，metric 默认 count，districtCode 仅 level=street 时生效。
     */
    @GetMapping("/statistics/district")
    public R<StatDto> districtStats(
            @RequestParam("level") String level,
            @RequestParam(value = "categoryL1", required = false) String categoryL1,
            @RequestParam(value = "metric", required = false) String metric,
            @RequestParam(value = "districtCode", required = false) String districtCode) {
        return R.ok(statsService.query(level, categoryL1, metric, districtCode));
    }
}

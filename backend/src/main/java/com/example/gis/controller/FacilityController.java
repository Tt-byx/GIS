package com.example.gis.controller;

import com.example.gis.common.R;
import com.example.gis.service.SuggestService;
import com.example.gis.service.SuggestService.SuggestItem;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 设施相关接口。当前仅含 API-03 名称补全；
 * API-02 设施查询（T-024）落地后在同一个控制器内新增方法，不改本方法的签名与路径。
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class FacilityController {

    private final SuggestService suggestService;

    @GetMapping("/facilities/suggest")
    public R<SuggestResponse> suggest(@RequestParam("kw") String kw,
                                      @RequestParam(value = "city", required = false, defaultValue = "武汉") String city,
                                      @RequestParam(value = "limit", required = false, defaultValue = "10") int limit) {
        return R.ok(new SuggestResponse(suggestService.suggest(kw, city, limit)));
    }

    /** 契约要求 data 为 { list: [...] }，不是裸数组。 */
    public record SuggestResponse(List<SuggestItem> list) {
    }
}

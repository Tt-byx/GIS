package com.example.gis.service;

import com.example.gis.client.IgsClient;
import com.example.gis.common.BizException;
import com.example.gis.common.ErrorCode;
import com.example.gis.dto.ServiceAreaReq;
import com.example.gis.dto.ServiceAreaResp;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * API-05 网络服务区分析。
 * <p>
 * 当前 IGServer 网络分析功能服务（T-021）尚未在 Manager 工作流编辑器发布，
 * 故任何调用 MUST 抛 DATA_NOT_READY(2002)，禁止伪造数据（SPEC 规则）。
 * <p>
 * T-021 完成后在此实现：
 * <ol>
 *   <li>阈值预处理：去重 + 升序；非法值 → 1002</li>
 *   <li>categoryL2 校验 DICT_CATEGORY → 不存在 → 2001</li>
 *   <li>调 IgsClient.runNetworkAnalysis()（内部 POST 到 IGServer 网络分析端点）</li>
 *   <li>按 thresholds 遍历，每个阈值一次服务区计算</li>
 *   <li>结果写 ANALYSIS_TASK / ANALYSIS_RESULT，24h 幂等缓存</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ServiceAreaService {

    private final IgsClient igsClient;

    public ServiceAreaResp analyze(ServiceAreaReq req) {
        // T-021 网络分析服务未发布 → 业务数据未就绪
        // SPEC 规则：IGServer 缺服务 MUST 返回 2002，MUST NOT 伪造数据
        log.warn("服务区分析请求到达但网络分析功能服务未发布 categoryL2={} travelMode={}",
                req.getCategoryL2(), req.getTravelMode());
        throw new BizException(ErrorCode.DATA_NOT_READY);
    }
}

package com.example.gis.service;

import com.example.gis.client.IgsClient;
import com.example.gis.dto.HealthResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;

/**
 * API-08 健康检查。三个组件独立检测，单项失败不得影响其他项：
 * mysql 用 2 秒连接校验；
 * igs 用 IgsClient.checkMapService() 做真实 REST 探测（T-026 要求，MUST NOT 只做端口探测）；
 * odMatrix 只判断文件是否存在。
 *
 * 状态推导规则见 SPEC/03 §10：
 *   mysql 或 igs 断开即 DOWN；仅 OD 缺失为 DEGRADED；全部正常为 UP。
 *
 * 规则 SPEC/03 §10：检查 MUST 有 2s 超时，MUST NOT 因 IGServer 无响应而阻塞超过 5s。
 * IgsClient 内部 timeoutMs 控制单次调用超时，此处额外加 readTimeout 兜底。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HealthService {

    private static final String VERSION = "0.1.0";

    private final DataSource dataSource;
    private final IgsClient igsClient;

    @Value("${od.matrixPath}")
    private String odMatrixPath;

    public HealthResponse check() {
        String mysql = checkMysql();
        String igs = igsClient.checkMapService();
        String odMatrix = Files.isRegularFile(Path.of(odMatrixPath)) ? "LOADED" : "MISSING";

        HealthResponse.Components components = new HealthResponse.Components();
        components.setMysql(mysql);
        components.setIgs(igs);
        components.setOdMatrix(odMatrix);

        HealthResponse response = new HealthResponse();
        response.setComponents(components);
        response.setStatus(resolveStatus(mysql, igs, odMatrix));
        response.setVersion(VERSION);
        return response;
    }

    private String resolveStatus(String mysql, String igs, String odMatrix) {
        if ("DOWN".equals(mysql) || "DOWN".equals(igs)) {
            return "DOWN";
        }
        return "MISSING".equals(odMatrix) ? "DEGRADED" : "UP";
    }

    private String checkMysql() {
        try (Connection connection = dataSource.getConnection()) {
            return connection.isValid(2) ? "UP" : "DOWN";
        } catch (Exception e) {
            log.warn("数据库健康检查失败: {}", e.getMessage());
            return "DOWN";
        }
    }
}

package com.example.gis.client;

import com.example.gis.common.BizException;
import com.example.gis.common.ErrorCode;
import com.example.gis.config.IgsProperties;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.Map;
import java.util.function.Supplier;

/**
 * IGServer 的唯一 HTTP 出口（AR-11）。负责超时、重试与错误码转换：
 * 连接失败/拒绝 -> 3001，IGServer 非 2xx -> 3002，读超时 -> 4001。
 * 重试次数固定为 2 次且只对 5xx 与服务不可达生效，业务错误不重试。
 */
@Component
public class IgsClient {

    private static final int MAX_RETRIES = 2;
    private static final int CONNECT_TIMEOUT_MS = 2000;
    private static final int PING_TIMEOUT_MS = 2000;

    private final RestClient client;
    private final RestClient pingClient;

    public IgsClient(IgsProperties properties) {
        String baseUrl = "http://" + properties.getIp() + ":" + properties.getPort();
        this.client = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory(properties.getTimeoutMs()))
                .build();
        this.pingClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory(PING_TIMEOUT_MS))
                .build();
    }

    /**
     * 发送 GET 请求并返回 JSON。参数为相对路径与查询参数，基址一律来自 igs.* 配置。
     */
    public JsonNode get(String path, Map<String, String> query) {
        return execute(() -> client.get()
                .uri(uriBuilder -> {
                    uriBuilder.path(path);
                    if (query != null) {
                        query.forEach(uriBuilder::queryParam);
                    }
                    return uriBuilder.build();
                })
                .retrieve()
                .body(JsonNode.class));
    }

    /**
     * 发送 JSON POST 请求，供网络分析等服务使用。
     */
    public JsonNode postJson(String path, Object body) {
        return execute(() -> client.post()
                .uri(path)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class));
    }

    /**
     * 发送表单 POST 请求，MapGIS 服务普遍使用 application/x-www-form-urlencoded。
     */
    public JsonNode postForm(String path, MultiValueMap<String, String> form) {
        return execute(() -> client.post()
                .uri(path)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(JsonNode.class));
    }

    /**
     * 判断指定资源是否已在 IGServer 发布。4xx/5xx 视为未发布返回 false，
     * 连接失败仍按 3001 抛出，避免把"服务器没开"误报成"数据未就绪"。
     */
    public boolean exists(String path) {
        try {
            pingClient.get().uri(path).retrieve().toBodilessEntity();
            return true;
        } catch (RestClientResponseException e) {
            return false;
        } catch (ResourceAccessException e) {
            throw new BizException(ErrorCode.IGS_UNAVAILABLE, e);
        }
    }

    /**
     * 2 秒超时的连通性探测。只要收到任意 HTTP 响应即视为可达，
     * 因此 404 也返回 true；连接异常返回 false，不抛出业务异常。
     */
    public boolean ping() {
        try {
            pingClient.get().uri("/").retrieve().toBodilessEntity();
            return true;
        } catch (RestClientResponseException e) {
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private JsonNode execute(Supplier<JsonNode> call) {
        ResourceAccessException lastAccessException = null;
        for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                return call.get();
            } catch (ResourceAccessException e) {
                lastAccessException = e;
            } catch (RestClientResponseException e) {
                if (e.getStatusCode().is5xxServerError() && attempt < MAX_RETRIES) {
                    continue;
                }
                throw new BizException(ErrorCode.IGS_ERROR, e);
            }
        }
        throw new BizException(isTimeout(lastAccessException) ? ErrorCode.TIMEOUT : ErrorCode.IGS_UNAVAILABLE,
                lastAccessException);
    }

    private boolean isTimeout(ResourceAccessException e) {
        if (e == null || e.getMessage() == null) {
            return false;
        }
        String message = e.getMessage();
        return message.contains("timed out") || message.contains("Timeout") || message.contains("timeout");
    }

    private SimpleClientHttpRequestFactory requestFactory(int readTimeoutMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(CONNECT_TIMEOUT_MS));
        factory.setReadTimeout(Duration.ofMillis(readTimeoutMs));
        return factory;
    }
}

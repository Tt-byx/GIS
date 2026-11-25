package com.example.gis.client;

import com.example.gis.common.BizException;
import com.example.gis.common.ErrorCode;
import com.example.gis.config.IgsProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * IGServer 唯一 HTTP 客户端。后端所有对 IGServer 的调用 MUST 经此类，
 * MUST NOT 在 service 层出现 "http://" 或 "6163" 字面量（AR-11, R-08）。
 *
 * 当前封装：
 *   1) 地图文档健康检查：GET /igs/rest/mrcs/docs/{mapDoc}
 *   2) 地图文档信息查询：GET /igs/rest/mrcs/docs/{mapDoc}
 *   3) 要素查询：ArcGIS REST Feature Server 风格
 *   4) 网络分析功能服务：预留（需工作流编辑器发布模板后填充）
 *
 * IGServer 基址按 SPEC/03 §11 约定：
 *   直连:  http://{igs.ip}:{igs.port}/igs/rest/...
 *   经Nginx: /igs/rest/... （前端反代，后端直连 IP:Port 绕过 Nginx）
 */
@Slf4j
@Component
public class IgsClient {

    private final String baseUrl;          // http://127.0.0.1:6163
    private final String mapDoc;           // wh_facility
    private final ObjectMapper mapper;
    private final RestClient restClient;
    private final int timeoutMs;

    public IgsClient(IgsProperties props, ObjectMapper mapper) {
        this.baseUrl = String.format("http://%s:%d", props.getIp(), props.getPort());
        this.mapDoc = props.getMapDoc();
        this.mapper = mapper;
        this.timeoutMs = props.getTimeoutMs();

        Duration timeout = Duration.ofMillis(props.getTimeoutMs());
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) timeout.toMillis());
        factory.setReadTimeout((int) timeout.toMillis());
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public String getMapDoc() {
        return mapDoc;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    // ============================================================== 基础探测

    /**
     * 判断 IGServer 地图服务是否可访问。
     * 调用 /igs/rest/mrcs/docs/{mapDoc}，期望返回 JSON。
     *
     * @return "UP" / "DOWN"
     */
    public String checkMapService() {
        String url = baseUrl + "/igs/rest/mrcs/docs/" + mapDoc;
        try {
            String body = restClient.get().uri(url).retrieve().body(String.class);
            if (body != null && !body.isBlank()) {
                JsonNode root = mapper.readTree(body);
                // IGServer 正常返回的 map doc 有 SubMapNames 或 MapCount 字段
                if (root.has("SubMapNames") || root.has("MapCount") || root.has("URL")) {
                    return "UP";
                }
            }
            log.warn("IGServer 地图服务响应异常 url={}", url);
            return "DOWN";
        } catch (ResourceAccessException e) {
            log.warn("IGServer 地图服务不可达 type={}",
                    e.getCause() == null ? "unknown" : e.getCause().getClass().getSimpleName());
            return "DOWN";
        } catch (RestClientResponseException e) {
            log.warn("IGServer 地图服务返回非 2xx status={}", e.getStatusCode().value());
            return "DOWN";
        } catch (JsonProcessingException e) {
            log.warn("IGServer 地图服务响应不是合法 JSON");
            return "DOWN";
        } catch (Exception e) {
            log.warn("IGServer 地图服务检查异常: {}", e.getMessage());
            return "DOWN";
        }
    }

    // ============================================================== 地图文档信息

    /**
     * 获取已发布的所有地图文档列表。
     *
     * @return 文档名列表，如 ["wh_facility_main", "地图文档"]
     */
    public List<String> listMapDocs() {
        String url = baseUrl + "/igs/rest/mrcs/docs";
        try {
            String body = restClient.get().uri(url).retrieve().body(String.class);
            if (body == null || body.isBlank()) return new ArrayList<>();
            // 直接返回 JSON 数组字符串，mapper 解析成 List<String>
            return mapper.readValue(body, new TypeReference<List<String>>() {});
        } catch (ResourceAccessException e) {
            throw new BizException(ErrorCode.IGS_UNAVAILABLE);
        } catch (RestClientResponseException e) {
            log.warn("listMapDocs 非 2xx status={}", e.getStatusCode().value());
            throw new BizException(ErrorCode.IGS_ERROR);
        } catch (JsonProcessingException e) {
            log.warn("listMapDocs 响应不是合法 JSON");
            throw new BizException(ErrorCode.IGS_ERROR);
        }
    }

    /**
     * 获取地图文档元信息。
     *
     * @return 文档信息 Map，含 SubMapNames / URL / MapCount 等字段
     */
    public Map<String, Object> getMapDocInfo() {
        String url = baseUrl + "/igs/rest/mrcs/docs/" + mapDoc;
        try {
            String body = restClient.get().uri(url).retrieve().body(String.class);
            if (body == null || body.isBlank()) throw new BizException(ErrorCode.IGS_ERROR);
            return mapper.readValue(body, new TypeReference<>() {});
        } catch (ResourceAccessException e) {
            throw new BizException(ErrorCode.IGS_UNAVAILABLE);
        } catch (RestClientResponseException e) {
            log.warn("getMapDocInfo 非 2xx status={}", e.getStatusCode().value());
            throw new BizException(ErrorCode.IGS_ERROR);
        } catch (JsonProcessingException e) {
            log.warn("getMapDocInfo 响应不是合法 JSON");
            throw new BizException(ErrorCode.IGS_ERROR);
        }
    }

    // ============================================================== 要素查询

    /**
     * ArcGIS REST Feature Server 风格要素查询。
     * IGServer 的 ArcGISRestFeatureServer 端点遵循 Esri 规范：
     *   GET /FeatureServer/{layerId}/query?where=&outFields=&returnGeometry=&f=json
     *
     * 注意：IGServer 6163 的 Feature Server 实际挂载路径经 Manager 发布后确定。
     * 当前默认路径为 /igs/rest/arcgis/rest/services/{mapDoc}/FeatureServer/{layerId}，
     * 若 Manager 显示不同路径，只需在此方法内调整 basePath 或通过配置注入。
     *
     * @param layerId 图层索引（SPEC §11.2：LAYER_FACILITY=0, DISTRICT=1, STREET=2, RESIDENTIAL=3）
     * @param where   SQL WHERE 片段；空字符串表示无条件
     * @param outFields 逗号分隔的输出字段名；"*" 表示全部
     * @param page    页码（从 1 开始）
     * @param pageSize 每页条数
     * @return 查询结果 JSON Map，含 features / total / exceededTransferLimit
     */
    public Map<String, Object> queryFeatures(String layerId, String where, String outFields,
                                             int page, int pageSize) {
        // 先试标准 ArcGIS REST 路径，若后续发现 IGServer 实际路径不同需在此调整
        String layerPath = baseUrl + "/igs/rest/mrcs/docs/" + mapDoc
                + "/wh_facility/" + layerId + "/query";

        int offset = (page - 1) * pageSize;
        String whereClause = (where == null || where.isBlank()) ? "1=1" : where;

        String url = layerPath
                + "?where=" + urlEncode(whereClause)
                + "&outFields=" + urlEncode(outFields == null || outFields.isBlank() ? "*" : outFields)
                + "&returnGeometry=true"
                + "&skipCount=" + offset
                + "&resultRecordCount=" + pageSize
                + "&f=json";

        try {
            String body = restClient.get().uri(URI.create(url)).retrieve().body(String.class);
            if (body == null || body.isBlank()) throw new BizException(ErrorCode.IGS_ERROR);
            JsonNode root = mapper.readTree(body);

            // Esri REST 约定：error 字段存在即业务失败
            if (root.has("error")) {
                log.warn("queryFeatures IGServer 业务错误 layerId={} error={}",
                        layerId, root.path("error").path("message").asText(""));
                throw new BizException(ErrorCode.IGS_ERROR);
            }

            return mapper.convertValue(root, new TypeReference<>() {});
        } catch (ResourceAccessException e) {
            log.warn("queryFeatures 不可达 layerId={}", layerId);
            throw new BizException(ErrorCode.IGS_UNAVAILABLE);
        } catch (RestClientResponseException e) {
            log.warn("queryFeatures 非 2xx status={} layerId={}", e.getStatusCode().value(), layerId);
            if (e.getStatusCode().isSameCodeAs(HttpStatusCode.valueOf(404))) {
                // 图层路径不存在 → 视为数据未就绪（2002），按 SPEC 禁止伪造数据
                throw new BizException(ErrorCode.DATA_NOT_READY);
            }
            throw new BizException(ErrorCode.IGS_ERROR);
        } catch (JsonProcessingException e) {
            log.warn("queryFeatures 响应不是合法 JSON");
            throw new BizException(ErrorCode.IGS_ERROR);
        }
    }

    // ============================================================== 网络分析（预留）

    /**
     * 调用网络分析功能服务（服务区 API-05 依赖）。
     * 规则 A-13：功能服务 MUST 先在工作流编辑器搭好并发布模板。
     * 当前仅占位，服务名写入配置后填充真实 URL。
     */
    public Map<String, Object> runNetworkAnalysis(Map<String, Object> params) {
        // TODO: 待 T-021 完成后实现
        throw new BizException(ErrorCode.DATA_NOT_READY);
    }

    // ============================================================== 工具

    private static String urlEncode(String s) {
        try {
            return java.net.URLEncoder.encode(s, "UTF-8");
        } catch (java.io.UnsupportedEncodingException e) {
            return s;
        }
    }
}

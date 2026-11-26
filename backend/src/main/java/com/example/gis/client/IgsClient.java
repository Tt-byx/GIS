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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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

    /** 失败重试上限：最多重试 2 次（含首次共 3 次尝试），T-022 DoD。 */
    private static final int MAX_RETRIES = 2;
    /** 重试间隔（毫秒），避免瞬时故障时连续打爆 IGServer。 */
    private static final long RETRY_BACKOFF_MS = 100L;

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
            // 健康检查刻意不做重试：SPEC 要求整个 /health 5 秒内返回，
            // 重试会把延迟放大到 3 倍，失去"快速失败"的意义。
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
            String body = getBodyWithRetry(url);
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
            String body = getBodyWithRetry(url);
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
            String body = getBodyWithRetry(url);
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
     *
     * @deprecated 用 {@link #runServiceArea(int, String, String, double)}，本方法仅为兼容保留
     */
    @Deprecated
    public Map<String, Object> runNetworkAnalysis(Map<String, Object> params) {
        throw new BizException(ErrorCode.DATA_NOT_READY);
    }

    /**
     * 执行"服务区分析"功能服务（工作流），返回服务区几何 WKT。
     *
     * <p>通道：IGServer {@code FunctionWareService}（Config.xml 中 PrefixPath =
     * {@code igs/rest/mrfws}），不是 Manager 9999 —— 后端不应持有管理端登录态。
     *
     * <p>错误映射（SPEC/03 §7 错误情形）：
     * <ul>
     *   <li>工作流报"打开网络类失败" → {@link ErrorCode#DATA_NOT_READY}(2002)，路网未发布</li>
     *   <li>工作流其它异常 / 无几何返回 → {@link ErrorCode#IGS_ERROR}(3002)</li>
     *   <li>IGServer 不可达 → {@link ErrorCode#IGS_UNAVAILABLE}(3001)</li>
     * </ul>
     *
     * @param flowNo           功能服务流程号，服务区分析固定 600366
     * @param netClsUrl        网络类 gdbp 地址
     * @param centerPointsJson 中心点 JSON，如 {@code [{"x":114.28,"y":30.57,"capacity":300}]}
     * @param nearDis          搜索半径（网络单位，km）
     * @return 服务区几何 WKT（POLYGON / MULTIPOLYGON）
     */
    public String runServiceArea(int flowNo, String netClsUrl, String centerPointsJson, double nearDis) {
        String url = baseUrl + "/igs/rest/mrfws/execute/" + flowNo
                + "?netClsUrl=" + urlEncode(netClsUrl)
                + "&centerPointsJsonInfo=" + urlEncode(centerPointsJson)
                + "&nearDis=" + nearDis
                + "&compress=false&compressionRatio=1";
        String body;
        try {
            body = getBodyWithRetry(url);
        } catch (ResourceAccessException e) {
            throw new BizException(ErrorCode.IGS_UNAVAILABLE);
        } catch (RestClientResponseException e) {
            log.warn("服务区分析功能服务返回 HTTP {} flowNo={}", e.getStatusCode().value(), flowNo);
            throw new BizException(ErrorCode.IGS_ERROR);
        }
        if (body == null || body.isBlank()) {
            throw new BizException(ErrorCode.IGS_ERROR);
        }

        String error = firstErrorDescription(body);
        if (error != null) {
            log.warn("服务区分析功能服务返回异常 flowNo={}: {}", flowNo, error);
            if (error.contains("打开网络类") || error.contains("网络类")) {
                throw new BizException(ErrorCode.DATA_NOT_READY);
            }
            throw new BizException(ErrorCode.IGS_ERROR);
        }

        String wkt = firstWkt(body);
        if (wkt == null) {
            // SPEC 禁止：返回空 geomWkt 却标记成功
            log.warn("服务区分析未返回几何 flowNo={}", flowNo);
            throw new BizException(ErrorCode.IGS_ERROR);
        }
        return wkt;
    }

    /** 取 FlowResult 中第一个非空 ErrDescription。 */
    private static String firstErrorDescription(String xml) {
        Matcher matcher = Pattern.compile("<(?:[A-Za-z0-9]+:)?ErrDescription>([^<]*)</").matcher(xml);
        while (matcher.find()) {
            String value = matcher.group(1).trim();
            if (!value.isEmpty()) {
                return value;
            }
        }
        return null;
    }

    /** 取响应中第一个 POLYGON / MULTIPOLYGON WKT。 */
    private static String firstWkt(String xml) {
        Matcher matcher = Pattern.compile("((?:MULTI)?POLYGON\\s*\\(\\(.*?\\)\\))", Pattern.DOTALL).matcher(xml);
        return matcher.find() ? matcher.group(1) : null;
    }

    // ============================================================== 重试策略

    /**
     * 带重试的 GET，最多重试 {@link #MAX_RETRIES} 次（含首次共 3 次尝试）。
     *
     * <p>可重试：连接/读超时（{@link ResourceAccessException}）、HTTP 5xx —— 属瞬时故障。
     * <p>不重试：4xx —— 参数或路径错误，重试无意义；且 404 需原样上抛映射成
     * {@link ErrorCode#DATA_NOT_READY}，不能被重试吞掉。
     *
     * @return 响应体（可能为 null，由调用方决定如何处理空体）
     */
    private String getBodyWithRetry(String url) {
        URI uri = URI.create(url);
        for (int attempt = 0; ; attempt++) {
            try {
                return restClient.get().uri(uri).retrieve().body(String.class);
            } catch (ResourceAccessException e) {
                if (attempt >= MAX_RETRIES) throw e;
                log.warn("IGServer 请求不可达，重试 {}/{} url={}", attempt + 1, MAX_RETRIES, url);
                backoff();
            } catch (RestClientResponseException e) {
                if (!e.getStatusCode().is5xxServerError() || attempt >= MAX_RETRIES) throw e;
                log.warn("IGServer 返回 {}，重试 {}/{} url={}",
                        e.getStatusCode().value(), attempt + 1, MAX_RETRIES, url);
                backoff();
            }
        }
    }

    private static void backoff() {
        try {
            Thread.sleep(RETRY_BACKOFF_MS);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
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

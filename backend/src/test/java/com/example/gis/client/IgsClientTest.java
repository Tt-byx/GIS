package com.example.gis.client;

import com.example.gis.common.BizException;
import com.example.gis.common.ErrorCode;
import com.example.gis.config.IgsProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * T-022 IgsClient 单元测试。
 *
 * 覆盖 SPEC/04 §5.2 与 T-022 DoD 的三项能力：
 *   1) 超时设置 —— 读超时触发时按 {@link ErrorCode#IGS_UNAVAILABLE} 抛出
 *   2) 错误码转换 —— 不可达/非 2xx/非法 JSON/业务 error 分别映射到对应 ErrorCode
 *   3) 端点契约 —— 请求 URL 必须落在 /igs/rest/mrcs/docs/{mapDoc} 之下
 *
 * 说明：使用 JDK 内置 com.sun.net.httpserver 起真实 HTTP 服务，
 * 不新增第三方依赖（MockWebServer 需额外引入 okhttp），
 * 这样测试同时验证了 RestClient 的实际请求构造与异常包装。
 */
@DisplayName("T-022 IgsClient")
class IgsClientTest {

    private static final String MAP_DOC = "wh_facility_main";

    private HttpServer server;
    private final ObjectMapper mapper = new ObjectMapper();

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
            server = null;
        }
    }

    // ============================================================ 测试脚手架

    /** 起一个真实 HTTP 服务，并把 IgsClient 指向它。 */
    private IgsClient startServer(HttpHandler handler) throws IOException {
        return startServer(handler, 800);
    }

    private IgsClient startServer(HttpHandler handler, int timeoutMs) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", handler);
        server.start();
        return newClient(server.getAddress().getPort(), timeoutMs);
    }

    private IgsClient newClient(int port, int timeoutMs) {
        IgsProperties props = new IgsProperties();
        props.setIp("127.0.0.1");
        props.setPort(port);
        props.setMapDoc(MAP_DOC);
        props.setTimeoutMs(timeoutMs);
        return new IgsClient(props, mapper);
    }

    private static void respond(HttpExchange ex, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json;charset=UTF-8");
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static final String MAP_DOC_OK =
            "{\"SubMapNames\":[\"wh_facility\"],\"MapCount\":\"1\","
                    + "\"URL\":\"c:\\\\data\\\\wh_facility.mapx\"}";

    // ============================================================ 1. 地图服务探测

    @Nested
    @DisplayName("checkMapService")
    class CheckMapService {

        @Test
        @DisplayName("返回含 SubMapNames 的合法 JSON 时判定 UP")
        void shouldReturnUpWhenValidMapDocJson() throws IOException {
            AtomicReference<String> path = new AtomicReference<>();
            IgsClient client = startServer(ex -> {
                path.set(ex.getRequestURI().getPath());
                respond(ex, 200, MAP_DOC_OK);
            });

            assertThat(client.checkMapService()).isEqualTo("UP");
            // 端点契约：必须落在 /igs/rest/mrcs/docs/{mapDoc}
            assertThat(path.get()).isEqualTo("/igs/rest/mrcs/docs/" + MAP_DOC);
        }

        @Test
        @DisplayName("只有 MapCount 或 URL 字段时同样判定 UP")
        void shouldReturnUpWhenAlternateFields() throws IOException {
            IgsClient client = startServer(ex -> respond(ex, 200, "{\"MapCount\":\"1\"}"));
            assertThat(client.checkMapService()).isEqualTo("UP");
        }

        @Test
        @DisplayName("非 2xx 判定 DOWN，且不抛异常（健康检查不能整页 500）")
        void shouldReturnDownOnNon2xx() throws IOException {
            IgsClient client = startServer(ex -> respond(ex, 500, "{\"error\":\"boom\"}"));
            assertThat(client.checkMapService()).isEqualTo("DOWN");
        }

        @Test
        @DisplayName("JSON 缺少已知字段时判定 DOWN")
        void shouldReturnDownWhenUnknownJsonShape() throws IOException {
            IgsClient client = startServer(ex -> respond(ex, 200, "{\"foo\":1}"));
            assertThat(client.checkMapService()).isEqualTo("DOWN");
        }

        @Test
        @DisplayName("响应不是合法 JSON 时判定 DOWN")
        void shouldReturnDownWhenNotJson() throws IOException {
            IgsClient client = startServer(ex -> respond(ex, 200, "<html>oops</html>"));
            assertThat(client.checkMapService()).isEqualTo("DOWN");
        }

        @Test
        @DisplayName("服务不可达时判定 DOWN")
        void shouldReturnDownWhenUnreachable() {
            IgsClient client = newClient(1, 500);
            assertThat(client.checkMapService()).isEqualTo("DOWN");
        }

        @Test
        @DisplayName("读超时判定 DOWN（超时设置生效）")
        void shouldReturnDownOnReadTimeout() throws Exception {
            CountDownLatch release = new CountDownLatch(1);
            IgsClient client = startServer(ex -> {
                try {
                    release.await(3, TimeUnit.SECONDS);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
                respond(ex, 200, MAP_DOC_OK);
            }, 300);

            try {
                assertThat(client.checkMapService()).isEqualTo("DOWN");
            } finally {
                release.countDown();
            }
        }
    }

    // ============================================================ 2. 地图文档列表

    @Nested
    @DisplayName("listMapDocs")
    class ListMapDocs {

        @Test
        @DisplayName("200 时返回文档名数组，且命中 /igs/rest/mrcs/docs")
        void shouldReturnDocNames() throws IOException {
            AtomicReference<String> path = new AtomicReference<>();
            IgsClient client = startServer(ex -> {
                path.set(ex.getRequestURI().getPath());
                respond(ex, 200, "[\"wh_facility_main\"]");
            });

            List<String> docs = client.listMapDocs();

            assertThat(docs).containsExactly("wh_facility_main");
            assertThat(path.get()).isEqualTo("/igs/rest/mrcs/docs");
        }

        @Test
        @DisplayName("空响应体返回空列表（不抛异常）")
        void shouldReturnEmptyOnBlankBody() throws IOException {
            IgsClient client = startServer(ex -> {
                ex.sendResponseHeaders(200, -1);
                ex.close();
            });
            assertThat(client.listMapDocs()).isEmpty();
        }

        @Test
        @DisplayName("服务不可达映射为 IGS_UNAVAILABLE")
        void shouldThrowUnavailableWhenUnreachable() {
            IgsClient client = newClient(1, 500);

            assertThatThrownBy(client::listMapDocs)
                    .isInstanceOf(BizException.class)
                    .satisfies(e -> assertThat(((BizException) e).getErrorCode())
                            .isEqualTo(ErrorCode.IGS_UNAVAILABLE));
        }

        @Test
        @DisplayName("非 2xx 映射为 IGS_ERROR")
        void shouldThrowIgsErrorOnNon2xx() throws IOException {
            IgsClient client = startServer(ex -> respond(ex, 500, "{}"));

            assertThatThrownBy(client::listMapDocs)
                    .isInstanceOf(BizException.class)
                    .satisfies(e -> assertThat(((BizException) e).getErrorCode())
                            .isEqualTo(ErrorCode.IGS_ERROR));
        }

        @Test
        @DisplayName("响应不是合法 JSON 映射为 IGS_ERROR")
        void shouldThrowIgsErrorOnInvalidJson() throws IOException {
            IgsClient client = startServer(ex -> respond(ex, 200, "not-json"));

            assertThatThrownBy(client::listMapDocs)
                    .isInstanceOf(BizException.class)
                    .satisfies(e -> assertThat(((BizException) e).getErrorCode())
                            .isEqualTo(ErrorCode.IGS_ERROR));
        }
    }

    // ============================================================ 3. 地图文档信息

    @Nested
    @DisplayName("getMapDocInfo")
    class GetMapDocInfo {

        @Test
        @DisplayName("200 时解析为 Map，保留 SubMapNames/MapCount")
        void shouldReturnMapDocInfo() throws IOException {
            IgsClient client = startServer(ex -> respond(ex, 200, MAP_DOC_OK));

            Map<String, Object> info = client.getMapDocInfo();

            assertThat(info).containsKeys("SubMapNames", "MapCount", "URL");
            assertThat(info.get("SubMapNames")).isInstanceOf(List.class);
        }

        @Test
        @DisplayName("空白响应体映射为 IGS_ERROR")
        void shouldThrowIgsErrorOnBlankBody() throws IOException {
            IgsClient client = startServer(ex -> {
                ex.sendResponseHeaders(200, -1);
                ex.close();
            });

            assertThatThrownBy(client::getMapDocInfo)
                    .isInstanceOf(BizException.class)
                    .satisfies(e -> assertThat(((BizException) e).getErrorCode())
                            .isEqualTo(ErrorCode.IGS_ERROR));
        }

        @Test
        @DisplayName("服务不可达映射为 IGS_UNAVAILABLE")
        void shouldThrowUnavailableWhenUnreachable() {
            IgsClient client = newClient(1, 500);

            assertThatThrownBy(client::getMapDocInfo)
                    .isInstanceOf(BizException.class)
                    .satisfies(e -> assertThat(((BizException) e).getErrorCode())
                            .isEqualTo(ErrorCode.IGS_UNAVAILABLE));
        }
    }

    // ============================================================ 4. 要素查询

    @Nested
    @DisplayName("queryFeatures")
    class QueryFeatures {

        @Test
        @DisplayName("200 时返回 features，并把 where/分页参数拼进 query")
        void shouldReturnFeaturesAndBuildQuery() throws IOException {
            AtomicReference<String> rawQuery = new AtomicReference<>();
            AtomicReference<String> path = new AtomicReference<>();
            IgsClient client = startServer(ex -> {
                path.set(ex.getRequestURI().getPath());
                rawQuery.set(ex.getRequestURI().getQuery());
                respond(ex, 200, "{\"features\":[{\"attributes\":{\"NAME\":\"A\"}}],\"total\":1}");
            });

            Map<String, Object> result = client.queryFeatures("0", null, "*", 2, 10);

            assertThat(result).containsKey("features");
            assertThat(path.get()).contains(MAP_DOC).contains("/0/query");
            // where 为空时兜底 1=1（不校验百分号编码，RestClient 会做归一化）
            assertThat(rawQuery.get()).contains("where=1=1");
            assertThat(rawQuery.get()).contains("outFields=*");
            assertThat(rawQuery.get()).contains("skipCount=10");
            assertThat(rawQuery.get()).contains("resultRecordCount=10");
            assertThat(rawQuery.get()).contains("f=json");
        }

        @Test
        @DisplayName("响应体含 error 字段时映射为 IGS_ERROR")
        void shouldThrowIgsErrorWhenErrorField() throws IOException {
            IgsClient client = startServer(ex ->
                    respond(ex, 200, "{\"error\":{\"message\":\"key is null\"}}"));

            assertThatThrownBy(() -> client.queryFeatures("0", "1=1", "*", 1, 10))
                    .isInstanceOf(BizException.class)
                    .satisfies(e -> assertThat(((BizException) e).getErrorCode())
                            .isEqualTo(ErrorCode.IGS_ERROR));
        }

        @Test
        @DisplayName("404 映射为 DATA_NOT_READY（禁止伪造数据）")
        void shouldThrowDataNotReadyOn404() throws IOException {
            IgsClient client = startServer(ex -> respond(ex, 404, "{}"));

            assertThatThrownBy(() -> client.queryFeatures("0", "1=1", "*", 1, 10))
                    .isInstanceOf(BizException.class)
                    .satisfies(e -> assertThat(((BizException) e).getErrorCode())
                            .isEqualTo(ErrorCode.DATA_NOT_READY));
        }

        @Test
        @DisplayName("服务不可达映射为 IGS_UNAVAILABLE")
        void shouldThrowUnavailableWhenUnreachable() {
            IgsClient client = newClient(1, 500);

            assertThatThrownBy(() -> client.queryFeatures("0", "1=1", "*", 1, 10))
                    .isInstanceOf(BizException.class)
                    .satisfies(e -> assertThat(((BizException) e).getErrorCode())
                            .isEqualTo(ErrorCode.IGS_UNAVAILABLE));
        }
    }

    // ============================================================ 5. 网络分析（占位）

    @Nested
    @DisplayName("runNetworkAnalysis")
    class RunNetworkAnalysis {

        @Test
        @DisplayName("模板未就绪时抛 DATA_NOT_READY，不伪造结果")
        void shouldThrowDataNotReady() {
            IgsClient client = newClient(1, 500);

            assertThatThrownBy(() -> client.runNetworkAnalysis(Map.of()))
                    .isInstanceOf(BizException.class)
                    .satisfies(e -> assertThat(((BizException) e).getErrorCode())
                            .isEqualTo(ErrorCode.DATA_NOT_READY));
        }
    }

    // ============================================================ 6. 基础属性

    @Test
    @DisplayName("baseUrl 按 igs.ip/port 拼接，mapDoc 原样暴露")
    void shouldExposeBaseUrlAndMapDoc() {
        IgsClient client = newClient(6163, 1000);

        assertThat(client.getBaseUrl()).isEqualTo("http://127.0.0.1:6163");
        assertThat(client.getMapDoc()).isEqualTo(MAP_DOC);
    }
}

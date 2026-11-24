package com.example.gis.service;

import com.example.gis.common.BizException;
import com.example.gis.common.ErrorCode;
import com.example.gis.service.SuggestService.SuggestItem;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * API-03 用例。上游响应全部由 MockRestServiceServer 构造，不访问真实高德接口。
 * 覆盖：参数校验、字段裁剪（只留 name/district/lon/lat）、区名截取、无坐标项丢弃、
 * 空结果非错误、配额超限 5001、其它业务失败 3002、缓存命中不二次回源。
 */
class SuggestServiceTest {

    private static final String TIPS_BODY = """
            {
              "status": "1",
              "info": "OK",
              "infocode": "10000",
              "count": "3",
              "tips": [
                {"name": "红钢城街社区卫生服务中心", "district": "湖北省武汉市青山区",
                 "adcode": "420107", "location": "114.398011,30.512345", "address": "冶金大道"},
                {"name": "没有坐标的提示项", "district": "湖北省武汉市青山区", "location": []},
                {"name": "江岸区二七街社区卫生服务中心", "district": "湖北省武汉市江岸区",
                 "adcode": "420102", "location": "114.318593,30.633404", "address": "二七路"}
              ]
            }
            """;

    private MockRestServiceServer server;
    private SuggestService service;
    private Cache<String, List<SuggestItem>> cache;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        cache = Caffeine.newBuilder().maximumSize(64).expireAfterWrite(Duration.ofMinutes(10)).build();
        service = new SuggestService("test-key", new ObjectMapper(), cache, builder.build());
    }

    @Test
    void 关键字过短返回1001() {
        assertThatThrownBy(() -> service.suggest("红", "武汉", 10))
                .isInstanceOf(BizException.class)
                .extracting(e -> ((BizException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_PARAM);
    }

    @Test
    void 关键字过长与条数越界返回1002() {
        assertThatThrownBy(() -> service.suggest("红".repeat(31), "武汉", 10))
                .isInstanceOf(BizException.class)
                .extracting(e -> ((BizException) e).getErrorCode())
                .isEqualTo(ErrorCode.OUT_OF_RANGE);
        assertThatThrownBy(() -> service.suggest("红钢城", "武汉", 0))
                .isInstanceOf(BizException.class)
                .extracting(e -> ((BizException) e).getErrorCode())
                .isEqualTo(ErrorCode.OUT_OF_RANGE);
        assertThatThrownBy(() -> service.suggest("红钢城", "武汉", 21))
                .isInstanceOf(BizException.class)
                .extracting(e -> ((BizException) e).getErrorCode())
                .isEqualTo(ErrorCode.OUT_OF_RANGE);
    }

    @Test
    void 只保留四个字段且区名截取到区() {
        server.expect(requestTo(org.hamcrest.Matchers.containsString("keywords=")))
                .andRespond(withSuccess(TIPS_BODY, MediaType.APPLICATION_JSON));

        List<SuggestItem> list = service.suggest("红钢城", "武汉", 10);

        assertThat(list).hasSize(2);
        SuggestItem first = list.get(0);
        assertThat(first.name()).isEqualTo("红钢城街社区卫生服务中心");
        assertThat(first.district()).isEqualTo("青山区");
        assertThat(first.lon()).isEqualTo(114.398011);
        assertThat(first.lat()).isEqualTo(30.512345);
        // 无坐标项被丢弃，第二项是原本的第三项
        assertThat(list.get(1).district()).isEqualTo("江岸区");
        server.verify();
    }

    @Test
    void 空结果不是错误() {
        server.expect(requestTo(org.hamcrest.Matchers.containsString("keywords=")))
                .andRespond(withSuccess("{\"status\":\"1\",\"count\":\"0\",\"tips\":[]}", MediaType.APPLICATION_JSON));

        assertThat(service.suggest("不存在的关键字", "武汉", 10)).isEmpty();
        server.verify();
    }

    @Test
    void 条数上限生效() {
        server.expect(requestTo(org.hamcrest.Matchers.containsString("keywords=")))
                .andRespond(withSuccess(TIPS_BODY, MediaType.APPLICATION_JSON));

        assertThat(service.suggest("红钢城", "武汉", 1)).hasSize(1);
        server.verify();
    }

    @Test
    void 配额超限返回5001() {
        server.expect(requestTo(org.hamcrest.Matchers.containsString("keywords=")))
                .andRespond(withSuccess("{\"status\":\"0\",\"info\":\"DAILY_QUERY_OVER_LIMIT\",\"infocode\":\"10003\"}",
                        MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> service.suggest("红钢城", "武汉", 10))
                .isInstanceOf(BizException.class)
                .extracting(e -> ((BizException) e).getErrorCode())
                .isEqualTo(ErrorCode.QUOTA_EXCEEDED);
    }

    @Test
    void 其它业务失败返回3002() {
        server.expect(requestTo(org.hamcrest.Matchers.containsString("keywords=")))
                .andRespond(withSuccess("{\"status\":\"0\",\"info\":\"INVALID_USER_KEY\",\"infocode\":\"10001\"}",
                        MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> service.suggest("红钢城", "武汉", 10))
                .isInstanceOf(BizException.class)
                .extracting(e -> ((BizException) e).getErrorCode())
                .isEqualTo(ErrorCode.IGS_ERROR);
    }

    @Test
    void 同一关键字二次请求命中缓存不二次回源() {
        server.expect(requestTo(org.hamcrest.Matchers.containsString("keywords=")))
                .andRespond(withSuccess(TIPS_BODY, MediaType.APPLICATION_JSON));

        List<SuggestItem> first = service.suggest("红钢城", "武汉", 10);
        List<SuggestItem> second = service.suggest("红钢城", "武汉", 10);

        assertThat(second).isEqualTo(first);
        // 只配了一次期望且无需再响应第二次，说明第二次未回源
        server.verify();
    }
}

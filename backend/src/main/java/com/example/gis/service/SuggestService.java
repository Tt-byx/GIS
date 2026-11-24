package com.example.gis.service;

import com.example.gis.common.BizException;
import com.example.gis.common.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * API-03 名称补全代理。高德 Key 只从 application.yml 的 amap.key（即环境变量 AMAP_KEY）读取，
 * MUST NOT 从请求参数接收，MUST NOT 写进响应或日志（SPEC/03 §5 业务规则 2、禁止事项）。
 */
@Slf4j
@Service
public class SuggestService {

    /** 契约规定的关键字长度下限 / 上限。 */
    private static final int KW_MIN_LENGTH = 2;
    private static final int KW_MAX_LENGTH = 30;

    /** 契约规定的条数区间。 */
    private static final int LIMIT_MIN = 1;
    private static final int LIMIT_MAX = 20;

    /** 契约规定第三方超时视为上游不可用，超时阈值 8s。 */
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(8);
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);

    /** 高德表示"配额/频率超限"的业务码，命中即转 5001。 */
    private static final Set<String> QUOTA_INFO_CODES = Set.of("10003", "10004", "10044", "10045", "10046");

    private static final String AMAP_SUGGEST_URL = "https://restapi.amap.com/v3/assistant/inputtips";

    private final String amapKey;
    private final ObjectMapper objectMapper;
    private final Cache<String, List<SuggestItem>> cache;
    private final RestClient restClient;

    @Autowired
    public SuggestService(@Value("${amap.key:}") String amapKey,
                          ObjectMapper objectMapper,
                          Cache<String, List<SuggestItem>> suggestCache) {
        this.amapKey = amapKey == null ? "" : amapKey.trim();
        this.objectMapper = objectMapper;
        this.cache = suggestCache;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT);
        factory.setReadTimeout(READ_TIMEOUT);
        // baseUrl 不写死完整地址，避免 key 出现在任何可被打印的字符串里
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    /** 供单元测试注入受控 RestClient，生产环境只走上面的构造函数。 */
    SuggestService(String amapKey, ObjectMapper objectMapper,
                   Cache<String, List<SuggestItem>> suggestCache, RestClient restClient) {
        this.amapKey = amapKey == null ? "" : amapKey.trim();
        this.objectMapper = objectMapper;
        this.cache = suggestCache;
        this.restClient = restClient;
    }

    /**
     * 按关键字返回候选地点。缓存粒度为 `kw|city`（契约写死），
     * 因此缓存里存上游原样条数，limit 在读取后裁剪，保证不同 limit 复用同一份缓存。
     */
    public List<SuggestItem> suggest(String kw, String city, int limit) {
        String keyword = kw == null ? "" : kw.trim();
        if (keyword.length() < KW_MIN_LENGTH) {
            throw new BizException(ErrorCode.INVALID_PARAM);
        }
        if (keyword.length() > KW_MAX_LENGTH || limit < LIMIT_MIN || limit > LIMIT_MAX) {
            throw new BizException(ErrorCode.OUT_OF_RANGE);
        }
        String cityName = (city == null || city.isBlank()) ? "武汉" : city.trim();
        String cacheKey = keyword + "|" + cityName;

        List<SuggestItem> cached = cache.getIfPresent(cacheKey);
        if (cached != null) {
            log.info("suggest 命中缓存 kw={} city={} 条数={}", keyword, cityName, cached.size());
            return slice(cached, limit);
        }

        List<SuggestItem> fetched = fetchFromAmap(keyword, cityName);
        cache.put(cacheKey, fetched);
        log.info("suggest 未命中缓存，已回源 kw={} city={} 条数={}", keyword, cityName, fetched.size());
        return slice(fetched, limit);
    }

    private List<SuggestItem> fetchFromAmap(String keyword, String city) {
        if (amapKey.isEmpty()) {
            log.error("amap.key 未配置，请通过环境变量 AMAP_KEY 注入");
            throw new BizException(ErrorCode.IGS_UNAVAILABLE);
        }
        String body;
        try {
            body = restClient.get()
                    .uri(AMAP_SUGGEST_URL + "?keywords={kw}&city={city}&citylimit=true&key={key}",
                            keyword, city, amapKey)
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException e) {
            // 高德配额超限时也可能直接返回 429；异常对象里带 URL（含 key），只记录状态码，不记录消息
            log.warn("suggest 上游返回非 2xx status={} kw={}", e.getStatusCode().value(), keyword);
            if (e.getStatusCode().value() == 429) {
                throw new BizException(ErrorCode.QUOTA_EXCEEDED);
            }
            throw new BizException(ErrorCode.IGS_ERROR);
        } catch (ResourceAccessException e) {
            // 超时不打印异常消息，避免 URL 中的 key 进入日志
            log.warn("suggest 上游访问失败 type={} kw={}", e.getCause() == null ? "unknown" : e.getCause().getClass().getSimpleName(), keyword);
            throw new BizException(ErrorCode.IGS_UNAVAILABLE);
        }
        return parse(body, keyword);
    }

    private List<SuggestItem> parse(String body, String keyword) {
        if (body == null || body.isBlank()) {
            log.warn("suggest 上游返回空响应 kw={}", keyword);
            throw new BizException(ErrorCode.IGS_ERROR);
        }
        JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (Exception e) {
            log.warn("suggest 上游响应不是合法 JSON kw={}", keyword);
            throw new BizException(ErrorCode.IGS_ERROR);
        }

        String status = root.path("status").asText("");
        if (!"1".equals(status)) {
            String infocode = root.path("infocode").asText("");
            log.warn("suggest 上游返回失败 kw={} infocode={}（不记录 info，避免回显 Key 相关提示）", keyword, infocode);
            if (QUOTA_INFO_CODES.contains(infocode)) {
                throw new BizException(ErrorCode.QUOTA_EXCEEDED);
            }
            throw new BizException(ErrorCode.IGS_ERROR);
        }

        List<SuggestItem> items = new ArrayList<>();
        for (JsonNode tip : root.path("tips")) {
            String name = tip.path("name").asText("").trim();
            String location = tip.path("location").asText("").trim();
            // 没有坐标的提示项无法参与地图定位，直接丢弃（契约要求 lon/lat 必有值）
            if (name.isEmpty() || location.isEmpty()) {
                continue;
            }
            String[] parts = location.split(",");
            if (parts.length != 2) {
                continue;
            }
            double lon;
            double lat;
            try {
                lon = Double.parseDouble(parts[0].trim());
                lat = Double.parseDouble(parts[1].trim());
            } catch (NumberFormatException e) {
                continue;
            }
            items.add(new SuggestItem(name, trimDistrict(tip.path("district").asText("")), lon, lat));
        }
        return List.copyOf(items);
    }

    /**
     * 高德返回的 district 形如「湖北省武汉市青山区」，契约示例只给「青山区」，
     * 故截取最后一个「市」之后的部分；无「市」时原样返回。
     */
    private static String trimDistrict(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String value = raw.trim();
        int idx = value.lastIndexOf('市');
        if (idx >= 0 && idx < value.length() - 1) {
            return value.substring(idx + 1);
        }
        return value;
    }

    private static List<SuggestItem> slice(List<SuggestItem> source, int limit) {
        if (source.size() <= limit) {
            return source;
        }
        return List.copyOf(source.subList(0, limit));
    }

    /** 契约只允许这 4 个字段，MUST NOT 整包透传第三方响应（§5 业务规则 3）。 */
    public record SuggestItem(String name, String district, double lon, double lat) {
    }
}

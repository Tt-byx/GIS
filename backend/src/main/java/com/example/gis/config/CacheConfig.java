package com.example.gis.config;

import com.example.gis.service.SuggestService.SuggestItem;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.List;

/**
 * 本地缓存定义。API-03 要求 key = `kw|city`、TTL 10 分钟（SPEC/03 §5），
 * 上限只限制条目数、不改变 TTL 语义；超过 10 分钟的条目 MUST 视为失效。
 */
@Configuration
public class CacheConfig {

    /** 名称补全缓存的最大条目数。20 条/页、单机演示场景下 512 足够覆盖常用关键字。 */
    private static final int SUGGEST_MAX_ENTRIES = 512;

    /** 缓存有效期，契约写死 10 分钟，不得调大。 */
    private static final Duration SUGGEST_TTL = Duration.ofMinutes(10);

    @Bean
    public Cache<String, List<SuggestItem>> suggestCache() {
        return Caffeine.newBuilder()
                .maximumSize(SUGGEST_MAX_ENTRIES)
                .expireAfterWrite(SUGGEST_TTL)
                .recordStats()
                .build();
    }
}

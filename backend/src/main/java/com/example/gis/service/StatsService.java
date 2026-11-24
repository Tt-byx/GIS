package com.example.gis.service;

import com.example.gis.common.BizException;
import com.example.gis.common.ErrorCode;
import com.example.gis.dto.StatDto;
import com.example.gis.mapper.StatDistrictMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * API-04 分区统计（SPEC/03-api-contract.md §6）。
 *
 * 规则要点：
 * 1. 数据只来自预计算表 STAT_DISTRICT，本类 MUST NOT 做聚合计算；
 * 2. unit 按 metric 严格映射三值，不得回显请求参数以外的东西；
 * 3. value 来自 METRIC_VALUE，NULL 必须原样返回 null（A-23），不得补 0；
 * 4. 只查 MAX(DATA_DATE) 版本，该版本无数据返回 2001；
 * 5. districtCode 仅在 level=street 时参与过滤。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StatsService {

    static final String LEVEL_DISTRICT = "district";
    static final String LEVEL_STREET = "street";
    static final String CATEGORY_ALL = "ALL";
    static final String METRIC_COUNT = "count";
    static final String METRIC_DENSITY = "density";
    static final String METRIC_PER_CAPITA = "perCapita";

    private static final Set<String> LEVELS = Set.of(LEVEL_DISTRICT, LEVEL_STREET);
    private static final Set<String> METRICS = Set.of(METRIC_COUNT, METRIC_DENSITY, METRIC_PER_CAPITA);

    /** 契约规则 1：count→个，density→个/km²，perCapita→个/万人。 */
    private static final Map<String, String> UNITS = Map.of(
            METRIC_COUNT, "个",
            METRIC_DENSITY, "个/km²",
            METRIC_PER_CAPITA, "个/万人");

    private final StatDistrictMapper statDistrictMapper;

    public StatDto query(String level, String categoryL1, String metric, String districtCode) {
        String normalizedLevel = normalizeLevel(level);
        String normalizedMetric = normalizeMetric(metric);
        String normalizedCategory = normalizeCategory(categoryL1);
        // 契约：districtCode 仅在 level=street 时生效，区级请求带该参数必须忽略而不是报错
        String normalizedDistrict = LEVEL_STREET.equals(normalizedLevel) ? blankToNull(districtCode) : null;

        String dataDate = statDistrictMapper.findMaxDataDate(
                normalizedLevel, normalizedCategory, normalizedMetric, normalizedDistrict);
        if (dataDate == null) {
            log.info("分区统计无数据 level={} catL1={} metric={} districtCode={}",
                    normalizedLevel, normalizedCategory, normalizedMetric, normalizedDistrict);
            throw new BizException(ErrorCode.NOT_FOUND);
        }

        List<StatDistrictMapper.Row> rows = statDistrictMapper.findByVersion(
                normalizedLevel, normalizedCategory, normalizedMetric, dataDate, normalizedDistrict);
        if (rows.isEmpty()) {
            log.warn("分区统计版本 {} 无明细行 level={} catL1={} metric={}",
                    dataDate, normalizedLevel, normalizedCategory, normalizedMetric);
            throw new BizException(ErrorCode.NOT_FOUND);
        }

        StatDto dto = new StatDto();
        dto.setLevel(normalizedLevel);
        dto.setMetric(normalizedMetric);
        dto.setUnit(UNITS.get(normalizedMetric));
        dto.setDataDate(dataDate);
        dto.setList(toItems(rows));
        return dto;
    }

    private List<StatDto.Item> toItems(List<StatDistrictMapper.Row> rows) {
        List<StatDto.Item> items = new ArrayList<>(rows.size());
        for (StatDistrictMapper.Row row : rows) {
            StatDto.Item item = new StatDto.Item();
            item.setUnitCode(row.getUnitCode());
            item.setUnitName(row.getUnitName());
            item.setValue(plain(row.getValue()));
            item.setPopTotal(row.getPopTotal());
            item.setFacCount(row.getFacCount());
            items.add(item);
        }
        return items;
    }

    /**
     * DECIMAL(12,4) 去掉无意义的尾零，保证 167.0000 序列化为 167 而不是 167.0000；
     * stripTrailingZeros 会把 1000 变成 1E+3，因此负标度要还原为整数标度。
     */
    static BigDecimal plain(BigDecimal value) {
        if (value == null) {
            return null;
        }
        BigDecimal stripped = value.stripTrailingZeros();
        return stripped.scale() < 0 ? stripped.setScale(0) : stripped;
    }

    private String normalizeLevel(String level) {
        String value = blankToNull(level);
        if (value == null || !LEVELS.contains(value)) {
            throw new BizException(ErrorCode.OUT_OF_RANGE);
        }
        return value;
    }

    private String normalizeMetric(String metric) {
        String value = blankToNull(metric);
        if (value == null) {
            return METRIC_COUNT;
        }
        if (!METRICS.contains(value)) {
            throw new BizException(ErrorCode.OUT_OF_RANGE);
        }
        return value;
    }

    private String normalizeCategory(String categoryL1) {
        String value = blankToNull(categoryL1);
        return value == null ? CATEGORY_ALL : value.toUpperCase();
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

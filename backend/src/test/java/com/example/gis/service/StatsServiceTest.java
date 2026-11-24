package com.example.gis.service;

import com.example.gis.common.BizException;
import com.example.gis.common.ErrorCode;
import com.example.gis.dto.StatDto;
import com.example.gis.mapper.StatDistrictMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * API-04 分区统计单元测试（对应 T-027 DoD 2/3/4 与 SPEC/03 §6 四条业务规则）。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("API-04 分区统计")
class StatsServiceTest {

    @Mock
    private StatDistrictMapper statDistrictMapper;

    @InjectMocks
    private StatsService statsService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static StatDistrictMapper.Row row(String code, String name, String value,
                                              Integer pop, Integer facCount) {
        StatDistrictMapper.Row row = new StatDistrictMapper.Row();
        row.setUnitCode(code);
        row.setUnitName(name);
        row.setValue(value == null ? null : new BigDecimal(value));
        row.setPopTotal(pop);
        row.setFacCount(facCount);
        return row;
    }

    @Test
    @DisplayName("规则 1：unit 按 metric 严格映射 个 / 个/km² / 个/万人")
    void shouldMapUnitByMetric() {
        for (String[] c : new String[][]{
                {"count", "个"}, {"density", "个/km²"}, {"perCapita", "个/万人"}}) {
            String metric = c[0];
            when(statDistrictMapper.findMaxDataDate("district", "ALL", metric, null)).thenReturn("2026-11-05");
            when(statDistrictMapper.findByVersion("district", "ALL", metric, "2026-11-05", null))
                    .thenReturn(List.of(row("420107", "青山区", "1023.0000", 452000, 1023)));

            StatDto dto = statsService.query("district", null, metric, null);

            assertThat(dto.getUnit()).isEqualTo(c[1]);
            assertThat(dto.getMetric()).isEqualTo(metric);
        }
    }

    @Test
    @DisplayName("规则 2：METRIC_VALUE 为 NULL 时返回 null，不补 0")
    void shouldKeepNullValue() throws Exception {
        when(statDistrictMapper.findMaxDataDate("district", "ALL", "perCapita", null)).thenReturn("2026-11-05");
        when(statDistrictMapper.findByVersion("district", "ALL", "perCapita", "2026-11-05", null))
                .thenReturn(List.of(row("420107", "青山区", null, 0, 12)));

        StatDto dto = statsService.query("district", "ALL", "perCapita", null);

        assertThat(dto.getList().get(0).getValue()).isNull();
        String json = objectMapper.writeValueAsString(dto.getList().get(0));
        assertThat(json).contains("\"value\":null").doesNotContain("\"value\":0");
    }

    @Test
    @DisplayName("规则 3：版本取 MAX(DATA_DATE)，明细查询必须使用该版本")
    void shouldUseMaxDataDate() {
        when(statDistrictMapper.findMaxDataDate("district", "EDU", "count", null)).thenReturn("2026-11-05");
        when(statDistrictMapper.findByVersion("district", "EDU", "count", "2026-11-05", null))
                .thenReturn(List.of(row("420105", "汉阳区", "500.0000", 837000, 500),
                        row("420106", "武昌区", "600.0000", 1097000, 600),
                        row("420107", "青山区", "167.0000", 452000, 167)));

        StatDto dto = statsService.query("district", "edu", "count", null);

        assertThat(dto.getDataDate()).isEqualTo("2026-11-05");
        assertThat(dto.getList()).extracting(StatDto.Item::getUnitCode)
                .containsExactly("420105", "420106", "420107");
        verify(statDistrictMapper).findByVersion("district", "EDU", "count", "2026-11-05", null);
        // DECIMAL(12,4) 的尾零必须去掉（DM-21 要求 number，不要求 4 位小数）
        assertThat(dto.getList().get(2).getValue()).isEqualByComparingTo("167");
        assertThat(dto.getList().get(2).getFacCount()).isEqualTo(167);
    }

    @Test
    @DisplayName("错误情形：该版本无数据返回 2001")
    void shouldReturnNotFoundWhenNoData() {
        when(statDistrictMapper.findMaxDataDate("street", "ALL", "count", null)).thenReturn(null);

        assertThatThrownBy(() -> statsService.query("street", null, null, null))
                .isInstanceOf(BizException.class)
                .extracting(e -> ((BizException) e).getErrorCode())
                .isEqualTo(ErrorCode.NOT_FOUND);
        verify(statDistrictMapper, never()).findByVersion(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("错误情形：level 非枚举返回 1002，且不查库")
    void shouldRejectInvalidLevel() {
        assertThatThrownBy(() -> statsService.query("city", null, null, null))
                .isInstanceOf(BizException.class)
                .extracting(e -> ((BizException) e).getErrorCode())
                .isEqualTo(ErrorCode.OUT_OF_RANGE);
        verify(statDistrictMapper, never()).findMaxDataDate(any(), any(), any(), any());
    }

    @Test
    @DisplayName("错误情形：metric 非枚举返回 1002")
    void shouldRejectInvalidMetric() {
        assertThatThrownBy(() -> statsService.query("district", null, "sum", null))
                .isInstanceOf(BizException.class)
                .extracting(e -> ((BizException) e).getErrorCode())
                .isEqualTo(ErrorCode.OUT_OF_RANGE);
    }

    @Test
    @DisplayName("规则：districtCode 仅在 level=street 生效，区级请求必须忽略")
    void shouldIgnoreDistrictCodeOnDistrictLevel() {
        when(statDistrictMapper.findMaxDataDate(eq("district"), eq("ALL"), eq("count"), isNull()))
                .thenReturn("2026-11-05");
        when(statDistrictMapper.findByVersion(eq("district"), eq("ALL"), eq("count"), eq("2026-11-05"), isNull()))
                .thenReturn(List.of(row("420107", "青山区", "1023.0000", 452000, 1023)));

        statsService.query("district", null, null, "420107");

        verify(statDistrictMapper).findMaxDataDate("district", "ALL", "count", null);
    }

    @Test
    @DisplayName("默认值：categoryL1 缺省为 ALL，metric 缺省为 count")
    void shouldApplyDefaults() {
        when(statDistrictMapper.findMaxDataDate("district", "ALL", "count", null)).thenReturn("2026-11-05");
        when(statDistrictMapper.findByVersion("district", "ALL", "count", "2026-11-05", null))
                .thenReturn(List.of(row("420107", "青山区", "1023.0000", 452000, 1023)));

        StatDto dto = statsService.query("district", "  ", "", null);

        assertThat(dto.getMetric()).isEqualTo("count");
        assertThat(dto.getUnit()).isEqualTo("个");
    }
}

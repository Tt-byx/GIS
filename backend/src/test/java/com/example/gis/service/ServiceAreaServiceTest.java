package com.example.gis.service;

import com.example.gis.common.BizException;
import com.example.gis.common.ErrorCode;
import com.example.gis.service.ServiceAreaService.Facility;
import com.example.gis.service.ServiceAreaService.Point;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * T-028 服务区接口单元测试。
 *
 * <p>只测纯函数（阈值归一化 / 半径换算 / WKT 覆盖判定 / 覆盖率 / 中心点拼装），
 * 不依赖数据库与 IGServer —— 网络类未就绪时也能稳定回归。
 */
@DisplayName("T-028 服务区分析")
class ServiceAreaServiceTest {

    // ============================================================ 阈值归一化

    @Nested
    @DisplayName("normalizeThresholds")
    class NormalizeThresholds {

        @Test
        @DisplayName("乱序 + 重复 → 去重并升序")
        void shouldDedupeAndSort() {
            assertThat(ServiceAreaService.normalizeThresholds(List.of(15, 5, 10, 5)))
                    .containsExactly(5, 10, 15);
        }

        @Test
        @DisplayName("单个阈值保持原样")
        void shouldAcceptSingle() {
            assertThat(ServiceAreaService.normalizeThresholds(List.of(10)))
                    .containsExactly(10);
        }

        @Test
        @DisplayName("含非法值（20）→ 1002")
        void shouldRejectIllegalValue() {
            assertThatThrownBy(() -> ServiceAreaService.normalizeThresholds(List.of(5, 20)))
                    .isInstanceOf(BizException.class)
                    .satisfies(e -> assertThat(((BizException) e).getErrorCode())
                            .isEqualTo(ErrorCode.OUT_OF_RANGE));
        }

        @Test
        @DisplayName("空/null → 1002")
        void shouldRejectEmpty() {
            assertThatThrownBy(() -> ServiceAreaService.normalizeThresholds(List.of()))
                    .isInstanceOf(BizException.class)
                    .satisfies(e -> assertThat(((BizException) e).getErrorCode())
                            .isEqualTo(ErrorCode.OUT_OF_RANGE));
            assertThatThrownBy(() -> ServiceAreaService.normalizeThresholds(null))
                    .isInstanceOf(BizException.class);
        }

        @Test
        @DisplayName("含 null 元素 → 1002")
        void shouldRejectNullElement() {
            assertThatThrownBy(() -> ServiceAreaService.normalizeThresholds(Arrays.asList(5, null)))
                    .isInstanceOf(BizException.class)
                    .satisfies(e -> assertThat(((BizException) e).getErrorCode())
                            .isEqualTo(ErrorCode.OUT_OF_RANGE));
        }
    }

    // ============================================================ 半径换算

    @Nested
    @DisplayName("radiusKm")
    class RadiusKm {

        @Test
        @DisplayName("WALK 15 分钟 → 1.2 km")
        void shouldConvertWalk() {
            assertThat(ServiceAreaService.radiusKm(15, "WALK")).isEqualTo(1.2);
        }

        @Test
        @DisplayName("DRIVE 10 分钟 → 5.0 km")
        void shouldConvertDrive() {
            assertThat(ServiceAreaService.radiusKm(10, "DRIVE")).isEqualTo(5.0);
        }
    }

    // ============================================================ 几何覆盖

    @Nested
    @DisplayName("coverage")
    class Coverage {

        /** 边长 0.1° 的正方形（约 11km），围绕 114.28 / 30.57。 */
        private static final String SQUARE =
                "POLYGON((114.23 30.52, 114.33 30.52, 114.33 30.62, 114.23 30.62, 114.23 30.52))";

        @Test
        @DisplayName("面内点判定为覆盖，面外点不覆盖")
        void shouldDetectInsideAndOutside() {
            List<Point> points = List.of(
                    new Point("R1", "内", "S1", 114.28, 30.57),
                    new Point("R2", "外", "S1", 115.00, 30.57));

            boolean[] flags = ServiceAreaService.coverage(SQUARE, points);

            assertThat(flags).containsExactly(true, false);
            assertThat(ServiceAreaService.countTrue(flags)).isEqualTo(1);
        }

        @Test
        @DisplayName("MULTIPOLYGON 两个独立面分别覆盖")
        void shouldHandleMultiPolygon() {
            String wkt = "MULTIPOLYGON(((114.20 30.50, 114.22 30.50, 114.22 30.52, 114.20 30.50)),"
                    + "((114.30 30.60, 114.32 30.60, 114.32 30.62, 114.30 30.60)))";
            List<Point> points = List.of(
                    new Point("R1", "面1", "S1", 114.21, 30.505),
                    new Point("R2", "面2", "S1", 114.31, 30.605),
                    new Point("R3", "外部", "S1", 114.25, 30.55));

            boolean[] flags = ServiceAreaService.coverage(wkt, points);

            assertThat(flags).containsExactly(true, true, false);
        }

        @Test
        @DisplayName("带洞多边形：洞内点按奇偶规则判定为不覆盖")
        void shouldTreatHoleAsUncovered() {
            String wkt = "POLYGON((114.20 30.50, 114.40 30.50, 114.40 30.70, 114.20 30.70, 114.20 30.50),"
                    + "(114.28 30.58, 114.32 30.58, 114.32 30.62, 114.28 30.58))";
            List<Point> points = List.of(
                    new Point("R1", "洞内", "S1", 114.30, 30.60),
                    new Point("R2", "环上", "S1", 114.25, 30.55));

            boolean[] flags = ServiceAreaService.coverage(wkt, points);

            assertThat(flags).containsExactly(false, true);
        }

        @Test
        @DisplayName("空 WKT → 全部不覆盖（不抛异常）")
        void shouldReturnAllFalseOnBlankWkt() {
            boolean[] flags = ServiceAreaService.coverage("", List.of(
                    new Point("R1", "a", "S1", 114.28, 30.57)));

            assertThat(flags).containsExactly(false);
        }
    }

    // ============================================================ 覆盖率

    @Nested
    @DisplayName("summary")
    class Summary {

        @Test
        @DisplayName("SPEC 示例：56 个小区覆盖 41 → 未覆盖 15，覆盖率 0.732")
        void shouldMatchSpecExample() {
            var summary = ServiceAreaService.summary(56, 41);

            assertThat(summary.getTotalCommunity()).isEqualTo(56);
            assertThat(summary.getUncoveredCommunity()).isEqualTo(15);
            assertThat(summary.getCoverageRate()).isEqualTo(0.732);
        }

        @Test
        @DisplayName("全覆盖 → 覆盖率 1.0，未覆盖 0")
        void shouldHandleFullCoverage() {
            var summary = ServiceAreaService.summary(10, 10);

            assertThat(summary.getCoverageRate()).isEqualTo(1.0);
            assertThat(summary.getUncoveredCommunity()).isZero();
        }

        @Test
        @DisplayName("总数 0 → 覆盖率 0，不发生除零")
        void shouldHandleZeroTotal() {
            var summary = ServiceAreaService.summary(0, 0);

            assertThat(summary.getCoverageRate()).isZero();
            assertThat(summary.getTotalCommunity()).isZero();
        }
    }

    // ============================================================ 未覆盖清单

    @Test
    @DisplayName("uncoveredList 只列未覆盖点，街道名优先取字典")
    void shouldBuildUncoveredList() {
        List<Point> points = List.of(
                new Point("R1", "甲小区", "S1", 114.28, 30.57),
                new Point("R2", "乙小区", "S2", 115.00, 30.57));
        boolean[] covered = {true, false};

        var list = ServiceAreaService.uncoveredList(points, covered, Map.of("S2", "红钢城街道"));

        assertThat(list).hasSize(1);
        assertThat(list.get(0).getResCode()).isEqualTo("R2");
        assertThat(list.get(0).getResName()).isEqualTo("乙小区");
        assertThat(list.get(0).getStreetName()).isEqualTo("红钢城街道");
    }

    @Test
    @DisplayName("街道字典缺失时回退为街道编码")
    void shouldFallbackToStreetCode() {
        List<Point> points = List.of(new Point("R1", "甲", "420107001", 114.28, 30.57));

        var list = ServiceAreaService.uncoveredList(points, new boolean[]{false}, Map.of());

        assertThat(list.get(0).getStreetName()).isEqualTo("420107001");
    }

    // ============================================================ 中心点拼装

    @Test
    @DisplayName("buildCenterPoints 输出 IGServer 需要的 x/y/capacity 结构，空容量按 1")
    void shouldBuildCenterPointsJson() {
        String json = ServiceAreaService.buildCenterPoints(List.of(
                new Facility("F1", 114.28, 30.57, 300.0),
                new Facility("F2", 114.29, 30.58, null)));

        assertThat(json).isEqualTo(
                "[{\"x\":114.28,\"y\":30.57,\"capacity\":300.0},"
                        + "{\"x\":114.29,\"y\":30.58,\"capacity\":1.0}]");
    }
}

package com.example.gis.service;

import com.example.gis.service.AccessibilityService.Computation;
import com.example.gis.service.AccessibilityService.Decay;
import com.example.gis.service.AccessibilityService.Link;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * 2SFCA 单元测试（CHK-TEST-BE-2SFCA，用例逐字对应 SPEC/06-testing.md §4.7）。
 * 全部使用内存构造的假矩阵，不依赖 OD 文件与数据库。
 */
@DisplayName("2SFCA 可达性计算")
class AccessibilityServiceTest {

    private static final int THRESHOLD = 10;

    private static Computation compute(Double[] capacity, double[] demand, List<Link> links,
                                       Decay decay, int threshold) {
        return AccessibilityService.computeScores(capacity, demand, links, threshold, decay);
    }

    @Test
    @DisplayName("TC-2SFCA-1：1 设施 S=100，1 居住点 D=100，t=0，BINARY → R=1，A=1")
    void tc1BasicCorrectness() {
        Computation result = compute(new Double[]{100.0}, new double[]{100},
                List.of(new Link(0, 0, 0)), Decay.BINARY, THRESHOLD);

        assertThat(result.rates()[0]).isEqualTo(1.0);
        assertThat(result.scores()[0]).isEqualTo(1.0);
        assertThat(result.capacityFallback()).isFalse();
    }

    @Test
    @DisplayName("TC-2SFCA-2：1 设施，2 居住点各 D=100，t=0 → R=0.5，各 A=0.5")
    void tc2DenominatorAccumulates() {
        Computation result = compute(new Double[]{100.0}, new double[]{100, 100},
                List.of(new Link(0, 0, 0), new Link(0, 1, 0)), Decay.BINARY, THRESHOLD);

        assertThat(result.rates()[0]).isEqualTo(0.5);
        assertThat(result.scores()).containsExactly(0.5, 0.5);
    }

    @Test
    @DisplayName("TC-2SFCA-3：居住点 t > threshold → 分母不含该点，A=0")
    void tc3ThresholdTruncation() {
        Computation result = compute(new Double[]{100.0}, new double[]{100},
                List.of(new Link(0, 0, 20)), Decay.BINARY, THRESHOLD);

        assertThat(result.rates()[0]).isEqualTo(0.0);
        assertThat(result.scores()[0]).isEqualTo(0.0);
    }

    @Test
    @DisplayName("TC-2SFCA-4：设施 S=null → 按 S=1 计算，capacityFallback=true")
    void tc4CapacityFallback() {
        Computation result = compute(new Double[]{null}, new double[]{100},
                List.of(new Link(0, 0, 0)), Decay.BINARY, THRESHOLD);

        assertThat(result.capacityFallback()).isTrue();
        assertThat(result.rates()[0]).isEqualTo(0.01);
        assertThat(result.scores()[0]).isEqualTo(0.01);
    }

    @Test
    @DisplayName("TC-2SFCA-5：分母为 0（无需求点）→ R=0，不抛异常")
    void tc5ZeroDenominator() {
        Computation result = compute(new Double[]{100.0}, new double[]{100},
                List.of(), Decay.BINARY, THRESHOLD);

        assertThat(result.rates()[0]).isEqualTo(0.0);
        assertThat(result.scores()[0]).isEqualTo(0.0);
    }

    @Test
    @DisplayName("TC-2SFCA-6：GAUSSIAN，t=threshold/2 → f(t)=exp(-0.5)≈0.6065")
    void tc6GaussianDecay() {
        assertThat(Decay.GAUSSIAN.factor(THRESHOLD / 2.0, THRESHOLD))
                .isCloseTo(Math.exp(-0.5), within(1e-4));

        // 单一供需点时 R 与 f 互逆，A 应回到 1，验证两步公式衔接正确
        Computation result = compute(new Double[]{100.0}, new double[]{100},
                List.of(new Link(0, 0, THRESHOLD / 2.0)), Decay.GAUSSIAN, THRESHOLD);
        assertThat(result.scores()[0]).isCloseTo(1.0, within(1e-9));
    }

    @Test
    @DisplayName("LINEAR：t=threshold/2 → f(t)=0.5，阈值边界处为 0")
    void linearDecay() {
        assertThat(Decay.LINEAR.factor(THRESHOLD / 2.0, THRESHOLD)).isEqualTo(0.5);
        assertThat(Decay.LINEAR.factor(THRESHOLD, THRESHOLD)).isEqualTo(0.0);
    }

    @Test
    @DisplayName("BINARY：阈值内恒为 1")
    void binaryDecay() {
        assertThat(Decay.BINARY.factor(0, THRESHOLD)).isEqualTo(1.0);
        assertThat(Decay.BINARY.factor(THRESHOLD, THRESHOLD)).isEqualTo(1.0);
    }
}

package com.example.gis.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 分级断点单元测试（CHK-TEST-BE-BREAKS，覆盖 Jenks 与等间距两种）。
 */
@DisplayName("分级断点")
class BreaksUtilTest {

    @Test
    @DisplayName("Jenks：长度 6、严格递增、首末等于 min/max")
    void jenksProducesSixAscendingBreaks() {
        double[] scores = new double[100];
        for (int i = 0; i < scores.length; i++) {
            scores[i] = i * 0.1;
        }

        double[] breaks = BreaksUtil.naturalBreaks(scores);

        assertThat(breaks).hasSize(6);
        for (int i = 1; i < breaks.length; i++) {
            assertThat(breaks[i]).isGreaterThan(breaks[i - 1]);
        }
        assertThat(breaks[0]).isEqualTo(0.0);
        assertThat(breaks[5]).isEqualTo(9.9);
    }

    @Test
    @DisplayName("样本数 < 5：退化为等间距，端点仍为 min/max")
    void smallSampleUsesEqualInterval() {
        double[] breaks = BreaksUtil.naturalBreaks(new double[]{0, 1, 2});

        assertThat(breaks).containsExactly(0.0, 0.4, 0.8, 1.2, 1.6, 2.0);
    }

    @Test
    @DisplayName("全部取值相同：断点全等，等级统一为 3")
    void allEqualDegenerates() {
        double[] breaks = BreaksUtil.naturalBreaks(new double[]{0, 0, 0, 0, 0, 0});

        assertThat(breaks).hasSize(6);
        assertThat(breaks).containsOnly(0.0);
        assertThat(BreaksUtil.isDegenerate(breaks)).isTrue();
        assertThat(BreaksUtil.levelOf(0, breaks)).isEqualTo(BreaksUtil.DEGENERATE_LEVEL);
    }

    @Test
    @DisplayName("等级判定：min→1，max→5，区间边界与断点一致")
    void levelFollowsBreaks() {
        double[] breaks = BreaksUtil.equalInterval(0, 10);

        assertThat(BreaksUtil.levelOf(0, breaks)).isEqualTo(1);
        assertThat(BreaksUtil.levelOf(1.9, breaks)).isEqualTo(1);
        assertThat(BreaksUtil.levelOf(2.0, breaks)).isEqualTo(2);
        assertThat(BreaksUtil.levelOf(10, breaks)).isEqualTo(5);
        assertThat(BreaksUtil.levelOf(0.1, breaks)).isEqualTo(1);
    }
}

package com.example.gis.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Arrays;

/**
 * 分级断点工具（CHK-TEST-BE-BREAKS）。
 *
 * 依据 SPEC/01 FR-M3-02 与 03 §8 规则 2：
 * 1. 用自然断点法（Fisher-Jenks）分 5 级，样本数 &lt; 5 时退化为等间距；
 * 2. 输出长度固定 6，首值 = min、末值 = max、且严格递增；
 * 3. 无法严格递增的唯一情形是「全部取值相同」（如全部 score=0），此时数学上无解，
 *    按 docs/接口约定.md 的既定决定退化为全等断点，调用方把 level 统一置 3。
 */
public final class BreaksUtil {

    public static final int CLASS_COUNT = 5;
    public static final int BREAK_COUNT = CLASS_COUNT + 1;

    /** 全等降级时统一使用的等级。 */
    public static final int DEGENERATE_LEVEL = 3;

    private static final int SCALE = 4;

    private BreaksUtil() {
    }

    /**
     * 计算 5 级断点。
     *
     * @param values 待分级样本，允许无序、允许重复；不得为 null 或空
     * @return 长度 6 的断点数组
     */
    public static double[] naturalBreaks(double[] values) {
        if (values == null || values.length == 0) {
            throw new IllegalArgumentException("分级样本不得为空");
        }
        double[] sorted = values.clone();
        Arrays.sort(sorted);

        double min = round(sorted[0]);
        double max = round(sorted[sorted.length - 1]);
        if (min == max) {
            return degenerate(min);
        }

        double[] candidate = sorted.length < CLASS_COUNT
                ? equalInterval(min, max)
                : jenks(sorted, min, max);
        if (isStrictlyIncreasing(candidate)) {
            return candidate;
        }
        // Jenks 在大量同值时可能产出重复断点，退化为等间距保证严格递增
        double[] fallback = equalInterval(min, max);
        return isStrictlyIncreasing(fallback) ? fallback : degenerate(min);
    }

    /** 等间距断点，min 与 max 必为端点。 */
    public static double[] equalInterval(double min, double max) {
        double[] breaks = new double[BREAK_COUNT];
        for (int i = 0; i < BREAK_COUNT; i++) {
            breaks[i] = round(min + (max - min) * i / CLASS_COUNT);
        }
        breaks[0] = round(min);
        breaks[CLASS_COUNT] = round(max);
        return breaks;
    }

    /**
     * 按断点判级：区间为左闭右开 [breaks[i], breaks[i+1])，最后一级含 max。
     * 即 score 等于某断点时归入其右侧那一级，与图例区间显示一致。
     * 全等断点（breaks[0] == breaks[5]）统一返回 3。
     */
    public static int levelOf(double score, double[] breaks) {
        if (breaks == null || breaks.length != BREAK_COUNT) {
            throw new IllegalArgumentException("断点数组长度必须为 6");
        }
        if (breaks[0] == breaks[CLASS_COUNT]) {
            return DEGENERATE_LEVEL;
        }
        for (int i = 0; i < CLASS_COUNT - 1; i++) {
            if (score < breaks[i + 1]) {
                return i + 1;
            }
        }
        return CLASS_COUNT;
    }

    /** 断点是否全等（用于服务层判定降级）。 */
    public static boolean isDegenerate(double[] breaks) {
        return breaks != null && breaks.length == BREAK_COUNT && breaks[0] == breaks[CLASS_COUNT];
    }

    /** Fisher-Jenks 动态规划，O(n²k)，n=3041 时约 2300 万次内层循环。 */
    private static double[] jenks(double[] sorted, double min, double max) {
        int n = sorted.length;
        int k = CLASS_COUNT;

        double[] prefix = new double[n + 1];
        double[] prefixSq = new double[n + 1];
        for (int i = 0; i < n; i++) {
            prefix[i + 1] = prefix[i] + sorted[i];
            prefixSq[i + 1] = prefixSq[i] + sorted[i] * sorted[i];
        }

        int[][] lower = new int[n + 1][k + 1];
        double[][] variance = new double[n + 1][k + 1];

        for (int i = 1; i <= n; i++) {
            lower[i][1] = 1;
            variance[i][1] = ssd(prefix, prefixSq, 0, i - 1);
        }
        for (int j = 2; j <= k; j++) {
            lower[1][j] = 1;
            variance[1][j] = 0;
            for (int i = 2; i <= n; i++) {
                double best = Double.MAX_VALUE;
                int bestStart = 1;
                for (int start = 1; start <= i - 1; start++) {
                    double cost = variance[start][j - 1] + ssd(prefix, prefixSq, start, i - 1);
                    if (cost < best) {
                        best = cost;
                        bestStart = start;
                    }
                }
                variance[i][j] = best;
                lower[i][j] = bestStart;
            }
        }

        double[] breaks = new double[BREAK_COUNT];
        breaks[CLASS_COUNT] = max;
        int index = n;
        for (int j = k; j >= 2; j--) {
            int start = lower[index][j];
            breaks[j - 1] = round(sorted[start - 1]);
            index = start - 1;
        }
        breaks[0] = min;
        return breaks;
    }

    /** 区间 [from, to] 的离差平方和（闭区间下标）。 */
    private static double ssd(double[] prefix, double[] prefixSq, int from, int to) {
        int count = to - from + 1;
        if (count <= 0) {
            return 0;
        }
        double sum = prefix[to + 1] - prefix[from];
        double sumSq = prefixSq[to + 1] - prefixSq[from];
        return sumSq - sum * sum / count;
    }

    private static boolean isStrictlyIncreasing(double[] breaks) {
        for (int i = 1; i < breaks.length; i++) {
            if (breaks[i] <= breaks[i - 1]) {
                return false;
            }
        }
        return true;
    }

    private static double[] degenerate(double value) {
        double[] breaks = new double[BREAK_COUNT];
        Arrays.fill(breaks, value);
        return breaks;
    }

    private static double round(double value) {
        return BigDecimal.valueOf(value).setScale(SCALE, RoundingMode.HALF_UP).doubleValue();
    }
}

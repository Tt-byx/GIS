package com.example.gis.service;

import com.example.gis.common.BizException;
import com.example.gis.common.ErrorCode;
import com.example.gis.dto.AccessibilityReq;
import com.example.gis.dto.AccessibilityResp;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * API-06 可达性分析（两步移动搜索法 2SFCA，SPEC/03-api-contract.md §8）。
 *
 * 数据来源：
 * - 供给：data/clean/facility_clean.csv（与 OD 矩阵同源，FAC_CODE 可直接对接）；
 * - 需求：data/clean/residential_clean.csv（D_k = POP_EST）；
 * - 成本：od.matrixPath 指向的 (facCode, resCode, minutes) 矩阵；
 * - 就绪判定：OD_MATRIX_META 必须存在 IS_ACTIVE=1 的记录，否则 2002。
 *
 * 算法按契约规则 6 的唯一版本实现，禁止在此处改写公式。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccessibilityService {

    static final int TIMEOUT_MS = 30_000;
    static final Set<Integer> ALLOWED_THRESHOLDS = Set.of(5, 10, 15);
    static final String TASK_TYPE = "ACCESSIBILITY";
    static final String CAPACITY_FIELD = "CAPACITY";

    private static final int SCALE = 4;

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    @Value("${od.matrixPath:./data/od_matrix.csv}")
    private String matrixPath;

    /** 距离衰减函数，公式唯一版本见契约 §8 规则 5。 */
    public enum Decay {
        BINARY {
            @Override
            double factor(double minutes, int threshold) {
                return 1.0;
            }
        },
        LINEAR {
            @Override
            double factor(double minutes, int threshold) {
                return 1.0 - minutes / threshold;
            }
        },
        GAUSSIAN {
            @Override
            double factor(double minutes, int threshold) {
                double sigma = threshold / 2.0;
                double z = minutes / sigma;
                return Math.exp(-0.5 * z * z);
            }
        };

        abstract double factor(double minutes, int threshold);

        static Decay parse(String value) {
            for (Decay decay : values()) {
                if (decay.name().equals(value)) {
                    return decay;
                }
            }
            throw new BizException(ErrorCode.OUT_OF_RANGE);
        }
    }

    /** OD 三元组，索引指向 facilities / residents 列表。 */
    public record Link(int facIndex, int resIndex, double minutes) {
    }

    /** 计算结果：R_j、每个居住点的 A_i、是否发生规模降级。 */
    public record Computation(double[] rates, double[] scores, boolean capacityFallback) {
    }

    public record Facility(String code, String districtCode, Double capacity, double lon, double lat) {
    }

    public record Resident(String code, String name, String districtCode, double demand, double lon, double lat) {
    }

    /** 2SFCA 主体：纯计算，不依赖 IO，供单元测试直接调用。 */
    public static Computation computeScores(Double[] capacities, double[] demands, List<Link> links,
                                            int threshold, Decay decay) {
        int facilityCount = capacities.length;
        double[] supply = new double[facilityCount];
        boolean capacityFallback = false;
        for (int j = 0; j < facilityCount; j++) {
            Double capacity = capacities[j];
            if (capacity == null || capacity == 0) {
                supply[j] = 1.0;
                capacityFallback = true;
            } else {
                supply[j] = capacity;
            }
        }

        // 第一步分母：Σ_k (D_k * f(t_kj))；阈值外的配对不参与（规则 6）
        double[] denominator = new double[facilityCount];
        for (Link link : links) {
            if (link.minutes() > threshold) {
                continue;
            }
            denominator[link.facIndex()] += demands[link.resIndex()] * decay.factor(link.minutes(), threshold);
        }

        // R_j = S_j / Σ…；分母为 0 时取 0，不抛异常（规则 7）
        double[] rates = new double[facilityCount];
        for (int j = 0; j < facilityCount; j++) {
            rates[j] = denominator[j] == 0 ? 0 : supply[j] / denominator[j];
        }

        // 第二步：A_i = Σ_j (R_j * f(t_ij))
        double[] scores = new double[demands.length];
        for (Link link : links) {
            if (link.minutes() > threshold) {
                continue;
            }
            scores[link.resIndex()] += rates[link.facIndex()] * decay.factor(link.minutes(), threshold);
        }
        return new Computation(rates, scores, capacityFallback);
    }

    public AccessibilityResp analyze(AccessibilityReq req) {
        int threshold = requireThreshold(req.getThresholdMinutes());
        Decay decay = Decay.parse(normalizeDecay(req.getDecay()));
        requireCapacityField(req.getCapacityField());
        String categoryL2 = requireCategory(req.getCategoryL2());
        String districtCode = blankToNull(req.getDistrictCode());

        Path matrix = requireMatrix();
        Path dataDir = matrix.getParent() == null ? Path.of(".") : matrix.getParent();
        Path facilityFile = requireDataFile(dataDir.resolve("clean").resolve("facility_clean.csv"), "设施清洗表");
        Path residentFile = requireDataFile(dataDir.resolve("clean").resolve("residential_clean.csv"), "居住点清洗表");

        List<Facility> facilities = loadFacilities(facilityFile, categoryL2, districtCode);
        if (facilities.isEmpty()) {
            log.info("可达性分析无设施 categoryL2={} districtCode={}", categoryL2, districtCode);
            throw new BizException(ErrorCode.NOT_FOUND);
        }
        List<Resident> residents = loadResidents(residentFile, districtCode);
        if (residents.isEmpty()) {
            throw new BizException(ErrorCode.DATA_NOT_READY);
        }

        long start = System.currentTimeMillis();
        String taskId = createTask(req);
        try {
            Map<String, Integer> facilityIndex = indexOf(facilities, Facility::code);
            Map<String, Integer> residentIndex = indexOf(residents, Resident::code);
            List<Link> links = loadLinks(matrix, facilityIndex, residentIndex, threshold);

            Double[] capacities = facilities.stream().map(Facility::capacity).toArray(Double[]::new);
            double[] demands = residents.stream().mapToDouble(Resident::demand).toArray();

            Computation computation = computeScores(capacities, demands, links, threshold, decay);
            double[] scores = computation.scores();
            AccessibilityResp.Stats stats = summarize(scores, computation.capacityFallback());
            double[] breaks = BreaksUtil.naturalBreaks(scores);

            int elapsedMs = (int) (System.currentTimeMillis() - start);
            if (elapsedMs > TIMEOUT_MS) {
                finishTask(taskId, elapsedMs, "TIMEOUT", "计算超时");
                throw new BizException(ErrorCode.TIMEOUT);
            }

            List<AccessibilityResp.Item> items = buildItems(residents, scores, breaks);
            finishTask(taskId, elapsedMs, "SUCCESS", null);
            saveResults(taskId, threshold, items);

            AccessibilityResp response = new AccessibilityResp();
            response.setTaskId(taskId);
            response.setElapsedMs(elapsedMs);
            response.setDecay(decay.name());
            response.setStats(stats);
            response.setBreaks(breaks);
            response.setResults(items);
            log.info("可达性分析完成 taskId={} 设施={} 居住点={} OD配对={} 用时={}ms",
                    taskId, facilities.size(), residents.size(), links.size(), elapsedMs);
            return response;
        } catch (BizException e) {
            markFailed(taskId, e.getErrorCode().getMsg());
            throw e;
        } catch (RuntimeException e) {
            markFailed(taskId, e.getMessage());
            throw e;
        }
    }

    // ---------------------------------------------------------------- 校验

    private int requireThreshold(Integer thresholdMinutes) {
        if (thresholdMinutes == null || !ALLOWED_THRESHOLDS.contains(thresholdMinutes)) {
            throw new BizException(ErrorCode.OUT_OF_RANGE);
        }
        return thresholdMinutes;
    }

    private String requireCategory(String categoryL2) {
        String value = blankToNull(categoryL2);
        if (value == null) {
            throw new BizException(ErrorCode.INVALID_PARAM);
        }
        return value.toUpperCase();
    }

    private String normalizeDecay(String decay) {
        String value = blankToNull(decay);
        if (value == null) {
            throw new BizException(ErrorCode.OUT_OF_RANGE);
        }
        return value.toUpperCase();
    }

    private void requireCapacityField(String capacityField) {
        String value = blankToNull(capacityField);
        if (value != null && !CAPACITY_FIELD.equalsIgnoreCase(value)) {
            throw new BizException(ErrorCode.OUT_OF_RANGE);
        }
    }

    // ---------------------------------------------------------------- 数据就绪

    private Path requireMatrix() {
        List<Map<String, Object>> active = jdbc.queryForList(
                "SELECT FILE_PATH FROM OD_MATRIX_META WHERE IS_ACTIVE = 1 LIMIT 1");
        if (active.isEmpty()) {
            log.warn("OD_MATRIX_META 无 IS_ACTIVE=1 记录，可达性分析不可用");
            throw new BizException(ErrorCode.DATA_NOT_READY);
        }
        Path path = resolvePath(matrixPath);
        if (path == null) {
            log.warn("OD 矩阵文件不存在 path={}", matrixPath);
            throw new BizException(ErrorCode.DATA_NOT_READY);
        }
        return path;
    }

    private Path requireDataFile(Path path, String label) {
        Path resolved = resolvePath(path.toString());
        if (resolved == null) {
            log.warn("{} 不存在 path={}", label, path);
            throw new BizException(ErrorCode.DATA_NOT_READY);
        }
        return resolved;
    }

    /** 相对路径在项目根与 backend/ 下都能解析（jar 常在 backend 目录启动）。 */
    private Path resolvePath(String configured) {
        if (configured == null || configured.isBlank()) {
            return null;
        }
        Path path = Path.of(configured);
        if (Files.isRegularFile(path)) {
            return path;
        }
        if (!path.isAbsolute()) {
            Path parentRelative = Path.of("..").resolve(configured);
            if (Files.isRegularFile(parentRelative)) {
                return parentRelative;
            }
        }
        return null;
    }

    // ---------------------------------------------------------------- 装载

    private List<Facility> loadFacilities(Path file, String categoryL2, String districtCode) {
        List<Facility> facilities = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            Map<String, Integer> header = readHeader(reader);
            int iCode = required(header, "FAC_CODE");
            int iCat = required(header, "CAT_L2");
            int iDistrict = required(header, "DISTRICT_CODE");
            int iLon = required(header, "LON");
            int iLat = required(header, "LAT");
            int iCapacity = required(header, "CAPACITY");

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                List<String> cells = splitCsv(line);
                if (cells.size() <= iCapacity) {
                    continue;
                }
                if (!categoryL2.equalsIgnoreCase(cells.get(iCat).trim())) {
                    continue;
                }
                String district = cells.get(iDistrict).trim();
                if (districtCode != null && !districtCode.equals(district)) {
                    continue;
                }
                facilities.add(new Facility(
                        cells.get(iCode).trim(),
                        district,
                        parseNullableDouble(cells.get(iCapacity)),
                        parseDouble(cells.get(iLon)),
                        parseDouble(cells.get(iLat))));
            }
        } catch (IOException e) {
            throw new BizException(ErrorCode.DATA_NOT_READY, e);
        }
        return facilities;
    }

    private List<Resident> loadResidents(Path file, String districtCode) {
        List<Resident> residents = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            Map<String, Integer> header = readHeader(reader);
            int iCode = required(header, "RES_CODE");
            int iName = required(header, "RES_NAME");
            int iDistrict = required(header, "DISTRICT_CODE");
            int iPop = required(header, "POP_EST");
            int iLon = required(header, "LON");
            int iLat = required(header, "LAT");

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                List<String> cells = splitCsv(line);
                if (cells.size() <= iLat) {
                    continue;
                }
                String district = cells.get(iDistrict).trim();
                if (districtCode != null && !districtCode.equals(district)) {
                    continue;
                }
                residents.add(new Resident(
                        cells.get(iCode).trim(),
                        cells.get(iName).trim(),
                        district,
                        parseDouble(cells.get(iPop)),
                        parseDouble(cells.get(iLon)),
                        parseDouble(cells.get(iLat))));
            }
        } catch (IOException e) {
            throw new BizException(ErrorCode.DATA_NOT_READY, e);
        }
        return residents;
    }

    private List<Link> loadLinks(Path matrix, Map<String, Integer> facilityIndex,
                                 Map<String, Integer> residentIndex, int threshold) {
        List<Link> links = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(matrix, StandardCharsets.UTF_8)) {
            Map<String, Integer> header = readHeader(reader);
            int iFac = required(header, "facCode");
            int iRes = required(header, "resCode");
            int iMinutes = required(header, "minutes");

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                List<String> cells = splitCsv(line);
                if (cells.size() <= iMinutes) {
                    continue;
                }
                Integer fac = facilityIndex.get(cells.get(iFac).trim());
                if (fac == null) {
                    continue;
                }
                Integer res = residentIndex.get(cells.get(iRes).trim());
                if (res == null) {
                    continue;
                }
                double minutes = parseDouble(cells.get(iMinutes));
                if (minutes <= threshold) {
                    links.add(new Link(fac, res, minutes));
                }
            }
        } catch (IOException e) {
            throw new BizException(ErrorCode.DATA_NOT_READY, e);
        }
        return links;
    }

    // ---------------------------------------------------------------- 组装

    private AccessibilityResp.Stats summarize(double[] scores, boolean capacityFallback) {
        double min = Double.MAX_VALUE;
        double max = -Double.MAX_VALUE;
        double sum = 0;
        for (double score : scores) {
            min = Math.min(min, score);
            max = Math.max(max, score);
            sum += score;
        }
        double[] sorted = scores.clone();
        java.util.Arrays.sort(sorted);
        int n = sorted.length;
        double p50 = n % 2 == 1 ? sorted[n / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0;

        AccessibilityResp.Stats stats = new AccessibilityResp.Stats();
        stats.setMin(round(min));
        stats.setMax(round(max));
        stats.setMean(round(sum / n));
        stats.setP50(round(p50));
        stats.setCapacityFallback(capacityFallback);
        return stats;
    }

    private List<AccessibilityResp.Item> buildItems(List<Resident> residents, double[] scores, double[] breaks) {
        List<AccessibilityResp.Item> items = new ArrayList<>(residents.size());
        for (int i = 0; i < residents.size(); i++) {
            Resident resident = residents.get(i);
            AccessibilityResp.Item item = new AccessibilityResp.Item();
            item.setUnitCode(resident.code());
            item.setUnitName(resident.name());
            item.setLon(resident.lon());
            item.setLat(resident.lat());
            item.setScore(round(scores[i]));
            item.setLevel(BreaksUtil.levelOf(scores[i], breaks));
            items.add(item);
        }
        return items;
    }

    // ---------------------------------------------------------------- 落库

    private String createTask(AccessibilityReq req) {
        String paramsJson;
        try {
            paramsJson = objectMapper.writeValueAsString(req);
        } catch (JsonProcessingException e) {
            paramsJson = "{}";
        }
        String prefix = "AC-" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + "-";
        for (int attempt = 0; attempt < 5; attempt++) {
            String maxTaskId = jdbc.query(
                    "SELECT COALESCE(MAX(TASK_ID), '') FROM ANALYSIS_TASK WHERE TASK_ID LIKE ?",
                    (ResultSetExtractor<String>) rs -> rs.next() ? rs.getString(1) : "",
                    prefix + "%");
            int seq = 1;
            if (maxTaskId != null && maxTaskId.length() > prefix.length()) {
                try {
                    seq = Integer.parseInt(maxTaskId.substring(prefix.length())) + 1;
                } catch (NumberFormatException ignored) {
                    seq = 1;
                }
            }
            String taskId = prefix + String.format("%04d", seq);
            try {
                jdbc.update("""
                        INSERT INTO ANALYSIS_TASK (TASK_ID, TASK_TYPE, PARAMS_JSON, STATUS, CREATE_TIME)
                        VALUES (?, ?, ?, 'RUNNING', NOW())
                        """, taskId, TASK_TYPE, paramsJson);
                return taskId;
            } catch (DuplicateKeyException e) {
                log.debug("任务号冲突，重试 taskId={}", taskId);
            }
        }
        throw new BizException(ErrorCode.SYSTEM_ERROR);
    }

    private void finishTask(String taskId, int elapsedMs, String status, String errorMsg) {
        jdbc.update("""
                UPDATE ANALYSIS_TASK
                   SET STATUS = ?, ELAPSED_MS = ?, ERROR_MSG = ?, FINISH_TIME = NOW()
                 WHERE TASK_ID = ?
                """, status, elapsedMs, errorMsg, taskId);
    }

    /** 失败标记为尽力而为：落库失败不得掩盖原始业务异常。 */
    private void markFailed(String taskId, String errorMsg) {
        try {
            String msg = errorMsg == null ? "未知错误" : errorMsg;
            finishTask(taskId, 0, "FAILED", msg.length() > 480 ? msg.substring(0, 480) : msg);
        } catch (RuntimeException e) {
            log.warn("更新失败任务状态出错 taskId={}: {}", taskId, e.getMessage());
        }
    }

    private void saveResults(String taskId, int threshold, List<AccessibilityResp.Item> items) {
        List<Object[]> batch = new ArrayList<>(items.size());
        for (AccessibilityResp.Item item : items) {
            batch.add(new Object[]{
                    taskId, threshold, item.getUnitCode(), item.getUnitName(),
                    item.getLon(), item.getLat(), item.getScore(), item.getLevel()});
        }
        jdbc.batchUpdate("""
                INSERT INTO ANALYSIS_RESULT
                    (TASK_ID, THRESHOLD, UNIT_CODE, UNIT_NAME, LON, LAT, SCORE, LEVEL, CREATE_TIME)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                """, batch);
    }

    // ---------------------------------------------------------------- 工具

    private static <T> Map<String, Integer> indexOf(List<T> items, java.util.function.Function<T, String> key) {
        Map<String, Integer> index = new HashMap<>(items.size() * 2);
        for (int i = 0; i < items.size(); i++) {
            index.put(key.apply(items.get(i)), i);
        }
        return index;
    }

    private static Map<String, Integer> readHeader(BufferedReader reader) throws IOException {
        String headerLine = reader.readLine();
        if (headerLine == null) {
            throw new IOException("CSV 为空");
        }
        if (headerLine.startsWith("\uFEFF")) {
            headerLine = headerLine.substring(1);
        }
        List<String> names = splitCsv(headerLine);
        Map<String, Integer> header = new LinkedHashMap<>();
        for (int i = 0; i < names.size(); i++) {
            header.put(names.get(i).trim(), i);
        }
        return header;
    }

    private static int required(Map<String, Integer> header, String name) throws IOException {
        Integer index = header.get(name);
        if (index == null) {
            throw new IOException("CSV 缺少列 " + name);
        }
        return index;
    }

    /** 引号感知的 CSV 拆分，处理 "a,b" 与 "" 转义。 */
    private static List<String> splitCsv(String line) {
        List<String> cells = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (inQuotes) {
                if (ch == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        cell.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    cell.append(ch);
                }
            } else if (ch == '"') {
                inQuotes = true;
            } else if (ch == ',') {
                cells.add(cell.toString());
                cell.setLength(0);
            } else {
                cell.append(ch);
            }
        }
        cells.add(cell.toString());
        return cells;
    }

    private static double parseDouble(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }
        return Double.parseDouble(value.trim());
    }

    private static Double parseNullableDouble(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return Double.parseDouble(value.trim());
    }

    private static BigDecimal round(double value) {
        return BigDecimal.valueOf(value).setScale(SCALE, RoundingMode.HALF_UP);
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

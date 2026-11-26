package com.example.gis.service;

import com.example.gis.client.IgsClient;
import com.example.gis.common.BizException;
import com.example.gis.common.ErrorCode;
import com.example.gis.dto.ServiceAreaReq;
import com.example.gis.dto.ServiceAreaResp;
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
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * API-05 网络服务区分析（SPEC/03-api-contract.md §7）。
 *
 * <p>调用链：请求 → 参数校验 → 24h 幂等缓存 → 设施中心点 → IGServer 功能服务
 * （{@code igs/rest/mrfws/execute/{flowNo}}，即 T-021 发布的"服务区分析"工作流）
 * → 几何落库 → 覆盖率。
 *
 * <p>硬性约束：
 * <ul>
 *   <li>MUST NOT 用缓冲区代替服务区 —— 几何全部来自 IGServer 返回值；</li>
 *   <li>MUST NOT 返回空 geomWkt 却标记成功 —— IgsClient 已在缺几何时抛 3002；</li>
 *   <li>计算耗时 &gt; 55s → 4001。</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ServiceAreaService {

    static final Set<Integer> ALLOWED_THRESHOLDS = Set.of(5, 10, 15);
    static final int MAX_THRESHOLDS = 3;
    static final int TIMEOUT_MS = 55_000;
    static final String TASK_TYPE = "SERVICE_AREA";
    private static final int CACHE_HOURS = 24;
    private static final int RATE_SCALE = 3;

    /** 步行按 4.8 km/h 折算，驾车按 30 km/h 折算，用于把"分钟阈值"换成路网搜索半径（km）。 */
    private static final double WALK_KM_PER_MIN = 0.08;
    private static final double DRIVE_KM_PER_MIN = 0.50;

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final IgsClient igsClient;

    @Value("${igs.serviceArea.flowNo:600366}")
    private int flowNo;

    @Value("${igs.serviceArea.netClsUrl:}")
    private String netClsUrl;

    @Value("${igs.serviceArea.dataDir:./data}")
    private String dataDir;

    @Value("${igs.serviceArea.maxCenters:200}")
    private int maxCenters;

    /** 居住点，覆盖判定只需平面坐标 + 展示字段。 */
    public record Point(String code, String name, String streetCode, double lon, double lat) {
    }

    /** 设施中心点。 */
    public record Facility(String code, double lon, double lat, Double capacity) {
    }

    // ================================================================ 主流程

    public ServiceAreaResp analyze(ServiceAreaReq req) {
        List<Integer> thresholds = normalizeThresholds(req.getThresholds());
        String categoryL2 = requireCategory(req.getCategoryL2());
        String districtCode = blankToNull(req.getDistrictCode());

        List<Point> residents = loadResidents(districtCode);
        if (residents.isEmpty()) {
            log.warn("服务区分析无居住点 districtCode={}", districtCode);
            throw new BizException(ErrorCode.DATA_NOT_READY);
        }

        String fingerprint = fingerprint(req, thresholds, categoryL2, districtCode);

        // 规则 5：相同 params 24h 内命中缓存，taskId 相同且 elapsedMs=0
        ServiceAreaResp cached = loadCache(fingerprint, residents);
        if (cached != null) {
            log.info("服务区分析命中缓存 taskId={}", cached.getTaskId());
            return cached;
        }

        List<Facility> facilities = loadFacilities(categoryL2, districtCode);
        if (facilities.isEmpty()) {
            throw new BizException(ErrorCode.NOT_FOUND);
        }

        long start = System.currentTimeMillis();
        String taskId = createTask(fingerprint);
        try {
            String centerPoints = buildCenterPoints(facilities);
            List<ServiceAreaResp.Area> areas = new ArrayList<>(thresholds.size());
            boolean[] covered = null;
            for (Integer threshold : thresholds) {
                String wkt = igsClient.runServiceArea(
                        flowNo, netClsUrl, centerPoints, radiusKm(threshold, req.getTravelMode()));
                boolean[] flags = coverage(wkt, residents);
                ServiceAreaResp.Area area = new ServiceAreaResp.Area();
                area.setThreshold(threshold);
                area.setGeomWkt(wkt);
                area.setCoveredCommunityCount(countTrue(flags));
                areas.add(area);
                covered = flags;
            }

            int elapsedMs = (int) (System.currentTimeMillis() - start);
            if (elapsedMs > TIMEOUT_MS) {
                finishTask(taskId, elapsedMs, "TIMEOUT", "计算超时");
                throw new BizException(ErrorCode.TIMEOUT);
            }

            ServiceAreaResp resp = new ServiceAreaResp();
            resp.setTaskId(taskId);
            resp.setElapsedMs(elapsedMs);
            resp.setAreas(areas);
            resp.setSummary(summary(residents.size(), covered == null ? 0 : countTrue(covered)));
            resp.setUncoveredList(uncoveredList(residents, covered, loadStreetNames()));

            finishTask(taskId, elapsedMs, "SUCCESS", null);
            saveResults(taskId, areas);
            log.info("服务区分析完成 taskId={} 设施={} 居住点={} 阈值={} 用时={}ms",
                    taskId, facilities.size(), residents.size(), thresholds, elapsedMs);
            return resp;
        } catch (BizException e) {
            markFailed(taskId, e.getErrorCode().getMsg());
            throw e;
        } catch (RuntimeException e) {
            markFailed(taskId, e.getMessage());
            throw e;
        }
    }

    // ================================================================ 纯函数（可单测）

    /** 规则 1/2：去重 + 升序；长度 1–3，值 ∈ {5,10,15}，否则 1002。 */
    static List<Integer> normalizeThresholds(List<Integer> raw) {
        if (raw == null || raw.isEmpty()) {
            throw new BizException(ErrorCode.OUT_OF_RANGE);
        }
        Set<Integer> unique = new LinkedHashSet<>();
        for (Integer value : raw) {
            if (value == null || !ALLOWED_THRESHOLDS.contains(value)) {
                throw new BizException(ErrorCode.OUT_OF_RANGE);
            }
            unique.add(value);
        }
        if (unique.size() > MAX_THRESHOLDS) {
            throw new BizException(ErrorCode.OUT_OF_RANGE);
        }
        List<Integer> sorted = new ArrayList<>(unique);
        sorted.sort(Integer::compareTo);
        return sorted;
    }

    /** 分钟阈值 → 路网搜索半径（km）。 */
    static double radiusKm(int minutes, String travelMode) {
        double speed = "DRIVE".equalsIgnoreCase(travelMode) ? DRIVE_KM_PER_MIN : WALK_KM_PER_MIN;
        return BigDecimal.valueOf(minutes * speed).setScale(3, RoundingMode.HALF_UP).doubleValue();
    }

    /**
     * 判断每个居住点是否落在服务区几何内。
     *
     * <p>WKT 解析为环列表，用<b>奇偶规则</b>判定：落在奇数个环内即被覆盖。
     * 这样 MULTIPOLYGON 的多个独立面、以及带洞的 POLYGON 都能正确处理，
     * 无需区分外环与内环。
     */
    static boolean[] coverage(String wkt, List<Point> points) {
        List<double[][]> rings = parseRings(wkt);
        boolean[] flags = new boolean[points.size()];
        for (int i = 0; i < points.size(); i++) {
            Point point = points.get(i);
            int inside = 0;
            for (double[][] ring : rings) {
                if (ringContains(ring, point.lon(), point.lat())) {
                    inside++;
                }
            }
            flags[i] = (inside % 2) == 1;
        }
        return flags;
    }

    /** 只取最内层括号，即每个坐标环。 */
    static List<double[][]> parseRings(String wkt) {
        List<double[][]> rings = new ArrayList<>();
        if (wkt == null || wkt.isBlank()) {
            return rings;
        }
        Matcher matcher = Pattern.compile("\\(([^()]*)\\)").matcher(wkt);
        while (matcher.find()) {
            String content = matcher.group(1).trim();
            if (content.isEmpty()) {
                continue;
            }
            String[] pairs = content.split(",");
            if (pairs.length < 3) {
                continue;
            }
            double[][] ring = new double[pairs.length][2];
            boolean valid = true;
            for (int i = 0; i < pairs.length; i++) {
                String[] xy = pairs[i].trim().split("\\s+");
                if (xy.length < 2) {
                    valid = false;
                    break;
                }
                try {
                    ring[i][0] = Double.parseDouble(xy[0]);
                    ring[i][1] = Double.parseDouble(xy[1]);
                } catch (NumberFormatException e) {
                    valid = false;
                    break;
                }
            }
            if (valid) {
                rings.add(ring);
            }
        }
        return rings;
    }

    /** 射线法：点是否在单个环内。 */
    static boolean ringContains(double[][] ring, double x, double y) {
        boolean inside = false;
        for (int i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            double xi = ring[i][0];
            double yi = ring[i][1];
            double xj = ring[j][0];
            double yj = ring[j][1];
            boolean cross = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (cross) {
                inside = !inside;
            }
        }
        return inside;
    }

    static int countTrue(boolean[] flags) {
        int count = 0;
        for (boolean flag : flags) {
            if (flag) {
                count++;
            }
        }
        return count;
    }

    /** 规则 3：coverageRate = 1 - uncovered/total，保留 3 位小数。 */
    static ServiceAreaResp.Summary summary(int total, int covered) {
        ServiceAreaResp.Summary summary = new ServiceAreaResp.Summary();
        int uncovered = Math.max(0, total - covered);
        summary.setTotalCommunity(total);
        summary.setUncoveredCommunity(uncovered);
        double rate = total == 0 ? 0 : 1.0 - (double) uncovered / total;
        summary.setCoverageRate(BigDecimal.valueOf(rate).setScale(RATE_SCALE, RoundingMode.HALF_UP).doubleValue());
        return summary;
    }

    static List<ServiceAreaResp.Uncovered> uncoveredList(List<Point> points, boolean[] covered,
                                                         Map<String, String> streetNames) {
        List<ServiceAreaResp.Uncovered> result = new ArrayList<>();
        if (covered == null) {
            return result;
        }
        for (int i = 0; i < points.size(); i++) {
            if (covered[i]) {
                continue;
            }
            Point point = points.get(i);
            ServiceAreaResp.Uncovered item = new ServiceAreaResp.Uncovered();
            item.setResCode(point.code());
            item.setResName(point.name());
            item.setStreetName(streetNames.getOrDefault(point.streetCode(), point.streetCode()));
            result.add(item);
        }
        return result;
    }

    static String buildCenterPoints(List<Facility> facilities) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < facilities.size(); i++) {
            Facility facility = facilities.get(i);
            if (i > 0) {
                sb.append(',');
            }
            sb.append("{\"x\":").append(facility.lon())
                    .append(",\"y\":").append(facility.lat())
                    .append(",\"capacity\":").append(facility.capacity() == null ? 1 : facility.capacity())
                    .append('}');
        }
        return sb.append(']').toString();
    }

    // ================================================================ 校验

    private String requireCategory(String categoryL2) {
        String value = blankToNull(categoryL2);
        if (value == null) {
            throw new BizException(ErrorCode.INVALID_PARAM);
        }
        String upper = value.toUpperCase();
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM DICT_CATEGORY WHERE CAT_L2 = ?", Integer.class, upper);
        if (count == null || count == 0) {
            throw new BizException(ErrorCode.NOT_FOUND);
        }
        return upper;
    }

    /** 参数指纹：键排序后序列化，保证同参数同指纹。 */
    private String fingerprint(ServiceAreaReq req, List<Integer> thresholds,
                               String categoryL2, String districtCode) {
        Map<String, Object> canonical = new TreeMap<>();
        canonical.put("categoryL2", categoryL2);
        canonical.put("travelMode", req.getTravelMode().toUpperCase());
        canonical.put("thresholds", thresholds);
        canonical.put("districtCode", districtCode);
        canonical.put("dissolve", req.getDissolve() == null || req.getDissolve());
        try {
            return objectMapper.writeValueAsString(canonical);
        } catch (JsonProcessingException e) {
            throw new BizException(ErrorCode.SYSTEM_ERROR);
        }
    }

    // ================================================================ 缓存

    /** 规则 5：24h 内相同 params 直接复用，elapsedMs=0。 */
    private ServiceAreaResp loadCache(String fingerprint, List<Point> residents) {
        List<Map<String, Object>> tasks = jdbc.queryForList("""
                SELECT TASK_ID, PARAMS_JSON FROM ANALYSIS_TASK
                 WHERE TASK_TYPE = ? AND STATUS = 'SUCCESS'
                   AND FINISH_TIME >= DATE_SUB(NOW(), INTERVAL ? HOUR)
                 ORDER BY FINISH_TIME DESC
                """, TASK_TYPE, CACHE_HOURS);
        for (Map<String, Object> task : tasks) {
            if (!fingerprint.equals(canonicalJson(String.valueOf(task.get("PARAMS_JSON"))))) {
                continue;
            }
            String taskId = String.valueOf(task.get("TASK_ID"));
            List<ServiceAreaResp.Area> areas = loadAreas(taskId, residents);
            if (areas.isEmpty()) {
                continue;
            }
            boolean[] covered = null;
            if (!areas.isEmpty()) {
                covered = coverage(areas.get(areas.size() - 1).getGeomWkt(), residents);
            }
            ServiceAreaResp resp = new ServiceAreaResp();
            resp.setTaskId(taskId);
            resp.setElapsedMs(0);
            resp.setAreas(areas);
            resp.setSummary(summary(residents.size(), covered == null ? 0 : countTrue(covered)));
            resp.setUncoveredList(uncoveredList(residents, covered, loadStreetNames()));
            return resp;
        }
        return null;
    }

    private List<ServiceAreaResp.Area> loadAreas(String taskId, List<Point> residents) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT THRESHOLD, GEOM_WKT FROM ANALYSIS_RESULT
                 WHERE TASK_ID = ? AND THRESHOLD IS NOT NULL
                 ORDER BY THRESHOLD ASC
                """, taskId);
        List<ServiceAreaResp.Area> areas = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            Object wkt = row.get("GEOM_WKT");
            if (wkt == null || String.valueOf(wkt).isBlank()) {
                continue;
            }
            ServiceAreaResp.Area area = new ServiceAreaResp.Area();
            area.setThreshold(((Number) row.get("THRESHOLD")).intValue());
            area.setGeomWkt(String.valueOf(wkt));
            area.setCoveredCommunityCount(countTrue(coverage(area.getGeomWkt(), residents)));
            areas.add(area);
        }
        return areas;
    }

    /** 把任意键序的 JSON 归一化成键排序形式，供指纹比较。 */
    private String canonicalJson(String json) {
        if (json == null || json.isBlank()) {
            return "";
        }
        try {
            Map<String, Object> map = objectMapper.readValue(json, new com.fasterxml.jackson.core.type.TypeReference<TreeMap<String, Object>>() {
            });
            return objectMapper.writeValueAsString(map);
        } catch (JsonProcessingException e) {
            return json;
        }
    }

    // ================================================================ 数据装载

    private List<Facility> loadFacilities(String categoryL2, String districtCode) {
        Path file = resolveDataFile("clean/facility_clean.csv");
        List<Facility> facilities = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            Map<String, Integer> header = readHeader(reader);
            int iCode = required(header, "FAC_CODE");
            int iCat = required(header, "CAT_L2");
            int iDistrict = required(header, "DISTRICT_CODE");
            int iLon = required(header, "LON");
            int iLat = required(header, "LAT");
            Integer iCapacity = header.get("CAPACITY");

            String line;
            while ((line = reader.readLine()) != null && facilities.size() < maxCenters) {
                if (line.isBlank()) {
                    continue;
                }
                List<String> cells = splitCsv(line);
                if (cells.size() <= iLat) {
                    continue;
                }
                if (!categoryL2.equalsIgnoreCase(cells.get(iCat).trim())) {
                    continue;
                }
                if (districtCode != null && !districtCode.equals(cells.get(iDistrict).trim())) {
                    continue;
                }
                facilities.add(new Facility(
                        cells.get(iCode).trim(),
                        parseDouble(cells.get(iLon)),
                        parseDouble(cells.get(iLat)),
                        iCapacity != null && cells.size() > iCapacity
                                ? parseNullableDouble(cells.get(iCapacity)) : null));
            }
        } catch (IOException e) {
            throw new BizException(ErrorCode.DATA_NOT_READY, e);
        }
        return facilities;
    }

    private List<Point> loadResidents(String districtCode) {
        Path file = resolveDataFile("clean/residential_clean.csv");
        List<Point> points = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            Map<String, Integer> header = readHeader(reader);
            int iCode = required(header, "RES_CODE");
            int iName = required(header, "RES_NAME");
            int iStreet = required(header, "STREET_CODE");
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
                if (districtCode != null && cells.size() > 2
                        && !districtCode.equals(cells.get(2).trim())) {
                    continue;
                }
                points.add(new Point(
                        cells.get(iCode).trim(),
                        cells.get(iName).trim(),
                        cells.get(iStreet).trim(),
                        parseDouble(cells.get(iLon)),
                        parseDouble(cells.get(iLat))));
            }
        } catch (IOException e) {
            throw new BizException(ErrorCode.DATA_NOT_READY, e);
        }
        return points;
    }

    private Map<String, String> loadStreetNames() {
        Map<String, String> names = new HashMap<>();
        for (Map<String, Object> row : jdbc.queryForList("SELECT STREET_CODE, STREET_NAME FROM DICT_STREET")) {
            names.put(String.valueOf(row.get("STREET_CODE")), String.valueOf(row.get("STREET_NAME")));
        }
        return names;
    }

    private Path resolveDataFile(String relative) {
        Path path = Path.of(dataDir).resolve(relative);
        if (Files.isRegularFile(path)) {
            return path;
        }
        Path relativeToParent = Path.of("..").resolve(Path.of(dataDir)).resolve(relative);
        if (Files.isRegularFile(relativeToParent)) {
            return relativeToParent;
        }
        log.warn("数据文件不存在 path={}", path);
        throw new BizException(ErrorCode.DATA_NOT_READY);
    }

    // ================================================================ 落库

    private String createTask(String fingerprint) {
        String prefix = "SA-" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + "-";
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
                        """, taskId, TASK_TYPE, fingerprint);
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

    private void markFailed(String taskId, String errorMsg) {
        try {
            String msg = errorMsg == null ? "未知错误" : errorMsg;
            finishTask(taskId, 0, "FAILED", msg.length() > 480 ? msg.substring(0, 480) : msg);
        } catch (RuntimeException e) {
            log.warn("更新失败任务状态出错 taskId={}: {}", taskId, e.getMessage());
        }
    }

    private void saveResults(String taskId, List<ServiceAreaResp.Area> areas) {
        List<Object[]> batch = new ArrayList<>(areas.size());
        for (ServiceAreaResp.Area area : areas) {
            batch.add(new Object[]{taskId, area.getThreshold(), area.getGeomWkt()});
        }
        jdbc.batchUpdate("""
                INSERT INTO ANALYSIS_RESULT (TASK_ID, THRESHOLD, GEOM_WKT, CREATE_TIME)
                VALUES (?, ?, ?, NOW())
                """, batch);
    }

    // ================================================================ CSV 工具

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
        try {
            return Double.parseDouble(value.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static Double parseNullableDouble(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Double.parseDouble(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

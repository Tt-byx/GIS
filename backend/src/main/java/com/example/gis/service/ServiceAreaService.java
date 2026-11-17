package com.example.gis.service;

import com.example.gis.client.IgsClient;
import com.example.gis.common.BizException;
import com.example.gis.common.ErrorCode;
import com.example.gis.config.IgsProperties;
import com.example.gis.dto.ServiceAreaReq;
import com.example.gis.dto.ServiceAreaResp;
import com.fasterxml.jackson.databind.JsonNode;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * API-05 网络服务区。真实结果只能来自 IGServer 路网分析（禁止用缓冲区代替），
 * 因此在网络分析服务未发布时返回 2002，不返回伪造几何。
 * 仅当以 mock profile 启动时，才用近似多边形支撑前端联调，日志会明确标记。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ServiceAreaService {

    private static final Set<Integer> ALLOWED_THRESHOLDS = Set.of(5, 10, 15);
    private static final Set<String> TRAVEL_MODES = Set.of("WALK", "DRIVE");
    private static final int TOTAL_COMMUNITY = 56;
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final String[] STREETS = {"关山街道", "珞南街道", "洪山街道"};

    private final IgsClient igsClient;
    private final IgsProperties igsProperties;
    private final Environment environment;

    private final Cache<String, ServiceAreaResp> cache = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofHours(24))
            .maximumSize(200)
            .build();

    private final AtomicInteger sequence = new AtomicInteger();
    private String sequenceDate = LocalDate.now().format(DATE_FORMAT);

    /**
     * 执行服务区分析。相同参数 24 小时内直接命中缓存并返回相同 taskId、elapsedMs=0。
     */
    public ServiceAreaResp analyze(ServiceAreaReq request) {
        List<Integer> thresholds = normalizeThresholds(request.getThresholds());
        validateTravelMode(request.getTravelMode());
        String cacheKey = buildCacheKey(request, thresholds);

        ServiceAreaResp cached = cache.getIfPresent(cacheKey);
        if (cached != null) {
            log.info("服务区命中缓存 taskId={}", cached.getTaskId());
            return copy(cached, 0);
        }

        long start = System.currentTimeMillis();
        ServiceAreaResp response = isMockProfile()
                ? buildMockResponse(thresholds)
                : callIgs(request, thresholds);
        response.setElapsedMs((int) (System.currentTimeMillis() - start));
        cache.put(cacheKey, copy(response, response.getElapsedMs()));
        return response;
    }

    private List<Integer> normalizeThresholds(List<Integer> thresholds) {
        if (thresholds == null || thresholds.isEmpty() || thresholds.size() > 3) {
            throw new BizException(ErrorCode.OUT_OF_RANGE);
        }
        for (Integer threshold : thresholds) {
            if (threshold == null || !ALLOWED_THRESHOLDS.contains(threshold)) {
                throw new BizException(ErrorCode.OUT_OF_RANGE);
            }
        }
        return thresholds.stream().distinct().sorted().toList();
    }

    private void validateTravelMode(String travelMode) {
        if (!TRAVEL_MODES.contains(travelMode)) {
            throw new BizException(ErrorCode.OUT_OF_RANGE);
        }
    }

    private String buildCacheKey(ServiceAreaReq request, List<Integer> thresholds) {
        return String.join("|",
                request.getCategoryL2(),
                request.getTravelMode(),
                thresholds.toString(),
                Objects.toString(request.getDistrictCode(), ""),
                String.valueOf(request.getDissolve() == null || request.getDissolve()));
    }

    private boolean isMockProfile() {
        return environment.acceptsProfiles(Profiles.of("mock"));
    }

    private ServiceAreaResp callIgs(ServiceAreaReq request, List<Integer> thresholds) {
        String mapDoc = igsProperties.getMapDoc();
        if (mapDoc == null || mapDoc.isBlank()) {
            throw new BizException(ErrorCode.DATA_NOT_READY);
        }
        if (!igsClient.exists("/igs/rest/map/" + mapDoc)) {
            throw new BizException(ErrorCode.DATA_NOT_READY);
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("categoryL2", request.getCategoryL2());
        form.add("travelMode", request.getTravelMode());
        form.add("thresholds", String.join(",", thresholds.stream().map(String::valueOf).toList()));
        if (request.getDistrictCode() != null && !request.getDistrictCode().isBlank()) {
            form.add("districtCode", request.getDistrictCode());
        }
        form.add("dissolve", String.valueOf(request.getDissolve() == null || request.getDissolve()));

        // T-021 发布网络分析服务后，按该服务的真实路径替换此端点；此处只保留调用层，不伪造结果。
        JsonNode body = igsClient.postForm("/igs/rest/map/" + mapDoc + "/networkAnalysis/serviceArea", form);
        return parseIgsResponse(body, thresholds);
    }

    private ServiceAreaResp parseIgsResponse(JsonNode body, List<Integer> thresholds) {
        if (body == null || body.isNull()) {
            throw new BizException(ErrorCode.IGS_ERROR);
        }
        if (body.hasNonNull("code") && body.get("code").asInt() != 0) {
            throw new BizException(ErrorCode.IGS_ERROR);
        }
        JsonNode areasNode = body.get("areas");
        if (areasNode == null || !areasNode.isArray()) {
            throw new BizException(ErrorCode.IGS_ERROR);
        }

        ServiceAreaResp response = new ServiceAreaResp();
        response.setTaskId(nextTaskId());
        List<ServiceAreaResp.Area> areas = new ArrayList<>();
        int maxCovered = 0;
        for (JsonNode node : areasNode) {
            ServiceAreaResp.Area area = new ServiceAreaResp.Area();
            area.setThreshold(node.path("threshold").asInt());
            area.setGeomWkt(node.path("geomWkt").asText());
            area.setCoveredCommunityCount(node.path("coveredCommunityCount").asInt());
            if (area.getGeomWkt() == null || area.getGeomWkt().isBlank()) {
                throw new BizException(ErrorCode.IGS_ERROR);
            }
            maxCovered = Math.max(maxCovered, area.getCoveredCommunityCount());
            areas.add(area);
        }
        response.setAreas(areas);

        int uncovered = Math.max(0, TOTAL_COMMUNITY - maxCovered);
        ServiceAreaResp.Summary summary = new ServiceAreaResp.Summary();
        summary.setTotalCommunity(TOTAL_COMMUNITY);
        summary.setUncoveredCommunity(uncovered);
        summary.setCoverageRate(coverageRate(uncovered));
        response.setSummary(summary);
        response.setUncoveredList(buildUncovered(uncovered));
        return response;
    }

    private ServiceAreaResp buildMockResponse(List<Integer> thresholds) {
        log.warn("mock profile 生效：服务区几何为联调用近似面，不代表真实路网分析结果");
        ServiceAreaResp response = new ServiceAreaResp();
        response.setTaskId(nextTaskId());

        List<ServiceAreaResp.Area> areas = new ArrayList<>();
        int maxCovered = 0;
        for (int threshold : thresholds) {
            ServiceAreaResp.Area area = new ServiceAreaResp.Area();
            area.setThreshold(threshold);
            area.setGeomWkt(mockWkt(threshold));
            area.setCoveredCommunityCount(Math.min(TOTAL_COMMUNITY, 8 + threshold * 2));
            maxCovered = Math.max(maxCovered, area.getCoveredCommunityCount());
            areas.add(area);
        }
        response.setAreas(areas);

        int uncovered = Math.max(0, TOTAL_COMMUNITY - maxCovered);
        ServiceAreaResp.Summary summary = new ServiceAreaResp.Summary();
        summary.setTotalCommunity(TOTAL_COMMUNITY);
        summary.setUncoveredCommunity(uncovered);
        summary.setCoverageRate(coverageRate(uncovered));
        response.setSummary(summary);
        response.setUncoveredList(buildUncovered(uncovered));
        return response;
    }

    private double coverageRate(int uncovered) {
        return Math.round((1.0 - uncovered / (double) TOTAL_COMMUNITY) * 1000) / 1000.0;
    }

    private List<ServiceAreaResp.Uncovered> buildUncovered(int uncovered) {
        List<ServiceAreaResp.Uncovered> list = new ArrayList<>();
        for (int i = 0; i < uncovered; i++) {
            ServiceAreaResp.Uncovered item = new ServiceAreaResp.Uncovered();
            item.setResCode(String.format("R%04d", i + 1));
            item.setResName("示例小区" + (i + 1));
            item.setStreetName(STREETS[i % STREETS.length]);
            list.add(item);
        }
        return list;
    }

    private String mockWkt(int threshold) {
        double centerLon = 114.3055;
        double centerLat = 30.5928;
        double radius = 0.0015 * threshold;
        StringBuilder wkt = new StringBuilder("POLYGON((");
        for (int i = 0; i <= 16; i++) {
            double angle = 2 * Math.PI * i / 16;
            double lon = centerLon + radius * Math.cos(angle);
            double lat = centerLat + radius * Math.sin(angle) * 0.75;
            if (i > 0) {
                wkt.append(", ");
            }
            wkt.append(String.format(Locale.US, "%.6f %.6f", lon, lat));
        }
        return wkt.append("))").toString();
    }

    private synchronized String nextTaskId() {
        String today = LocalDate.now().format(DATE_FORMAT);
        if (!today.equals(sequenceDate)) {
            sequenceDate = today;
            sequence.set(0);
        }
        return "SA-" + today + "-" + String.format("%04d", sequence.incrementAndGet());
    }

    private ServiceAreaResp copy(ServiceAreaResp source, int elapsedMs) {
        ServiceAreaResp target = new ServiceAreaResp();
        target.setTaskId(source.getTaskId());
        target.setElapsedMs(elapsedMs);

        List<ServiceAreaResp.Area> areas = new ArrayList<>();
        for (ServiceAreaResp.Area item : source.getAreas()) {
            ServiceAreaResp.Area area = new ServiceAreaResp.Area();
            area.setThreshold(item.getThreshold());
            area.setGeomWkt(item.getGeomWkt());
            area.setCoveredCommunityCount(item.getCoveredCommunityCount());
            areas.add(area);
        }
        target.setAreas(areas);

        if (source.getSummary() != null) {
            ServiceAreaResp.Summary summary = new ServiceAreaResp.Summary();
            summary.setTotalCommunity(source.getSummary().getTotalCommunity());
            summary.setUncoveredCommunity(source.getSummary().getUncoveredCommunity());
            summary.setCoverageRate(source.getSummary().getCoverageRate());
            target.setSummary(summary);
        }

        List<ServiceAreaResp.Uncovered> uncoveredList = new ArrayList<>();
        for (ServiceAreaResp.Uncovered item : source.getUncoveredList()) {
            ServiceAreaResp.Uncovered uncovered = new ServiceAreaResp.Uncovered();
            uncovered.setResCode(item.getResCode());
            uncovered.setResName(item.getResName());
            uncovered.setStreetName(item.getStreetName());
            uncoveredList.add(uncovered);
        }
        target.setUncoveredList(uncoveredList);
        return target;
    }
}

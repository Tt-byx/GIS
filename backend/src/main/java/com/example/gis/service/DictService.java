package com.example.gis.service;

import com.example.gis.dto.DictResponse;
import com.example.gis.mapper.DictCategoryMapper;
import com.example.gis.mapper.DictConfigMapper;
import com.example.gis.mapper.DictDistrictMapper;
import com.example.gis.mapper.DictStreetMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * API-01 字典与地图令牌（SPEC/03-api-contract.md §3）。
 *
 * 规则要点：
 * 1. categories 顺序完全由 SQL 的 SORT_NO 决定，本类只按出现顺序分组，不得重排；
 * 2. tiandituToken 来自 SYS_CONFIG，占位符 __FILL_AT_DEPLOY__ 必须转成空字符串，
 *    且令牌值不得写入日志；
 * 3. streets 允许为空数组（街道字典尚未灌数），不得因此报错；
 * 4. 不返回任何设施数据，不返回数据库原始列名。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DictService {

    /** SYS_CONFIG 中令牌未注入时使用的占位符，见 db/seed.sql。 */
    static final String TOKEN_PLACEHOLDER = "__FILL_AT_DEPLOY__";

    private static final String KEY_TOKEN = "TIANDITU_TOKEN";
    private static final String KEY_DATA_DATE = "DATA_DATE";
    private static final int EXPECTED_L1_COUNT = 5;
    private static final int EXPECTED_DISTRICT_COUNT = 3;

    private final DictCategoryMapper categoryMapper;
    private final DictDistrictMapper districtMapper;
    private final DictStreetMapper streetMapper;
    private final DictConfigMapper configMapper;

    public DictResponse dict() {
        List<DictCategoryMapper.Row> categoryRows = categoryMapper.findAllOrderBySortNo();
        List<DictDistrictMapper.Row> districtRows = districtMapper.findAllOrderBySortNo();
        List<DictStreetMapper.Row> streetRows = streetMapper.findAllOrderBySortNo();

        DictResponse response = new DictResponse();
        response.setCategories(groupCategories(categoryRows));
        response.setDistricts(toDistricts(districtRows));
        response.setStreets(toStreets(streetRows));
        response.setTiandituToken(readToken());
        response.setDataDate(readDataDate());

        warnIfDictionaryDrift(response);
        return response;
    }

    /**
     * 按 l1 分组，分组顺序与 children 顺序均沿用 SORT_NO 升序的查询结果。
     * 大类名与颜色取该大类首条中类的值，字典中同一 l1 的这些列是冗余一致的。
     */
    private List<DictResponse.Category> groupCategories(List<DictCategoryMapper.Row> rows) {
        Map<String, DictResponse.Category> grouped = new LinkedHashMap<>();
        for (DictCategoryMapper.Row row : rows) {
            DictResponse.Category category = grouped.computeIfAbsent(row.getL1(), l1 -> {
                DictResponse.Category created = new DictResponse.Category();
                created.setL1(row.getL1());
                created.setL1Name(row.getL1Name());
                created.setColor(row.getColor());
                created.setChildren(new ArrayList<>());
                return created;
            });

            DictResponse.Child child = new DictResponse.Child();
            child.setL2(row.getL2());
            child.setL2Name(row.getL2Name());
            child.setLifeCircle(row.getLifeCircle());
            category.getChildren().add(child);
        }
        return new ArrayList<>(grouped.values());
    }

    private List<DictResponse.District> toDistricts(List<DictDistrictMapper.Row> rows) {
        List<DictResponse.District> districts = new ArrayList<>(rows.size());
        for (DictDistrictMapper.Row row : rows) {
            DictResponse.District district = new DictResponse.District();
            district.setCode(row.getCode());
            district.setName(row.getName());
            districts.add(district);
        }
        return districts;
    }

    private List<DictResponse.Street> toStreets(List<DictStreetMapper.Row> rows) {
        List<DictResponse.Street> streets = new ArrayList<>(rows.size());
        for (DictStreetMapper.Row row : rows) {
            DictResponse.Street street = new DictResponse.Street();
            street.setCode(row.getCode());
            street.setName(row.getName());
            street.setDistrictCode(row.getDistrictCode());
            streets.add(street);
        }
        return streets;
    }

    /** 占位符与空值统一转为空字符串，避免前端把占位符当令牌打到天地图。 */
    private String readToken() {
        String token = configMapper.findValue(KEY_TOKEN);
        if (token == null || token.isBlank() || TOKEN_PLACEHOLDER.equals(token.trim())) {
            return "";
        }
        return token.trim();
    }

    private String readDataDate() {
        String dataDate = configMapper.findValue(KEY_DATA_DATE);
        return dataDate == null ? "" : dataDate.trim();
    }

    /** 数量与契约不符时只告警不返回错误码：契约 §3 的错误情形仅有数据库不可达。 */
    private void warnIfDictionaryDrift(DictResponse response) {
        if (response.getCategories().size() != EXPECTED_L1_COUNT) {
            log.warn("字典大类数量异常，期望 {} 实际 {}，请检查 DICT_CATEGORY 是否已灌数",
                    EXPECTED_L1_COUNT, response.getCategories().size());
        }
        if (response.getDistricts().size() != EXPECTED_DISTRICT_COUNT) {
            log.warn("字典行政区数量异常，期望 {} 实际 {}，请检查 DICT_DISTRICT 是否已灌数",
                    EXPECTED_DISTRICT_COUNT, response.getDistricts().size());
        }
        if (response.getStreets().isEmpty()) {
            log.info("DICT_STREET 为空，streets 返回空数组（街道级功能不可用）");
        }
    }
}

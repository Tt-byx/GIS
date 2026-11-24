package com.example.gis.service;

import com.example.gis.dto.DictResponse;
import com.example.gis.mapper.DictCategoryMapper;
import com.example.gis.mapper.DictConfigMapper;
import com.example.gis.mapper.DictDistrictMapper;
import com.example.gis.mapper.DictStreetMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * API-01 字典接口单元测试（对应 T-023 DoD 2/3 与 SPEC/03 §3 业务规则 1~4）。
 * 说明：SPEC/07 的 DoD 写作 CHK-TEST-META，但 SPEC/06 §4.7 未定义该 CHECK ID，
 * 实现侧按 API-01 的四条业务规则落断言，ID 缺失问题已在 docs/接口约定.md 记录。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("API-01 字典接口")
class DictServiceTest {

    @Mock
    private DictCategoryMapper categoryMapper;
    @Mock
    private DictDistrictMapper districtMapper;
    @Mock
    private DictStreetMapper streetMapper;
    @Mock
    private DictConfigMapper configMapper;

    @InjectMocks
    private DictService dictService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** 与 db/seed.sql 的 25 条中类、SORT_NO 顺序一致。 */
    private static List<DictCategoryMapper.Row> seededCategories() {
        return List.of(
                category("EDU", "KIN", "教育设施", "幼儿园", 5, "#4A90D9"),
                category("EDU", "PRI", "教育设施", "小学", 10, "#4A90D9"),
                category("EDU", "JUN", "教育设施", "初中", 15, "#4A90D9"),
                category("EDU", "SEN", "教育设施", "高中", 15, "#4A90D9"),
                category("EDU", "VOC", "教育设施", "中等职业学校", null, "#4A90D9"),
                category("MED", "HGE", "医疗卫生", "综合医院", null, "#E05252"),
                category("MED", "HSP", "医疗卫生", "专科医院", null, "#E05252"),
                category("MED", "HTM", "医疗卫生", "中医医院", null, "#E05252"),
                category("MED", "CHC", "医疗卫生", "社区卫生服务中心", 15, "#E05252"),
                category("MED", "CHS", "医疗卫生", "社区卫生服务站", 5, "#E05252"),
                category("MED", "CLN", "医疗卫生", "门诊部", 15, "#E05252"),
                category("CUL", "LIB", "文化体育", "图书馆", 15, "#8B5CF6"),
                category("CUL", "MUS", "文化体育", "博物馆", null, "#8B5CF6"),
                category("CUL", "CCC", "文化体育", "文化馆（站）", 10, "#8B5CF6"),
                category("CUL", "STD", "文化体育", "体育场馆", 15, "#8B5CF6"),
                category("CUL", "FIT", "文化体育", "全民健身中心", 15, "#8B5CF6"),
                category("CUL", "PRK", "文化体育", "城市公园", 15, "#8B5CF6"),
                category("WEL", "NUR", "社会福利", "养老院", 15, "#F59E0B"),
                category("WEL", "CAR", "社会福利", "老年养护院", 15, "#F59E0B"),
                category("WEL", "DAY", "社会福利", "日间照料中心", 5, "#F59E0B"),
                category("WEL", "DIS", "社会福利", "残疾人服务设施", null, "#F59E0B"),
                category("WEL", "CHW", "社会福利", "儿童福利院", null, "#F59E0B"),
                category("COM", "SVC", "社区服务", "社区服务中心（街道级）", 15, "#10B981"),
                category("COM", "STA", "社区服务", "社区服务站", 5, "#10B981"),
                category("COM", "POL", "社区服务", "派出所", 15, "#10B981")
        );
    }

    private static DictCategoryMapper.Row category(String l1, String l2, String l1Name,
                                                   String l2Name, Integer lifeCircle, String color) {
        DictCategoryMapper.Row row = new DictCategoryMapper.Row();
        row.setL1(l1);
        row.setL2(l2);
        row.setL1Name(l1Name);
        row.setL2Name(l2Name);
        row.setLifeCircle(lifeCircle);
        row.setColor(color);
        return row;
    }

    private static List<DictDistrictMapper.Row> seededDistricts() {
        return List.of(district("420107", "青山区"), district("420106", "武昌区"), district("420105", "汉阳区"));
    }

    private static DictDistrictMapper.Row district(String code, String name) {
        DictDistrictMapper.Row row = new DictDistrictMapper.Row();
        row.setCode(code);
        row.setName(name);
        return row;
    }

    private void stubCommon(String token, String dataDate) {
        when(categoryMapper.findAllOrderBySortNo()).thenReturn(seededCategories());
        when(districtMapper.findAllOrderBySortNo()).thenReturn(seededDistricts());
        when(streetMapper.findAllOrderBySortNo()).thenReturn(List.of());
        when(configMapper.findValue("TIANDITU_TOKEN")).thenReturn(token);
        when(configMapper.findValue("DATA_DATE")).thenReturn(dataDate);
    }

    @Test
    @DisplayName("规则 1/2：5 个大类，按 SORT_NO 升序，中类数与字典一致")
    void shouldGroupFiveCategoriesInSortOrder() {
        stubCommon(DictService.TOKEN_PLACEHOLDER, "2026-11-05");

        DictResponse response = dictService.dict();

        assertThat(response.getCategories()).extracting(DictResponse.Category::getL1)
                .containsExactly("EDU", "MED", "CUL", "WEL", "COM");
        assertThat(response.getCategories()).extracting(c -> c.getChildren().size())
                .containsExactly(5, 6, 6, 5, 3);
        // 组内顺序必须是 SORT_NO 顺序，而不是字母序
        assertThat(response.getCategories().get(0).getChildren())
                .extracting(DictResponse.Child::getL2)
                .containsExactly("KIN", "PRI", "JUN", "SEN", "VOC");
        assertThat(response.getCategories().get(0).getL1Name()).isEqualTo("教育设施");
        assertThat(response.getCategories().get(0).getColor()).isEqualTo("#4A90D9");
    }

    @Test
    @DisplayName("规则 3：令牌为占位符时返回空字符串")
    void shouldBlankTokenWhenPlaceholder() {
        stubCommon(DictService.TOKEN_PLACEHOLDER, "2026-11-05");

        assertThat(dictService.dict().getTiandituToken()).isEmpty();
    }

    @Test
    @DisplayName("规则 3：令牌已注入时原样返回，且不返回占位符原文")
    void shouldReturnInjectedToken() {
        stubCommon("abc123token", "2026-11-05");

        String token = dictService.dict().getTiandituToken();

        assertThat(token).isEqualTo("abc123token").doesNotContain(DictService.TOKEN_PLACEHOLDER);
    }

    @Test
    @DisplayName("规则 3：令牌为空串或空白时同样返回空字符串")
    void shouldBlankTokenWhenNullOrBlank() {
        stubCommon("   ", "2026-11-05");
        assertThat(dictService.dict().getTiandituToken()).isEmpty();

        stubCommon(null, "2026-11-05");
        assertThat(dictService.dict().getTiandituToken()).isEmpty();
    }

    @Test
    @DisplayName("规则 4：districts 恰好 3 条，含 code/name；streets 为空数组")
    void shouldMapDistrictsAndEmptyStreets() {
        stubCommon(DictService.TOKEN_PLACEHOLDER, "2026-11-05");

        DictResponse response = dictService.dict();

        assertThat(response.getDistricts()).hasSize(3);
        assertThat(response.getDistricts().get(0).getCode()).isEqualTo("420107");
        assertThat(response.getDistricts().get(0).getName()).isEqualTo("青山区");
        assertThat(response.getStreets()).isNotNull().isEmpty();
    }

    @Test
    @DisplayName("契约字段：lifeCircle 为 null 时必须保留 null 键，dataDate 取 SYS_CONFIG")
    void shouldKeepNullLifeCircleAndDataDate() throws Exception {
        stubCommon(DictService.TOKEN_PLACEHOLDER, "2026-11-05");

        DictResponse response = dictService.dict();

        assertThat(response.getDataDate()).isEqualTo("2026-11-05");
        String json = objectMapper.writeValueAsString(response.getCategories().get(0).getChildren().get(4));
        assertThat(json).contains("\"lifeCircle\":null");
        assertThat(json).doesNotContain("CAT_L1");
    }
}

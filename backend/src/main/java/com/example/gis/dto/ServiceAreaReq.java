package com.example.gis.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.util.List;

/**
 * API-05 网络服务区请求。见 SPEC/03 §7。
 * <p>
 * 业务规则在 service 层处理：
 * <ul>
 *   <li>{@code thresholds} 必须去重+升序，值 ∈ {5,10,15} → 其他值 code=1002</li>
 *   <li>{@code travelMode} 只允许 WALK/DRIVE → 其他值 code=1001</li>
 *   <li>{@code categoryL2} 必须存在于 DICT_CATEGORY.CATEGORY_L2 → code=2001</li>
 * </ul>
 */
@Data
public class ServiceAreaReq {

    /** 设施类型中类编码，如 CHC/KIN */
    @NotBlank(message = "categoryL2 不能为空")
    private String categoryL2;

    /** 出行方式：WALK / DRIVE */
    @NotBlank(message = "travelMode 不能为空")
    @Pattern(regexp = "^(WALK|DRIVE)$", message = "travelMode 只允许 WALK/DRIVE")
    private String travelMode;

    /** 阈值分钟，长度 1-3，值 ∈ {5,10,15} */
    @NotEmpty(message = "thresholds 不能为空")
    private List<Integer> thresholds;

    /** 可选：限定行政区 code */
    private String districtCode;

    /** 是否融合（默认 true） */
    private Boolean dissolve = true;
}

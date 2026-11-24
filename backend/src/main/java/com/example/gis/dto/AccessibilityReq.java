package com.example.gis.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * API-06 可达性分析请求体（SPEC/03-api-contract.md §8）。
 * 阈值只允许 5/10/15，枚举校验在 service 内完成（返回 1002）。
 */
@Data
public class AccessibilityReq {

    /** 中类编码，如 CHC；必填。 */
    @NotBlank(message = "categoryL2 不能为空")
    private String categoryL2;

    /** 服务阈值（分钟），仅允许 5/10/15。 */
    @NotNull(message = "thresholdMinutes 不能为空")
    private Integer thresholdMinutes;

    /** 衰减函数 GAUSSIAN/LINEAR/BINARY，必填。 */
    @NotBlank(message = "decay 不能为空")
    private String decay;

    /** 供给量字段，当前仅支持 CAPACITY（默认）。 */
    private String capacityField;

    /** 限定行政区，可选。 */
    private String districtCode;
}

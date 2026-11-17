package com.example.gis.common;

import lombok.Getter;

/**
 * 业务异常。所有可预期失败都必须转成该异常携带 {@link ErrorCode}，
 * 由 GlobalExceptionHandler 统一转成 R 结构，避免异常冒泡到容器默认错误页。
 */
@Getter
public class BizException extends RuntimeException {

    private final ErrorCode errorCode;

    public BizException(ErrorCode errorCode) {
        super(errorCode.getMsg());
        this.errorCode = errorCode;
    }

    public BizException(ErrorCode errorCode, Throwable cause) {
        super(errorCode.getMsg(), cause);
        this.errorCode = errorCode;
    }
}

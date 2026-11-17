package com.example.gis.common;

import lombok.Getter;

import java.util.UUID;

/**
 * 统一响应包装，字段固定为 code/msg/data/traceId（SPEC/03-api-contract.md §2.2）。
 * 失败时 data 恒为 null，traceId 为 12 位十六进制，供用户在界面反馈排障。
 */
@Getter
public class R<T> {

    private final int code;
    private final String msg;
    private final T data;
    private final String traceId;

    private R(int code, String msg, T data, String traceId) {
        this.code = code;
        this.msg = msg;
        this.data = data;
        this.traceId = traceId;
    }

    public static <T> R<T> ok(T data) {
        return new R<>(ErrorCode.SUCCESS.getCode(), ErrorCode.SUCCESS.getMsg(), data, newTraceId());
    }

    public static <T> R<T> fail(ErrorCode errorCode) {
        return fail(errorCode, newTraceId());
    }

    public static <T> R<T> fail(ErrorCode errorCode, String traceId) {
        return new R<>(errorCode.getCode(), errorCode.getMsg(), null, traceId);
    }

    public static String newTraceId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }
}

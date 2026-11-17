package com.example.gis.common;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * 错误码主表。取值、HTTP 状态与提示语必须与 SPEC/05-conventions.md §4 逐字一致；
 * 新增错误码必须先修订 SPEC（T-900），不得在业务代码里自造。
 */
@Getter
public enum ErrorCode {

    SUCCESS(0, HttpStatus.OK, "success"),
    INVALID_PARAM(1001, HttpStatus.BAD_REQUEST, "参数校验失败"),
    OUT_OF_RANGE(1002, HttpStatus.BAD_REQUEST, "参数超出允许范围"),
    NOT_FOUND(2001, HttpStatus.NOT_FOUND, "数据不存在"),
    DATA_NOT_READY(2002, HttpStatus.UNPROCESSABLE_ENTITY, "数据未就绪"),
    IGS_UNAVAILABLE(3001, HttpStatus.SERVICE_UNAVAILABLE, "地图服务连接失败，请检查 IGServer 是否启动"),
    IGS_ERROR(3002, HttpStatus.BAD_GATEWAY, "地图服务返回错误"),
    TIMEOUT(4001, HttpStatus.GATEWAY_TIMEOUT, "计算超时，建议缩小范围"),
    SYSTEM_ERROR(5000, HttpStatus.INTERNAL_SERVER_ERROR, "系统异常"),
    QUOTA_EXCEEDED(5001, HttpStatus.TOO_MANY_REQUESTS, "今日查询额度已用尽");

    private final int code;
    private final HttpStatus httpStatus;
    private final String msg;

    ErrorCode(int code, HttpStatus httpStatus, String msg) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.msg = msg;
    }
}

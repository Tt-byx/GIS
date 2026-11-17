package com.example.gis.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * 全局异常出口。任何异常都必须转成 R 结构返回，不得出现容器默认错误页。
 * traceId 由 R 统一生成，系统异常额外记录堆栈，便于按 traceId 反查日志。
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BizException.class)
    public ResponseEntity<R<Void>> handleBiz(BizException e) {
        ErrorCode errorCode = e.getErrorCode();
        log.warn("业务异常 code={} msg={}", errorCode.getCode(), errorCode.getMsg());
        return build(errorCode);
    }

    @ExceptionHandler({
            MethodArgumentNotValidException.class,
            BindException.class,
            HttpMessageNotReadableException.class,
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class
    })
    public ResponseEntity<R<Void>> handleBadRequest(Exception e) {
        log.warn("参数校验失败: {}", e.getMessage());
        return build(ErrorCode.INVALID_PARAM);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<R<Void>> handleUnknown(Exception e) {
        R<Void> body = R.fail(ErrorCode.SYSTEM_ERROR);
        log.error("系统异常 traceId={}", body.getTraceId(), e);
        return ResponseEntity.status(ErrorCode.SYSTEM_ERROR.getHttpStatus()).body(body);
    }

    private ResponseEntity<R<Void>> build(ErrorCode errorCode) {
        return ResponseEntity.status(errorCode.getHttpStatus()).body(R.fail(errorCode));
    }
}

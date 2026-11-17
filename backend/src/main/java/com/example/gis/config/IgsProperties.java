package com.example.gis.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * IGServer 连接参数。键名固定为 igs.ip/port/mapDoc/timeoutMs（SPEC/04 §5.2），
 * 业务代码不得再出现 IP、端口或服务地址字面量。
 */
@Data
@ConfigurationProperties(prefix = "igs")
public class IgsProperties {

    private String ip;
    private int port;
    private String mapDoc;
    private int timeoutMs;
}

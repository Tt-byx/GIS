package com.example.gis;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * 后端启动入口。使用配置属性扫描，保证 igs.* 等配置键集中在 ConfigurationProperties 中。
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class GisApplication {

    public static void main(String[] args) {
        SpringApplication.run(GisApplication.class, args);
    }
}

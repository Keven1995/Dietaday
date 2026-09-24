package com.dietapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.context.annotation.Bean;

import java.time.Clock;
import java.time.ZoneId;

@SpringBootApplication
@EnableScheduling
public class DietAppApplication {
    @Bean
    public Clock applicationClock() {
        return Clock.system(ZoneId.of("America/Sao_Paulo"));
    }

    public static void main(String[] args) {
        SpringApplication.run(DietAppApplication.class, args);
    }
}

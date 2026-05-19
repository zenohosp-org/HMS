package com.zenlocare.HMS_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class HmsBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(HmsBackendApplication.class, args);
	}

}

package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.service.InfrastructureService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/ipd/infrastructure")
@RequiredArgsConstructor
public class InfrastructureController {

    private final InfrastructureService service;

    @GetMapping
    public ResponseEntity<List<BuildingDto>> get(@RequestParam UUID hospitalId) {
        return ResponseEntity.ok(service.get(hospitalId));
    }

    @PostMapping
    public ResponseEntity<List<BuildingDto>> save(
            @RequestParam UUID hospitalId,
            @RequestBody List<BuildingDto> buildings) {
        return ResponseEntity.ok(service.save(hospitalId, buildings));
    }

    @Data
    public static class BuildingDto {
        private Long id;
        private String name;
        private List<FloorDto> floors = List.of();
    }

    @Data
    public static class FloorDto {
        private Long id;
        private String name;
        private List<WardDto> wards = List.of();
    }

    @Data
    public static class WardDto {
        private Long id;
        private String name;
        private BigDecimal dailyCharge;
        private String roomType;
        private Integer bedCount;
        private List<RoomDto> rooms = List.of();
    }

    @Data
    public static class RoomDto {
        private Long id;
        private String name;
        private Integer bedCount;
    }
}

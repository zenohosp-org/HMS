package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.controller.InfrastructureController.BuildingDto;
import com.zenlocare.HMS_backend.controller.InfrastructureController.FloorDto;
import com.zenlocare.HMS_backend.controller.InfrastructureController.RoomDto;
import com.zenlocare.HMS_backend.controller.InfrastructureController.WardDto;
import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InfrastructureService {

    private final HospitalBuildingRepository buildingRepo;
    private final HospitalFloorRepository floorRepo;
    private final HospitalWardRepository wardRepo;
    private final HospitalRepository hospitalRepo;
    private final RoomRepository roomRepo;

    @Transactional(readOnly = true)
    public List<BuildingDto> get(UUID hospitalId) {
        List<HospitalBuilding> buildings = buildingRepo.findByHospitalIdWithDetails(hospitalId);
        return buildings.stream().map(b -> toDto(b, hospitalId)).collect(Collectors.toList());
    }

    @Transactional
    public List<BuildingDto> save(UUID hospitalId, List<BuildingDto> dtos) {
        // Step 1: Remember which rooms were part of infrastructure (to clean up removed ones later)
        List<Room> prevInfraRooms = new ArrayList<>(roomRepo.findByHospitalIdAndHospitalWardIsNotNull(hospitalId));

        // Step 2: Null out ALL ward FKs via native SQL so wards can be safely deleted
        wardRepo.detachRoomsFromWards(hospitalId);

        // Step 3: Delete old infrastructure (native SQL, FK order: wards → floors → buildings)
        wardRepo.deleteByHospitalId(hospitalId);
        floorRepo.deleteByHospitalId(hospitalId);
        buildingRepo.deleteByHospitalId(hospitalId);

        Hospital hospital = hospitalRepo.getReferenceById(hospitalId);

        // Step 4: Rebuild infrastructure + create/update rooms
        Set<Long> reassignedRoomIds = new HashSet<>();

        for (int i = 0; i < dtos.size(); i++) {
            BuildingDto bDto = dtos.get(i);
            HospitalBuilding building = new HospitalBuilding();
            building.setHospital(hospital);
            building.setName(bDto.getName());
            building.setDisplayOrder(i);
            building.setFloors(new ArrayList<>());

            for (int j = 0; j < bDto.getFloors().size(); j++) {
                FloorDto fDto = bDto.getFloors().get(j);
                HospitalFloor floor = new HospitalFloor();
                floor.setBuilding(building);
                floor.setName(fDto.getName());
                floor.setDisplayOrder(j);
                floor.setWards(new ArrayList<>());

                for (int k = 0; k < fDto.getWards().size(); k++) {
                    WardDto wDto = fDto.getWards().get(k);
                    HospitalWard ward = new HospitalWard();
                    ward.setFloor(floor);
                    ward.setName(wDto.getName());
                    ward.setDailyCharge(wDto.getDailyCharge());
                    ward.setDisplayOrder(k);
                    floor.getWards().add(ward);
                }
                building.getFloors().add(floor);
            }

            // saveAndFlush so ward IDs are generated before creating rooms
            buildingRepo.saveAndFlush(building);

            for (int j = 0; j < building.getFloors().size(); j++) {
                HospitalFloor floor = building.getFloors().get(j);
                FloorDto fDto = bDto.getFloors().get(j);

                for (int k = 0; k < floor.getWards().size(); k++) {
                    HospitalWard ward = floor.getWards().get(k);
                    WardDto wDto = fDto.getWards().get(k);
                    RoomType roomType = parseRoomType(wDto.getRoomType());

                    for (RoomDto rDto : wDto.getRooms()) {
                        Room room = null;

                        // Try to find by ID first (update existing room)
                        if (rDto.getId() != null) {
                            room = roomRepo.findById(rDto.getId()).orElse(null);
                        }
                        // Fallback: find by room number to avoid unique constraint violation
                        if (room == null) {
                            room = roomRepo.findByHospitalIdAndRoomNumber(hospitalId, rDto.getName()).orElse(null);
                        }
                        // Still not found: create new
                        if (room == null) {
                            room = new Room();
                            room.setHospital(hospital);
                            room.setStatus(RoomStatus.AVAILABLE);
                        }

                        room.setRoomNumber(rDto.getName());
                        room.setRoomType(roomType);
                        room.setPricePerDay(wDto.getDailyCharge());
                        room.setWard(wDto.getName());
                        room.setHospitalWard(ward);
                        Room saved = roomRepo.save(room);
                        if (saved.getId() != null) reassignedRoomIds.add(saved.getId());
                    }
                }
            }
        }

        // Step 5: Clean up previous infra rooms that were not reassigned
        for (Room room : prevInfraRooms) {
            Long id = room.getId();
            if (id != null && !reassignedRoomIds.contains(id)) {
                if (room.getStatus() == RoomStatus.AVAILABLE) {
                    roomRepo.deleteById(id);
                }
                // OCCUPIED rooms: ward_id already nulled by native SQL in Step 2, kept as standalone
            }
        }

        return get(hospitalId);
    }

    private RoomType parseRoomType(String type) {
        if (type == null) return RoomType.GENERAL;
        try { return RoomType.valueOf(type); } catch (IllegalArgumentException e) { return RoomType.GENERAL; }
    }

    private BuildingDto toDto(HospitalBuilding b, UUID hospitalId) {
        BuildingDto dto = new BuildingDto();
        dto.setId(b.getId());
        dto.setName(b.getName());
        dto.setFloors(b.getFloors().stream().map(f -> toDto(f, hospitalId)).collect(Collectors.toList()));
        return dto;
    }

    private FloorDto toDto(HospitalFloor f, UUID hospitalId) {
        FloorDto dto = new FloorDto();
        dto.setId(f.getId());
        dto.setName(f.getName());
        dto.setWards(f.getWards().stream().map(w -> toDto(w, hospitalId)).collect(Collectors.toList()));
        return dto;
    }

    private WardDto toDto(HospitalWard w, UUID hospitalId) {
        WardDto dto = new WardDto();
        dto.setId(w.getId());
        dto.setName(w.getName());
        dto.setDailyCharge(w.getDailyCharge());
        List<RoomDto> rooms = roomRepo.findByHospitalWard_Id(w.getId()).stream()
                .map(r -> { RoomDto rd = new RoomDto(); rd.setId(r.getId()); rd.setName(r.getRoomNumber()); return rd; })
                .collect(Collectors.toList());
        dto.setRooms(rooms);
        return dto;
    }
}

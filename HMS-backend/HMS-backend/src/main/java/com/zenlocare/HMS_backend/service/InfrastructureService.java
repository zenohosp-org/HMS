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
    private final BedRepository bedRepo;

    @Transactional(readOnly = true)
    public List<BuildingDto> get(UUID hospitalId) {
        List<HospitalBuilding> buildings = buildingRepo.findByHospitalIdWithDetails(hospitalId);
        return buildings.stream().map(b -> toDto(b, hospitalId)).collect(Collectors.toList());
    }

    @Transactional
    public List<BuildingDto> save(UUID hospitalId, List<BuildingDto> dtos) {
        List<Room> prevInfraRooms = new ArrayList<>(roomRepo.findByHospitalIdAndHospitalWardIsNotNull(hospitalId));

        wardRepo.detachRoomsFromWards(hospitalId);
        wardRepo.deleteByHospitalId(hospitalId);
        floorRepo.deleteByHospitalId(hospitalId);
        buildingRepo.deleteByHospitalId(hospitalId);

        Hospital hospital = hospitalRepo.getReferenceById(hospitalId);
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

            buildingRepo.saveAndFlush(building);

            for (int j = 0; j < building.getFloors().size(); j++) {
                HospitalFloor floor = building.getFloors().get(j);
                FloorDto fDto = bDto.getFloors().get(j);

                for (int k = 0; k < floor.getWards().size(); k++) {
                    HospitalWard ward = floor.getWards().get(k);
                    WardDto wDto = fDto.getWards().get(k);
                    RoomType roomType = parseRoomType(wDto.getRoomType());
                    int wardBedCount = wDto.getBedCount() != null && wDto.getBedCount() > 0
                            ? wDto.getBedCount() : 1;

                    for (RoomDto rDto : wDto.getRooms()) {
                        Room room = null;

                        if (rDto.getId() != null) {
                            room = roomRepo.findById(rDto.getId()).orElse(null);
                        }
                        if (room == null) {
                            room = roomRepo.findByHospitalIdAndRoomNumber(hospitalId, rDto.getName()).orElse(null);
                        }
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
                        room.setBedCount(wardBedCount);
                        Room saved = roomRepo.save(room);

                        syncBeds(saved, wardBedCount);

                        if (saved.getId() != null) reassignedRoomIds.add(saved.getId());
                    }
                }
            }
        }

        for (Room room : prevInfraRooms) {
            Long id = room.getId();
            if (id != null && !reassignedRoomIds.contains(id)) {
                if (room.getStatus() == RoomStatus.AVAILABLE) {
                    bedRepo.findByRoomIdOrderByBedNumberAsc(id).forEach(bedRepo::delete);
                    roomRepo.deleteById(id);
                }
            }
        }

        return get(hospitalId);
    }

    private void syncBeds(Room room, int targetCount) {
        List<Bed> existing = bedRepo.findByRoomIdOrderByBedNumberAsc(room.getId());
        int currentCount = existing.size();

        if (targetCount > currentCount) {
            for (int b = currentCount + 1; b <= targetCount; b++) {
                bedRepo.save(Bed.builder()
                        .room(room)
                        .bedNumber("Bed " + b)
                        .status(BedStatus.AVAILABLE)
                        .build());
            }
        } else if (targetCount < currentCount) {
            // Remove excess beds from the end, only if AVAILABLE
            List<Bed> excess = existing.subList(targetCount, currentCount);
            for (Bed bed : excess) {
                if (bed.getStatus() == BedStatus.AVAILABLE) {
                    bedRepo.delete(bed);
                }
            }
        }
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
        List<Room> wardRooms = roomRepo.findByHospitalWard_Id(w.getId());
        // Derive bedCount from first room (all rooms in a ward share the same count)
        dto.setBedCount(wardRooms.isEmpty() ? 1 : Optional.ofNullable(wardRooms.get(0).getBedCount()).orElse(1));
        List<RoomDto> rooms = wardRooms.stream()
                .map(r -> {
                    RoomDto rd = new RoomDto();
                    rd.setId(r.getId());
                    rd.setName(r.getRoomNumber());
                    rd.setBedCount(Optional.ofNullable(r.getBedCount()).orElse(1));
                    return rd;
                })
                .collect(Collectors.toList());
        dto.setRooms(rooms);
        return dto;
    }
}

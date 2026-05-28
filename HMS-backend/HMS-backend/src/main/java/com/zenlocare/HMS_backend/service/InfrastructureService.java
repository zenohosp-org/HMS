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

@Transactional(readOnly = true)
@Service
@RequiredArgsConstructor
public class InfrastructureService {

    private final HospitalBuildingRepository buildingRepo;
    private final HospitalFloorRepository floorRepo;
    private final HospitalWardRepository wardRepo;
    private final HospitalRepository hospitalRepo;
    private final RoomRepository roomRepo;
    private final BedRepository bedRepo;
    private final StoreRepository storeRepo;

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
                    ward.setRoomType(wDto.getRoomType() != null ? wDto.getRoomType() : "GENERAL");
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
                    String roomType = wDto.getRoomType() != null ? wDto.getRoomType() : "GENERAL";

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
                        room.setWard(wDto.getName());
                        room.setHospitalWard(ward);
                        room.setBedCount(rDto.getBedNames().size());
                        // Cascade the ward's daily rate onto each room as the
                        // billing snapshot. AdmissionDTO.roomPricePerDay is
                        // computed live from Room.getPricePerDay() at every
                        // fetch, so updating the room here means
                        // SmartBillingService and the IPD finalize modal pick
                        // up the new rate without any further plumbing.
                        // Per-room overrides can still be applied directly on
                        // the rooms table after the fact.
                        if (ward.getDailyCharge() != null) {
                            room.setPricePerDay(ward.getDailyCharge());
                        }
                        Room saved = roomRepo.save(room);

                        syncBeds(saved, rDto.getBedNames());

                        if ("STORE".equals(roomType)) {
                            Store store = storeRepo.findByRoomId(saved.getId()).orElse(null);
                            if (store == null) {
                                store = new Store();
                                store.setRoomId(saved.getId());
                            }
                            store.setHospital(hospital);
                            store.setName(saved.getRoomNumber());
                            store.setIsActive(true);
                            store.setType("STORE");
                            storeRepo.save(store);
                        } else {
                            storeRepo.deleteByRoomId(saved.getId());
                        }

                        if (saved.getId() != null) reassignedRoomIds.add(saved.getId());
                    }
                }
            }
        }

        for (Room room : prevInfraRooms) {
            Long id = room.getId();
            if (id != null && !reassignedRoomIds.contains(id)) {
                if (room.getStatus() == RoomStatus.AVAILABLE) {
                    storeRepo.deleteByRoomId(id);
                    bedRepo.findByRoomIdOrderByBedNumberAsc(id).forEach(bedRepo::delete);
                    roomRepo.deleteById(id);
                }
            }
        }

        return get(hospitalId);
    }

    private void syncBeds(Room room, List<String> targetBedNames) {
        List<Bed> existing = bedRepo.findByRoomIdOrderByBedNumberAsc(room.getId());
        
        // Remove beds that are no longer in the target list (only if AVAILABLE)
        for (Bed bed : existing) {
            if (!targetBedNames.contains(bed.getBedNumber())) {
                if (bed.getStatus() == BedStatus.AVAILABLE) {
                    bedRepo.delete(bed);
                }
            }
        }
        
        // Add new beds
        for (String bedName : targetBedNames) {
            boolean exists = existing.stream().anyMatch(b -> b.getBedNumber().equals(bedName));
            if (!exists) {
                bedRepo.save(Bed.builder()
                        .room(room)
                        .bedNumber(bedName)
                        .status(BedStatus.AVAILABLE)
                        .build());
            }
        }
    }

    // roomType is now a plain String — no enum parsing needed

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
        // Ward stores the authoritative roomType. Fall back to the first room's
        // type for legacy rows where the ward column wasn't populated yet, then
        // default to GENERAL.
        String wardType = w.getRoomType();
        if (wardType == null || wardType.isBlank()) {
            wardType = wardRooms.isEmpty() ? "GENERAL"
                    : Optional.ofNullable(wardRooms.get(0).getRoomType()).orElse("GENERAL");
        }
        dto.setRoomType(wardType);
        List<RoomDto> rooms = wardRooms.stream()
                .map(r -> {
                    RoomDto rd = new RoomDto();
                    rd.setId(r.getId());
                    rd.setName(r.getRoomNumber());
                    List<String> bedNames = bedRepo.findByRoomIdOrderByBedNumberAsc(r.getId())
                            .stream().map(Bed::getBedNumber).collect(Collectors.toList());
                    rd.setBedNames(bedNames);
                    return rd;
                })
                .collect(Collectors.toList());
        dto.setRooms(rooms);
        return dto;
    }
}

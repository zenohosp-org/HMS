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
    public List<BuildingDto> get(UUID hospitalId, boolean includeInactive) {
        List<HospitalBuilding> buildings = buildingRepo.findByHospitalIdWithDetails(hospitalId);
        return buildings.stream()
                .filter(b -> includeInactive || Boolean.TRUE.equals(b.getIsActive()))
                .map(b -> toDto(b, hospitalId, includeInactive))
                .collect(Collectors.toList());
    }

    @Transactional
    public List<BuildingDto> save(UUID hospitalId, List<BuildingDto> dtos) {
        Hospital hospital = hospitalRepo.getReferenceById(hospitalId);
        List<HospitalBuilding> allBuildings = buildingRepo.findByHospitalIdWithDetails(hospitalId);
        
        Set<Long> activeBuildingIds = new HashSet<>();
        Set<Long> activeFloorIds = new HashSet<>();
        Set<Long> activeWardIds = new HashSet<>();
        Set<Long> activeRoomIds = new HashSet<>();
        Set<Long> activeBedIds = new HashSet<>();

        for (int i = 0; i < dtos.size(); i++) {
            BuildingDto bDto = dtos.get(i);
            HospitalBuilding building = allBuildings.stream()
                .filter(b -> bDto.getId() != null ? b.getId().equals(bDto.getId()) : b.getName().equals(bDto.getName()))
                .findFirst()
                .orElseGet(() -> {
                    HospitalBuilding newB = new HospitalBuilding();
                    newB.setHospital(hospital);
                    newB.setFloors(new ArrayList<>());
                    allBuildings.add(newB);
                    return newB;
                });
            
            building.setName(bDto.getName());
            building.setDisplayOrder(i);
            building.setIsActive(true);
            
            building = buildingRepo.saveAndFlush(building);
            activeBuildingIds.add(building.getId());
            
            for (int j = 0; j < bDto.getFloors().size(); j++) {
                FloorDto fDto = bDto.getFloors().get(j);
                final HospitalBuilding currentBuilding = building;
                HospitalFloor floor = building.getFloors().stream()
                    .filter(f -> fDto.getId() != null ? f.getId().equals(fDto.getId()) : f.getName().equals(fDto.getName()))
                    .findFirst()
                    .orElseGet(() -> {
                        HospitalFloor newF = new HospitalFloor();
                        newF.setBuilding(currentBuilding);
                        newF.setWards(new ArrayList<>());
                        currentBuilding.getFloors().add(newF);
                        return newF;
                    });
                
                floor.setBuilding(building);
                floor.setName(fDto.getName());
                floor.setDisplayOrder(j);
                floor.setIsActive(true);
                floor = floorRepo.saveAndFlush(floor);
                activeFloorIds.add(floor.getId());

                for (int k = 0; k < fDto.getWards().size(); k++) {
                    WardDto wDto = fDto.getWards().get(k);
                    final HospitalFloor currentFloor = floor;
                    HospitalWard ward = floor.getWards().stream()
                        .filter(w -> wDto.getId() != null ? w.getId().equals(wDto.getId()) : w.getName().equals(wDto.getName()))
                        .findFirst()
                        .orElseGet(() -> {
                            HospitalWard newW = new HospitalWard();
                            newW.setFloor(currentFloor);
                            currentFloor.getWards().add(newW);
                            return newW;
                        });

                    ward.setFloor(floor);
                    ward.setName(wDto.getName());
                    ward.setDailyCharge(wDto.getDailyCharge());
                    ward.setRoomType(wDto.getRoomType() != null ? wDto.getRoomType() : "GENERAL");
                    ward.setDisplayOrder(k);
                    ward.setIsActive(true);
                    ward = wardRepo.saveAndFlush(ward);
                    activeWardIds.add(ward.getId());

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
                        room.setRoomType(ward.getRoomType());
                        room.setWard(wDto.getName());
                        room.setHospitalWard(ward);
                        room.setBedCount(rDto.getBedNames().size());
                        if (ward.getDailyCharge() != null) {
                            room.setPricePerDay(ward.getDailyCharge());
                        }
                        room.setIsActive(true);
                        Room savedRoom = roomRepo.saveAndFlush(room);
                        activeRoomIds.add(savedRoom.getId());

                        List<Bed> beds = bedRepo.findByRoomIdOrderByBedNumberAsc(savedRoom.getId());
                        for (String bedName : rDto.getBedNames()) {
                            Bed bed = beds.stream()
                                .filter(b -> b.getBedNumber().equals(bedName))
                                .findFirst()
                                .orElseGet(() -> {
                                    Bed newBed = new Bed();
                                    newBed.setRoom(savedRoom);
                                    newBed.setStatus(BedStatus.AVAILABLE);
                                    return newBed;
                                });
                            bed.setBedNumber(bedName);
                            bed.setIsActive(true);
                            bed.setWard(null);
                            bed = bedRepo.saveAndFlush(bed);
                            activeBedIds.add(bed.getId());
                        }
                        
                        for (Bed bed : beds) {
                            if (!activeBedIds.contains(bed.getId())) {
                                bed.setIsActive(false);
                                bedRepo.save(bed);
                            }
                        }

                        if ("STORE".equals(room.getRoomType())) {
                            Store store = storeRepo.findByRoomId(savedRoom.getId()).orElse(null);
                            if (store == null) {
                                store = new Store();
                                store.setRoomId(savedRoom.getId());
                            }
                            store.setHospital(hospital);
                            store.setName(savedRoom.getRoomNumber());
                            store.setIsActive(true);
                            store.setType("STORE");
                            storeRepo.save(store);
                        } else {
                            Store store = storeRepo.findByRoomId(savedRoom.getId()).orElse(null);
                            if (store != null) {
                                store.setIsActive(false);
                                storeRepo.save(store);
                            }
                        }
                    }

                    if (wDto.getBedNames() != null) {
                        List<Bed> wardBeds = bedRepo.findByWardIdOrderByBedNumberAsc(ward.getId());
                        final HospitalWard finalWard = ward;
                        for (String bedName : wDto.getBedNames()) {
                            Bed bed = wardBeds.stream()
                                .filter(b -> b.getBedNumber().equals(bedName))
                                .findFirst()
                                .orElseGet(() -> {
                                    Bed newBed = new Bed();
                                    newBed.setWard(finalWard);
                                    newBed.setStatus(BedStatus.AVAILABLE);
                                    return newBed;
                                });
                            bed.setWard(finalWard);
                            bed.setRoom(null);
                            bed.setBedNumber(bedName);
                            bed.setIsActive(true);
                            bed = bedRepo.saveAndFlush(bed);
                            activeBedIds.add(bed.getId());
                        }

                        for (Bed bed : wardBeds) {
                            if (!activeBedIds.contains(bed.getId())) {
                                bed.setIsActive(false);
                                bedRepo.save(bed);
                            }
                        }
                    }
                }
            }
        }

        List<Room> prevInfraRooms = roomRepo.findByHospitalIdAndHospitalWardIsNotNull(hospitalId);
        for (Room room : prevInfraRooms) {
            if (!activeRoomIds.contains(room.getId()) && Boolean.TRUE.equals(room.getIsActive())) {
                room.setIsActive(false);
                roomRepo.save(room);
                
                Store store = storeRepo.findByRoomId(room.getId()).orElse(null);
                if (store != null) {
                    store.setIsActive(false);
                    storeRepo.save(store);
                }
            }
        }

        for (HospitalBuilding b : allBuildings) {
            if (!activeBuildingIds.contains(b.getId()) && Boolean.TRUE.equals(b.getIsActive())) {
                b.setIsActive(false);
                buildingRepo.save(b);
            }
            for (HospitalFloor f : b.getFloors()) {
                if (!activeFloorIds.contains(f.getId()) && Boolean.TRUE.equals(f.getIsActive())) {
                    f.setIsActive(false);
                    floorRepo.save(f);
                }
                for (HospitalWard w : f.getWards()) {
                    if (!activeWardIds.contains(w.getId()) && Boolean.TRUE.equals(w.getIsActive())) {
                        w.setIsActive(false);
                        wardRepo.save(w);
                    }
                }
            }
        }

        return get(hospitalId, false);
    }

    private BuildingDto toDto(HospitalBuilding b, UUID hospitalId, boolean includeInactive) {
        BuildingDto dto = new BuildingDto();
        dto.setId(b.getId());
        dto.setName(b.getName());
        dto.setIsActive(b.getIsActive());
        dto.setFloors(b.getFloors().stream()
                .filter(f -> includeInactive || Boolean.TRUE.equals(f.getIsActive()))
                .map(f -> toDto(f, hospitalId, includeInactive))
                .collect(Collectors.toList()));
        return dto;
    }

    private FloorDto toDto(HospitalFloor f, UUID hospitalId, boolean includeInactive) {
        FloorDto dto = new FloorDto();
        dto.setId(f.getId());
        dto.setName(f.getName());
        dto.setIsActive(f.getIsActive());
        dto.setWards(f.getWards().stream()
                .filter(w -> includeInactive || Boolean.TRUE.equals(w.getIsActive()))
                .map(w -> toDto(w, hospitalId, includeInactive))
                .collect(Collectors.toList()));
        return dto;
    }

    private WardDto toDto(HospitalWard w, UUID hospitalId, boolean includeInactive) {
        WardDto dto = new WardDto();
        dto.setId(w.getId());
        dto.setName(w.getName());
        dto.setIsActive(w.getIsActive());
        dto.setDailyCharge(w.getDailyCharge());
        List<Room> wardRooms = roomRepo.findByHospitalWard_Id(w.getId());
        wardRooms = wardRooms.stream()
                .filter(r -> includeInactive || Boolean.TRUE.equals(r.getIsActive()))
                .collect(Collectors.toList());
                
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
                    rd.setIsActive(r.getIsActive());
                    List<String> bedNames = bedRepo.findByRoomIdOrderByBedNumberAsc(r.getId())
                            .stream()
                            .filter(bed -> includeInactive || Boolean.TRUE.equals(bed.getIsActive()))
                            .map(Bed::getBedNumber)
                            .collect(Collectors.toList());
                    rd.setBedNames(bedNames);
                    return rd;
                })
                .collect(Collectors.toList());
        dto.setRooms(rooms);
        
        List<String> wardBedNames = bedRepo.findByWardIdOrderByBedNumberAsc(w.getId())
                .stream()
                .filter(bed -> bed.getRoom() == null && (includeInactive || Boolean.TRUE.equals(bed.getIsActive())))
                .map(Bed::getBedNumber)
                .collect(Collectors.toList());
        dto.setBedNames(wardBedNames);
        
        return dto;
    }
}

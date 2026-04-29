package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.controller.InfrastructureController.BuildingDto;
import com.zenlocare.HMS_backend.controller.InfrastructureController.FloorDto;
import com.zenlocare.HMS_backend.controller.InfrastructureController.WardDto;
import com.zenlocare.HMS_backend.entity.Hospital;
import com.zenlocare.HMS_backend.entity.HospitalBuilding;
import com.zenlocare.HMS_backend.entity.HospitalFloor;
import com.zenlocare.HMS_backend.entity.HospitalWard;
import com.zenlocare.HMS_backend.repository.HospitalBuildingRepository;
import com.zenlocare.HMS_backend.repository.HospitalFloorRepository;
import com.zenlocare.HMS_backend.repository.HospitalRepository;
import com.zenlocare.HMS_backend.repository.HospitalWardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InfrastructureService {

    private final HospitalBuildingRepository buildingRepo;
    private final HospitalFloorRepository floorRepo;
    private final HospitalWardRepository wardRepo;
    private final HospitalRepository hospitalRepo;

    @Transactional(readOnly = true)
    public List<BuildingDto> get(UUID hospitalId) {
        return buildingRepo.findByHospitalIdWithDetails(hospitalId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public List<BuildingDto> save(UUID hospitalId, List<BuildingDto> dtos) {
        wardRepo.deleteByHospitalId(hospitalId);
        floorRepo.deleteByHospitalId(hospitalId);
        buildingRepo.deleteByHospitalId(hospitalId);

        Hospital hospital = hospitalRepo.getReferenceById(hospitalId);
        List<HospitalBuilding> buildings = new ArrayList<>();

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
                    ward.setRoomCount(wDto.getRoomCount());
                    ward.setDisplayOrder(k);
                    floor.getWards().add(ward);
                }
                building.getFloors().add(floor);
            }
            buildings.add(building);
        }

        buildingRepo.saveAll(buildings);
        return get(hospitalId);
    }

    private BuildingDto toDto(HospitalBuilding b) {
        BuildingDto dto = new BuildingDto();
        dto.setId(b.getId());
        dto.setName(b.getName());
        dto.setFloors(b.getFloors().stream().map(this::toDto).collect(Collectors.toList()));
        return dto;
    }

    private FloorDto toDto(HospitalFloor f) {
        FloorDto dto = new FloorDto();
        dto.setId(f.getId());
        dto.setName(f.getName());
        dto.setWards(f.getWards().stream().map(this::toDto).collect(Collectors.toList()));
        return dto;
    }

    private WardDto toDto(HospitalWard w) {
        WardDto dto = new WardDto();
        dto.setId(w.getId());
        dto.setName(w.getName());
        dto.setDailyCharge(w.getDailyCharge());
        dto.setRoomCount(w.getRoomCount());
        return dto;
    }
}

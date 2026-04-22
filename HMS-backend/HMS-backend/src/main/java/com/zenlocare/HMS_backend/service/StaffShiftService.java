package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.StaffShiftDTO;
import com.zenlocare.HMS_backend.dto.StaffShiftRequest;
import com.zenlocare.HMS_backend.entity.Hospital;
import com.zenlocare.HMS_backend.entity.ShiftType;
import com.zenlocare.HMS_backend.entity.StaffShift;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.repository.HospitalRepository;
import com.zenlocare.HMS_backend.repository.StaffShiftRepository;
import com.zenlocare.HMS_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StaffShiftService {

    private final StaffShiftRepository shiftRepository;
    private final UserRepository userRepository;
    private final HospitalRepository hospitalRepository;

    public List<StaffShiftDTO> getWeekShifts(UUID hospitalId, LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(6);
        return shiftRepository.findByHospitalIdAndShiftDateBetweenOrderByShiftDate(hospitalId, weekStart, weekEnd)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<StaffShiftDTO> getMonthShifts(UUID hospitalId, int year, int month) {
        return shiftRepository.findMonthlyShifts(hospitalId, year, month)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional
    public StaffShiftDTO assignShift(StaffShiftRequest request) {
        User user = userRepository.findById(request.getStaffId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        Hospital hospital = hospitalRepository.findById(request.getHospitalId())
                .orElseThrow(() -> new RuntimeException("Hospital not found"));

        if (shiftRepository.existsByUserIdAndShiftDate(request.getStaffId(), request.getShiftDate())) {
            throw new RuntimeException("Shift already assigned for this date");
        }

        StaffShift shift = StaffShift.builder()
                .user(user)
                .hospital(hospital)
                .shiftType(ShiftType.valueOf(request.getShiftType()))
                .shiftDate(request.getShiftDate())
                .build();

        return toDTO(shiftRepository.save(shift));
    }

    @Transactional
    public void removeShift(Long shiftId) {
        shiftRepository.deleteById(shiftId);
    }

    private StaffShiftDTO toDTO(StaffShift s) {
        String fullName = s.getUser().getFirstName();
        if (s.getUser().getLastName() != null) fullName += " " + s.getUser().getLastName();
        return StaffShiftDTO.builder()
                .id(s.getId())
                .staffId(s.getUser().getId())
                .staffName(fullName)
                .role(s.getUser().getRole().getName())
                .designation(s.getUser().getDesignation())
                .shiftType(s.getShiftType().name())
                .shiftDate(s.getShiftDate())
                .build();
    }
}

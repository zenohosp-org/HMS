package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.RoomAllocationRequest;
import com.zenlocare.HMS_backend.dto.RoomCreateRequest;
import com.zenlocare.HMS_backend.entity.Hospital;
import com.zenlocare.HMS_backend.entity.Patient;
import com.zenlocare.HMS_backend.entity.Room;
import com.zenlocare.HMS_backend.entity.RoomStatus;
import com.zenlocare.HMS_backend.repository.HospitalRepository;
import com.zenlocare.HMS_backend.repository.PatientRepository;
import com.zenlocare.HMS_backend.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomRepository roomRepository;
    private final HospitalRepository hospitalRepository;
    private final PatientRepository patientRepository;

    public List<Room> getRoomsForHospital(UUID hospitalId) {
        return roomRepository.findByHospitalId(hospitalId);
    }

    @Transactional
    public List<Room> generateRooms(RoomCreateRequest request) {
        Hospital hospital = hospitalRepository.findById(request.getHospitalId())
                .orElseThrow(() -> new RuntimeException("Hospital not found"));

        List<Room> newRooms = new ArrayList<>();
        // Simple logic to generate sequence. e.g. "GEN-01", "GEN-02"
        for (int i = 1; i <= request.getCount(); i++) {
            String tempRoomNumber = request.getRoomPrefix() + "-" + String.format("%02d", i);

            // Just append a random or timestamp suffix if it already exists to avoid unique
            // constraint issues in this basic loop
            int counter = i;
            while (roomRepository.findByHospitalIdAndRoomNumber(hospital.getId(), tempRoomNumber).isPresent()) {
                counter += 100;
                tempRoomNumber = request.getRoomPrefix() + "-" + String.format("%02d", counter);
            }

            Room room = Room.builder()
                    .hospital(hospital)
                    .roomNumber(tempRoomNumber)
                    .roomType(request.getRoomType())
                    .status(RoomStatus.AVAILABLE)
                    .build();

            newRooms.add(roomRepository.save(room));
        }

        return newRooms;
    }

    @Transactional
    public Room allocatePatient(RoomAllocationRequest request, UUID hospitalId) {
        Room room = roomRepository.findById(request.getRoomId())
                .orElseThrow(() -> new RuntimeException("Room not found"));

        if (!room.getHospital().getId().equals(hospitalId)) {
            throw new RuntimeException("Room does not belong to this hospital");
        }

        if (room.getStatus() != RoomStatus.AVAILABLE) {
            throw new RuntimeException("Room is not available");
        }

        Patient patient = patientRepository.findById(request.getPatientId())
                .orElseThrow(() -> new RuntimeException("Patient not found"));

        if (!patient.getHospital().getId().equals(hospitalId)) {
            throw new RuntimeException("Patient does not belong to this hospital");
        }

        // Unallocate if patient is currently in another room
        roomRepository.findByCurrentPatientId(patient.getId()).ifPresent(existingRoom -> {
            existingRoom.setStatus(RoomStatus.AVAILABLE);
            existingRoom.setCurrentPatient(null);
            existingRoom.setApproxDischargeTime(null);
            roomRepository.save(existingRoom);
        });

        room.setStatus(RoomStatus.OCCUPIED);
        room.setCurrentPatient(patient);
        if (request.getApproxDischargeTime() != null) {
            room.setApproxDischargeTime(request.getApproxDischargeTime());
        }

        return roomRepository.save(room);
    }

    @Transactional
    public Room deallocatePatient(Long roomId, UUID hospitalId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        if (!room.getHospital().getId().equals(hospitalId)) {
            throw new RuntimeException("Room does not belong to this hospital");
        }

        room.setStatus(RoomStatus.AVAILABLE);
        room.setCurrentPatient(null);
        room.setApproxDischargeTime(null);

        return roomRepository.save(room);
    }
}

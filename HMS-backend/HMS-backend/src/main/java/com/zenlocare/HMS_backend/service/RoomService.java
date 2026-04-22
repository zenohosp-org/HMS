package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.AttenderUpdateRequest;
import com.zenlocare.HMS_backend.dto.RoomAllocationRequest;
import com.zenlocare.HMS_backend.dto.RoomCreateRequest;
import com.zenlocare.HMS_backend.dto.RoomLogDTO;
import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.HospitalRepository;
import com.zenlocare.HMS_backend.repository.PatientRepository;
import com.zenlocare.HMS_backend.repository.RoomLogRepository;
import com.zenlocare.HMS_backend.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomRepository roomRepository;
    private final HospitalRepository hospitalRepository;
    private final PatientRepository patientRepository;
    private final RoomLogRepository roomLogRepository;

    public List<Room> getRoomsForHospital(UUID hospitalId) {
        return roomRepository.findByHospitalId(hospitalId);
    }

    @Transactional
    public List<Room> generateRooms(RoomCreateRequest request, String performedBy) {
        Hospital hospital = hospitalRepository.findById(request.getHospitalId())
                .orElseThrow(() -> new RuntimeException("Hospital not found"));

        List<Room> newRooms = new ArrayList<>();
        for (int i = 1; i <= request.getCount(); i++) {
            String tempRoomNumber = request.getRoomPrefix() + "-" + String.format("%02d", i);
            int counter = i;
            while (roomRepository.findByHospitalIdAndRoomNumber(hospital.getId(), tempRoomNumber).isPresent()) {
                counter += 100;
                tempRoomNumber = request.getRoomPrefix() + "-" + String.format("%02d", counter);
            }

            Room room = Room.builder()
                    .hospital(hospital)
                    .roomNumber(tempRoomNumber)
                    .roomType(request.getRoomType())
                    .pricePerDay(request.getPricePerDay())
                    .status(RoomStatus.AVAILABLE)
                    .build();

            Room saved = roomRepository.save(room);
            newRooms.add(saved);

            roomLogRepository.save(RoomLog.builder()
                    .room(saved)
                    .hospital(hospital)
                    .event(RoomLogEvent.ROOM_CREATED)
                    .roomNumber(saved.getRoomNumber())
                    .performedBy(performedBy)
                    .build());
        }

        return newRooms;
    }

    @Transactional
    public Room allocatePatient(RoomAllocationRequest request, UUID hospitalId, String performedBy) {
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

        roomRepository.findByCurrentPatientId(patient.getId()).ifPresent(existingRoom -> {
            existingRoom.setStatus(RoomStatus.AVAILABLE);
            existingRoom.setCurrentPatient(null);
            existingRoom.setApproxDischargeTime(null);
            roomRepository.save(existingRoom);
        });

        room.setStatus(RoomStatus.OCCUPIED);
        room.setCurrentPatient(patient);
        room.setAttenderName(request.getAttenderName());
        room.setAttenderPhone(request.getAttenderPhone());
        room.setAttenderRelationship(request.getAttenderRelationship());
        room.setAllocationToken(generateToken());
        if (request.getApproxDischargeTime() != null) {
            room.setApproxDischargeTime(request.getApproxDischargeTime());
        }

        Room saved = roomRepository.save(room);

        roomLogRepository.save(RoomLog.builder()
                .room(saved)
                .hospital(saved.getHospital())
                .event(RoomLogEvent.ALLOCATED)
                .roomNumber(saved.getRoomNumber())
                .patientName(patient.getFirstName() + " " + patient.getLastName())
                .patientMrn(patient.getMrn())
                .attenderName(request.getAttenderName())
                .allocationToken(saved.getAllocationToken())
                .performedBy(performedBy)
                .build());

        return saved;
    }

    @Transactional
    public Room deallocatePatient(Long roomId, UUID hospitalId, String performedBy) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        if (!room.getHospital().getId().equals(hospitalId)) {
            throw new RuntimeException("Room does not belong to this hospital");
        }

        String patientName = room.getCurrentPatient() != null
                ? room.getCurrentPatient().getFirstName() + " " + room.getCurrentPatient().getLastName()
                : null;
        String patientMrn = room.getCurrentPatient() != null ? room.getCurrentPatient().getMrn() : null;

        room.setStatus(RoomStatus.AVAILABLE);
        room.setCurrentPatient(null);
        room.setApproxDischargeTime(null);
        room.setAttenderName(null);
        room.setAttenderPhone(null);
        room.setAttenderRelationship(null);
        room.setAllocationToken(null);

        Room saved = roomRepository.save(room);

        roomLogRepository.save(RoomLog.builder()
                .room(saved)
                .hospital(saved.getHospital())
                .event(RoomLogEvent.DEALLOCATED)
                .roomNumber(saved.getRoomNumber())
                .patientName(patientName)
                .patientMrn(patientMrn)
                .performedBy(performedBy)
                .build());

        return saved;
    }

    @Transactional
    public Room updateAttender(Long roomId, AttenderUpdateRequest request, UUID hospitalId, String performedBy) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        if (!room.getHospital().getId().equals(hospitalId)) {
            throw new RuntimeException("Room does not belong to this hospital");
        }
        if (room.getStatus() != RoomStatus.OCCUPIED) {
            throw new RuntimeException("Room is not occupied");
        }

        boolean isNew = room.getAttenderName() == null;
        room.setAttenderName(request.getAttenderName());
        room.setAttenderPhone(request.getAttenderPhone());
        room.setAttenderRelationship(request.getAttenderRelationship());

        Room saved = roomRepository.save(room);

        String patientName = saved.getCurrentPatient() != null
                ? saved.getCurrentPatient().getFirstName() + " " + saved.getCurrentPatient().getLastName()
                : null;
        String patientMrn = saved.getCurrentPatient() != null ? saved.getCurrentPatient().getMrn() : null;

        roomLogRepository.save(RoomLog.builder()
                .room(saved)
                .hospital(saved.getHospital())
                .event(isNew ? RoomLogEvent.ATTENDER_ASSIGNED : RoomLogEvent.ATTENDER_UPDATED)
                .roomNumber(saved.getRoomNumber())
                .patientName(patientName)
                .patientMrn(patientMrn)
                .attenderName(request.getAttenderName())
                .allocationToken(saved.getAllocationToken())
                .performedBy(performedBy)
                .build());

        return saved;
    }

    public List<RoomLogDTO> getHospitalLogs(UUID hospitalId, String search) {
        List<RoomLog> logs = (search != null && !search.isBlank())
                ? roomLogRepository.searchByHospital(hospitalId, search.trim())
                : roomLogRepository.findByHospitalIdOrderByCreatedAtDesc(hospitalId);
        return logs.stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<RoomLogDTO> getRoomLogs(Long roomId, UUID hospitalId) {
        return roomLogRepository.findByRoomIdOrderByCreatedAtDesc(roomId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    private RoomLogDTO toDTO(RoomLog log) {
        return RoomLogDTO.builder()
                .id(log.getId())
                .roomId(log.getRoom().getId())
                .roomNumber(log.getRoomNumber())
                .event(log.getEvent().name())
                .patientName(log.getPatientName())
                .patientMrn(log.getPatientMrn())
                .attenderName(log.getAttenderName())
                .allocationToken(log.getAllocationToken())
                .performedBy(log.getPerformedBy())
                .createdAt(log.getCreatedAt())
                .build();
    }

    private String generateToken() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O, 0, I, 1 to avoid confusion
        StringBuilder token = new StringBuilder(8);
        for (int i = 0; i < 8; i++) {
            token.append(chars.charAt(ThreadLocalRandom.current().nextInt(chars.length())));
        }
        return token.toString();
    }
}

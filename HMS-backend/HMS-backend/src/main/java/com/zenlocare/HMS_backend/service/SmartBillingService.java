package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.SmartBillingSuggestion;
import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SmartBillingService {

    private final RoomRepository roomRepository;
    private final RadiologyOrderRepository radiologyOrderRepository;
    private final AppointmentRepository appointmentRepository;

    public SmartBillingSuggestion getSuggestions(Integer patientId) {

        // ── Room charge ────────────────────────────────────────────────
        SmartBillingSuggestion.RoomSuggestion roomSuggestion = null;
        Optional<Room> roomOpt = roomRepository.findByCurrentPatientId(patientId);
        if (roomOpt.isPresent()) {
            Room room = roomOpt.get();
            if (room.getPricePerDay() != null && room.getPricePerDay().compareTo(BigDecimal.ZERO) > 0) {
                long days = room.getUpdatedAt() != null
                        ? Math.max(1, ChronoUnit.DAYS.between(room.getUpdatedAt().toLocalDate(), LocalDate.now()))
                        : 1;
                BigDecimal total = room.getPricePerDay().multiply(BigDecimal.valueOf(days));
                roomSuggestion = SmartBillingSuggestion.RoomSuggestion.builder()
                        .roomNumber(room.getRoomNumber())
                        .roomType(room.getRoomType().name())
                        .pricePerDay(room.getPricePerDay())
                        .daysStayed(days)
                        .totalCharge(total)
                        .build();
            }
        }

        // ── Pending radiology orders ────────────────────────────────────
        List<SmartBillingSuggestion.RadiologySuggestion> radiologySuggestions =
                radiologyOrderRepository.findByPatientIdOrderByCreatedAtDesc(patientId)
                        .stream()
                        .filter(r -> r.getStatus() == RadiologyStatus.PENDING_SCAN
                                  || r.getStatus() == RadiologyStatus.AWAITING_REPORT)
                        .map(r -> SmartBillingSuggestion.RadiologySuggestion.builder()
                                .orderId(r.getId())
                                .serviceName(r.getServiceName())
                                .status(r.getStatus().name())
                                .scheduledDate(r.getScheduledDate() != null ? r.getScheduledDate().toString() : null)
                                .build())
                        .collect(Collectors.toList());

        // ── Recent appointments (last 60 days, COMPLETED) ───────────────
        List<SmartBillingSuggestion.AppointmentSuggestion> apptSuggestions =
                appointmentRepository.findByPatientIdOrderByApptDateDescApptTimeDesc(patientId)
                        .stream()
                        .filter(a -> a.getStatus() == Appointment.AppointmentStatus.COMPLETED
                                && a.getApptDate() != null
                                && !a.getApptDate().isBefore(LocalDate.now().minusDays(60)))
                        .map(a -> {
                            Doctor doc = a.getDoctor();
                            String docName = doc.getUser() != null
                                    ? doc.getUser().getFirstName() + (doc.getUser().getLastName() != null ? " " + doc.getUser().getLastName() : "")
                                    : "Unknown";
                            BigDecimal fee = doc.getConsultationFee() != null ? doc.getConsultationFee() : BigDecimal.ZERO;
                            return SmartBillingSuggestion.AppointmentSuggestion.builder()
                                    .appointmentId(a.getId().toString())
                                    .doctorName(docName)
                                    .specialization(doc.getSpecialization())
                                    .consultationFee(fee)
                                    .apptDate(a.getApptDate().toString())
                                    .build();
                        })
                        .collect(Collectors.toList());

        return SmartBillingSuggestion.builder()
                .roomCharge(roomSuggestion)
                .radiologyOrders(radiologySuggestions)
                .appointments(apptSuggestions)
                .build();
    }
}

package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.SmartBillingSuggestion;
import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final AdmissionRepository admissionRepository;

    @Transactional(readOnly = true)
    public SmartBillingSuggestion getSuggestions(Integer patientId, UUID admissionId) {
        LocalDate appointmentFrom = admissionId != null
                ? admissionRepository.findById(admissionId)
                        .map(a -> a.getAdmissionDate().toLocalDate())
                        .orElse(LocalDate.now().minusDays(60))
                : LocalDate.now().minusDays(60);

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
        List<SmartBillingSuggestion.AppointmentSuggestion> apptSuggestions = new ArrayList<>(
                appointmentRepository.findByPatientIdOrderByApptDateDescApptTimeDesc(patientId)
                        .stream()
                        .filter(a -> a.getStatus() == Appointment.AppointmentStatus.COMPLETED
                                && a.getApptDate() != null
                                && !a.getApptDate().isBefore(appointmentFrom)
                                && !a.getApptDate().isAfter(LocalDate.now()))
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
                        .collect(Collectors.toList()));

        // ── Source appointment for OPD→IPD conversions ───────────────────
        // The source appointment may still be CONFIRMED (not yet COMPLETED) when the
        // patient is admitted directly from OPD. That status excludes it from the
        // COMPLETED filter above, so we inject it here — always at index 0 — to
        // guarantee the consultation fee surfaces in the IPD bill regardless of status.
        if (admissionId != null) {
            admissionRepository.findById(admissionId).ifPresent(adm -> {
                Appointment src = adm.getSourceAppointment();
                if (src != null && src.getDoctor() != null) {
                    String srcId = src.getId().toString();
                    boolean alreadyPresent = apptSuggestions.stream()
                            .anyMatch(s -> srcId.equals(s.getAppointmentId()));
                    if (!alreadyPresent) {
                        Doctor doc = src.getDoctor();
                        BigDecimal fee = doc.getConsultationFee() != null ? doc.getConsultationFee() : BigDecimal.ZERO;
                        if (fee.compareTo(BigDecimal.ZERO) > 0) {
                            String docName = doc.getUser() != null
                                    ? doc.getUser().getFirstName() + (doc.getUser().getLastName() != null ? " " + doc.getUser().getLastName() : "")
                                    : "Unknown";
                            apptSuggestions.add(0, SmartBillingSuggestion.AppointmentSuggestion.builder()
                                    .appointmentId(srcId)
                                    .doctorName(docName)
                                    .specialization(doc.getSpecialization())
                                    .consultationFee(fee)
                                    .apptDate(src.getApptDate() != null ? src.getApptDate().toString() : null)
                                    .build());
                        }
                    }
                }
            });
        }

        return SmartBillingSuggestion.builder()
                .roomCharge(roomSuggestion)
                .radiologyOrders(radiologySuggestions)
                .appointments(apptSuggestions)
                .build();
    }

    /**
     * Computes the full estimated total for an active IPD admission.
     * Combines room charges and completed consultation fees.
     * Returns BigDecimal.ZERO if no admission or room data is found.
     */
    public BigDecimal computeEstimatedTotal(Integer patientId, UUID admissionId) {
        try {
            BigDecimal total = BigDecimal.ZERO;
            SmartBillingSuggestion suggestions = getSuggestions(patientId, admissionId);
            if (suggestions.getRoomCharge() != null && suggestions.getRoomCharge().getTotalCharge() != null) {
                total = total.add(suggestions.getRoomCharge().getTotalCharge());
            }
            if (suggestions.getAppointments() != null) {
                for (SmartBillingSuggestion.AppointmentSuggestion appt : suggestions.getAppointments()) {
                    if (appt.getConsultationFee() != null) {
                        total = total.add(appt.getConsultationFee());
                    }
                }
            }
            return total;
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }
}

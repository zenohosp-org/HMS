package com.zenlocare.HMS_backend.dto;

import com.zenlocare.HMS_backend.entity.Appointment;
import com.zenlocare.HMS_backend.entity.Patient;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

@Data
@Builder
public class AppointmentDto {
        private UUID id;
        private UUID hospitalId;
        private UUID branchId;
        private Integer patientId;
        private String patientName;
        private String patientPhone;

        private UUID doctorId;
        private String doctorName;
        private String doctorSpecialization;

        private LocalDate apptDate;
        private LocalTime apptTime;
        private LocalTime apptEndTime;

        private Appointment.AppointmentType type;
        private Appointment.AppointmentStatus status;
        private Integer tokenNumber;

        private String chiefComplaint;
        private String cancelledReason;

        private UUID priceListId;
        private String priceListName;

        private UUID checkupBookingId;
        private String checkupBookingNumber;
        private String checkupPackageName;

        private UUID createdById;
        private String createdByName;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public static AppointmentDto fromEntity(Appointment a) {
                String pName = a.getPatient().getFirstName()
                                + (a.getPatient().getLastName() != null ? " " + a.getPatient().getLastName() : "");
                String dName = a.getDoctor() != null
                                ? a.getDoctor().getUser().getFirstName() + (a.getDoctor().getUser().getLastName() != null ? " " + a.getDoctor().getUser().getLastName() : "")
                                : null;
                String creatorName = a.getCreatedBy().getFirstName()
                                + (a.getCreatedBy().getLastName() != null ? " " + a.getCreatedBy().getLastName() : "");

                return AppointmentDto.builder()
                                .id(a.getId())
                                .hospitalId(a.getHospital().getId())
                                .branchId(a.getBranchId())
                                .patientId(a.getPatient().getId())
                                .patientName(pName)
                                .patientPhone(a.getPatient().getPhone())
                                .doctorId(a.getDoctor() != null ? a.getDoctor().getId() : null)
                                .doctorName(dName)
                                .doctorSpecialization(a.getDoctor() != null ? a.getDoctor().getSpecialization() : null)
                                .apptDate(a.getApptDate())
                                .apptTime(a.getApptTime())
                                .apptEndTime(a.getApptEndTime())
                                .type(a.getType())
                                .status(a.getStatus())
                                .tokenNumber(a.getTokenNumber())
                                .chiefComplaint(a.getChiefComplaint())
                                .cancelledReason(a.getCancelledReason())
                                .priceListId(a.getPriceList() != null ? a.getPriceList().getId() : null)
                                .priceListName(a.getPriceList() != null ? a.getPriceList().getName() : null)
                                .checkupBookingId(a.getCheckupBooking() != null ? a.getCheckupBooking().getId() : null)
                                .checkupBookingNumber(a.getCheckupBooking() != null ? a.getCheckupBooking().getBookingNumber() : null)
                                .checkupPackageName(a.getCheckupBooking() != null && a.getCheckupBooking().getHealthPackage() != null ? a.getCheckupBooking().getHealthPackage().getName() : null)
                                .createdById(a.getCreatedBy().getId())
                                .createdByName(creatorName)
                                .createdAt(a.getCreatedAt())
                                .updatedAt(a.getUpdatedAt())
                                .build();
        }
}

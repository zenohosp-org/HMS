package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.CreateRadiologyOrderRequest;
import com.zenlocare.HMS_backend.dto.RadiologyOrderDTO;
import com.zenlocare.HMS_backend.dto.RadiologyReportRequest;
import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.AdmissionRepository;
import com.zenlocare.HMS_backend.repository.HospitalRepository;
import com.zenlocare.HMS_backend.repository.PatientRepository;
import com.zenlocare.HMS_backend.repository.RadiologyOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Transactional(readOnly = true)
@Service
@RequiredArgsConstructor
public class RadiologyService {

    private static final String AMBIGUOUS_FREE = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

    private final RadiologyOrderRepository orderRepository;
    private final HospitalRepository hospitalRepository;
    private final PatientRepository patientRepository;
    private final AdmissionRepository admissionRepository;
    // @Lazy avoids a constructor-time cycle: InvoiceService already injects
    // RadiologyOrderRepository, and now RadiologyService also depends on
    // InvoiceService for auto-billing on report generation.
    @org.springframework.context.annotation.Lazy
    private final InvoiceService invoiceService;

    // Logical alias for the reports page — covers both REPORT_GENERATED (report
    // exists, billing pending) and BILLED (report exists, already invoiced).
    // Auto-billing on report generation moves orders to BILLED within the same
    // transaction, so without this union the "completed reports" view was empty
    // for every priced order.
    private static final java.util.List<RadiologyStatus> COMPLETED_STATUSES =
            java.util.List.of(RadiologyStatus.REPORT_GENERATED, RadiologyStatus.BILLED);

    public List<RadiologyOrderDTO> getOrders(UUID hospitalId, String status) {
        if (status != null && !status.isBlank()) {
            if ("COMPLETED".equalsIgnoreCase(status)) {
                return orderRepository
                        .findByHospitalIdAndStatusInOrderByCreatedAtDesc(hospitalId, COMPLETED_STATUSES)
                        .stream().map(this::toDTO).collect(Collectors.toList());
            }
            RadiologyStatus rs = RadiologyStatus.valueOf(status);
            return orderRepository.findByHospitalIdAndStatusOrderByCreatedAtDesc(hospitalId, rs)
                    .stream().map(this::toDTO).collect(Collectors.toList());
        }
        return orderRepository.findByHospitalIdOrderByCreatedAtDesc(hospitalId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    /** Number of orders whose radiologist has written findings, billed or not. */
    public long countCompletedReports(UUID hospitalId) {
        return orderRepository.countByHospitalIdAndStatusIn(hospitalId, COMPLETED_STATUSES);
    }

    public List<RadiologyOrderDTO> getByPatient(Integer patientId) {
        return orderRepository.findByPatientIdOrderByCreatedAtDesc(patientId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<RadiologyOrderDTO> getByAdmission(UUID admissionId) {
        return orderRepository.findByAdmissionIdOrderByCreatedAtDesc(admissionId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public RadiologyOrderDTO getOrder(Long id) {
        return toDTO(orderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Radiology order not found")));
    }

    public long countByStatus(UUID hospitalId, String status) {
        return orderRepository.countByHospitalIdAndStatus(hospitalId, RadiologyStatus.valueOf(status));
    }

    @Transactional
    public RadiologyOrderDTO createOrder(CreateRadiologyOrderRequest req, String createdByName) {
        Hospital hospital = hospitalRepository.findById(req.getHospitalId())
                .orElseThrow(() -> new RuntimeException("Hospital not found"));
        Patient patient = patientRepository.findById(req.getPatientId())
                .orElseThrow(() -> new RuntimeException("Patient not found"));
        if (patient.getHospital() == null
                || !req.getHospitalId().equals(patient.getHospital().getId())) {
            throw new RuntimeException("Patient does not belong to this hospital");
        }

        Admission admission = null;
        if (req.getAdmissionId() != null) {
            admission = admissionRepository.findById(req.getAdmissionId())
                    .orElseThrow(() -> new RuntimeException("Admission not found"));
            if (!admission.getPatient().getId().equals(patient.getId())) {
                throw new RuntimeException("Admission does not belong to this patient");
            }
            if (admission.getHospital() == null
                    || !req.getHospitalId().equals(admission.getHospital().getId())) {
                throw new RuntimeException("Admission does not belong to this hospital");
            }
        }

        RadiologyOrder order = RadiologyOrder.builder()
                .hospital(hospital)
                .patient(patient)
                .admission(admission)
                .serviceName(req.getServiceName())
                .specializationName(req.getSpecializationName())
                .referredByName(createdByName)
                .technicianId(req.getTechnicianId())
                .technicianName(req.getTechnicianName())
                .priority(req.getPriority() != null ? RadiologyPriority.valueOf(req.getPriority()) : RadiologyPriority.ROUTINE)
                .status(RadiologyStatus.PENDING_SCAN)
                .scheduledDate(req.getScheduledDate())
                .price(req.getPrice())
                .createdByName(createdByName)
                .build();

        return toDTO(orderRepository.save(order));
    }

    @Transactional
    public RadiologyOrderDTO markScanned(Long id) {
        RadiologyOrder order = orderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        if (order.getStatus() != RadiologyStatus.PENDING_SCAN) {
            throw new RuntimeException("Order is not in PENDING_SCAN state");
        }
        order.setStatus(RadiologyStatus.AWAITING_REPORT);
        order.setScannedAt(LocalDateTime.now());
        return toDTO(orderRepository.save(order));
    }

    @Transactional
    public RadiologyOrderDTO generateReport(Long id, RadiologyReportRequest req) {
        RadiologyOrder order = orderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        if (order.getStatus() != RadiologyStatus.AWAITING_REPORT) {
            throw new RuntimeException("Order is not in AWAITING_REPORT state");
        }
        order.setStatus(RadiologyStatus.REPORT_GENERATED);
        order.setFindings(req.getFindings());
        order.setObservation(req.getObservation());
        order.setReportedAt(LocalDateTime.now());
        order.setReportId(generateReportId());
        RadiologyOrder saved = orderRepository.save(order);

        // Auto-bill if a price was captured at order time. Routes to the
        // patient's active IPD invoice if admitted; otherwise creates a
        // standalone OPD radiology invoice. No-op if price is null —
        // staff can still bill manually via the legacy CreateInvoice flow.
        try {
            invoiceService.billRadiologyOrder(saved);
        } catch (Exception e) {
            // Billing failure must not block the report from being saved —
            // staff can retry billing manually. Log and continue.
            org.slf4j.LoggerFactory.getLogger(RadiologyService.class)
                    .warn("Auto-bill failed for radiology order {}: {}", saved.getId(), e.getMessage());
        }
        return toDTO(saved);
    }

    private String generateReportId() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 7; i++) {
            sb.append(AMBIGUOUS_FREE.charAt(ThreadLocalRandom.current().nextInt(AMBIGUOUS_FREE.length())));
        }
        return sb.toString();
    }

    private RadiologyOrderDTO toDTO(RadiologyOrder o) {
        String patientName = o.getPatient().getFirstName() + " " + o.getPatient().getLastName();
        return RadiologyOrderDTO.builder()
                .id(o.getId())
                .hospitalId(o.getHospital().getId())
                .patientId(o.getPatient().getId())
                .patientName(patientName)
                .patientUhid(o.getPatient().getUhid())
                .admissionId(o.getAdmission() != null ? o.getAdmission().getId() : null)
                .admissionNumber(o.getAdmission() != null ? o.getAdmission().getAdmissionNumber() : null)
                .serviceName(o.getServiceName())
                .specializationName(o.getSpecializationName())
                .referredByName(o.getReferredByName())
                .technicianId(o.getTechnicianId())
                .technicianName(o.getTechnicianName())
                .priority(o.getPriority().name())
                .status(o.getStatus().name())
                .scheduledDate(o.getScheduledDate())
                .billNo(o.getBillNo())
                .price(o.getPrice())
                .scannedAt(o.getScannedAt())
                .reportedAt(o.getReportedAt())
                .findings(o.getFindings())
                .observation(o.getObservation())
                .reportId(o.getReportId())
                .createdByName(o.getCreatedByName())
                .createdAt(o.getCreatedAt())
                .build();
    }
}

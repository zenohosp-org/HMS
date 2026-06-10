package com.zenlocare.HMS_backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zenlocare.HMS_backend.dto.BloodBankDtos;
import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Blood-bank domain service. Owns donor registry, bag lifecycle, and
 * issuance — which atomically flips status + auto-bills the receiving
 * patient (IPD-aware: appends to the active admission invoice; falls
 * back to a standalone OPD invoice for walk-ins).
 *
 * Lookup configuration (blood groups, components, statuses, donor types,
 * source types) is read via BloodBankLookupRepository. Component shelf
 * life lives in lookup.metadata.shelfLifeDays — drives expiry auto-calc
 * at bag registration.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BloodBankService {

    private static final int EXPIRY_WARN_DAYS = 7;
    private static final ObjectMapper JSON = new ObjectMapper();

    private final BloodBankLookupRepository lookupRepo;
    private final BloodDonorRepository donorRepo;
    private final BloodUnitRepository unitRepo;
    private final InvoiceRepository invoiceRepository;
    private final HospitalRepository hospitalRepository;
    private final PatientRepository patientRepository;
    private final AdmissionRepository admissionRepository;
    private final UserRepository userRepository;

    // ───── Lookups ────────────────────────────────────────────────────

    public List<BloodBankDtos.LookupDto> listLookups(UUID hospitalId, String lookupType) {
        return lookupRepo.findActiveByHospitalIdAndType(hospitalId, lookupType).stream()
                .map(this::toLookupDto)
                .toList();
    }

    private BloodBankDtos.LookupDto toLookupDto(BloodBankLookup l) {
        return BloodBankDtos.LookupDto.builder()
                .id(l.getId())
                .lookupType(l.getLookupType())
                .code(l.getCode())
                .label(l.getLabel())
                .metadata(l.getMetadata())
                .displayOrder(l.getDisplayOrder())
                .isSystem(Boolean.TRUE.equals(l.getIsSystem()))
                .isActive(Boolean.TRUE.equals(l.getIsActive()))
                .build();
    }

    // ───── Donors ─────────────────────────────────────────────────────

    public List<BloodBankDtos.DonorDto> listDonors(UUID hospitalId) {
        return donorRepo.findByHospital_IdOrderByCreatedAtDesc(hospitalId).stream()
                .map(this::toDonorDto)
                .toList();
    }

    public BloodBankDtos.DonorDto getDonor(UUID id) {
        return toDonorDto(donorRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Donor not found")));
    }

    @Transactional
    public BloodBankDtos.DonorDto registerDonor(UUID hospitalId, BloodBankDtos.DonorRequest req) {
        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new RuntimeException("Hospital not found"));

        long existing = donorRepo.countByHospital_Id(hospitalId);
        String donorCode = "DON-" + String.format("%04d", existing + 1);

        BloodDonor donor = BloodDonor.builder()
                .hospital(hospital)
                .donorCode(donorCode)
                .firstName(req.getFirstName())
                .lastName(req.getLastName())
                .phone(req.getPhone())
                .email(req.getEmail())
                .dob(req.getDob())
                .gender(req.getGender())
                .bloodGroupCode(req.getBloodGroupCode())
                .donorTypeCode(req.getDonorTypeCode())
                .address(req.getAddress())
                .aadhaarNumber(req.getAadhaarNumber())
                .patientId(req.getPatientId())
                .notes(req.getNotes())
                .build();

        return toDonorDto(donorRepo.save(donor));
    }

    @Transactional
    public BloodBankDtos.DonorDto updateDonor(UUID id, BloodBankDtos.DonorRequest req) {
        BloodDonor donor = donorRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Donor not found"));
        if (req.getFirstName() != null) donor.setFirstName(req.getFirstName());
        if (req.getLastName() != null) donor.setLastName(req.getLastName());
        if (req.getPhone() != null) donor.setPhone(req.getPhone());
        if (req.getEmail() != null) donor.setEmail(req.getEmail());
        if (req.getDob() != null) donor.setDob(req.getDob());
        if (req.getGender() != null) donor.setGender(req.getGender());
        if (req.getBloodGroupCode() != null) donor.setBloodGroupCode(req.getBloodGroupCode());
        if (req.getDonorTypeCode() != null) donor.setDonorTypeCode(req.getDonorTypeCode());
        if (req.getAddress() != null) donor.setAddress(req.getAddress());
        if (req.getAadhaarNumber() != null) donor.setAadhaarNumber(req.getAadhaarNumber());
        if (req.getPatientId() != null) donor.setPatientId(req.getPatientId());
        if (req.getNotes() != null) donor.setNotes(req.getNotes());
        return toDonorDto(donorRepo.save(donor));
    }

    private BloodBankDtos.DonorDto toDonorDto(BloodDonor d) {
        return BloodBankDtos.DonorDto.builder()
                .id(d.getId())
                .hospitalId(d.getHospital() != null ? d.getHospital().getId() : null)
                .donorCode(d.getDonorCode())
                .firstName(d.getFirstName())
                .lastName(d.getLastName())
                .phone(d.getPhone())
                .email(d.getEmail())
                .dob(d.getDob())
                .gender(d.getGender())
                .bloodGroupCode(d.getBloodGroupCode())
                .donorTypeCode(d.getDonorTypeCode())
                .address(d.getAddress())
                .aadhaarNumber(d.getAadhaarNumber())
                .patientId(d.getPatientId())
                .totalDonations(d.getTotalDonations())
                .lastDonationDate(d.getLastDonationDate())
                .isEligible(d.getIsEligible())
                .notes(d.getNotes())
                .createdAt(d.getCreatedAt())
                .updatedAt(d.getUpdatedAt())
                .build();
    }

    // ───── Units (inventory) ──────────────────────────────────────────

    public List<BloodBankDtos.UnitDto> listUnits(UUID hospitalId, String groupCode,
                                                 String componentCode, String statusCode) {
        LocalDate warnBefore = LocalDate.now().plusDays(EXPIRY_WARN_DAYS);
        return unitRepo.filter(hospitalId,
                        blank(groupCode), blank(componentCode), blank(statusCode))
                .stream()
                .map(u -> toUnitDto(u, warnBefore))
                .toList();
    }

    public BloodBankDtos.UnitDto getUnit(UUID id) {
        BloodUnit unit = unitRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Unit not found"));
        return toUnitDto(unit, LocalDate.now().plusDays(EXPIRY_WARN_DAYS));
    }

    @Transactional
    public BloodBankDtos.UnitDto registerUnit(UUID hospitalId, BloodBankDtos.UnitRequest req) {
        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new RuntimeException("Hospital not found"));

        if (req.getBagNumber() == null || req.getBagNumber().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bag number is required");
        }
        unitRepo.findByHospital_IdAndBagNumber(hospitalId, req.getBagNumber())
                .ifPresent(b -> { throw new ResponseStatusException(HttpStatus.CONFLICT, "Bag number already exists"); });

        BloodDonor donor = req.getDonorId() != null
                ? donorRepo.findById(req.getDonorId()).orElse(null)
                : null;

        LocalDate collection = req.getCollectionDate() != null ? req.getCollectionDate() : LocalDate.now();
        LocalDate expiry = req.getExpiryDate();
        if (expiry == null) {
            int shelfLife = resolveShelfLifeDays(hospitalId, req.getComponentCode());
            expiry = collection.plusDays(shelfLife);
        }

        BloodUnit unit = BloodUnit.builder()
                .hospital(hospital)
                .bagNumber(req.getBagNumber())
                .bloodGroupCode(req.getBloodGroupCode())
                .componentCode(req.getComponentCode())
                .statusCode(Boolean.TRUE.equals(req.getScreeningPassed()) ? "AVAILABLE" : "QUARANTINE")
                .sourceCode(req.getSourceCode() != null ? req.getSourceCode() : "IN_HOUSE_DONOR")
                .donor(donor)
                .volumeMl(req.getVolumeMl())
                .collectionDate(collection)
                .expiryDate(expiry)
                .storageLocation(req.getStorageLocation())
                .screeningPassed(Boolean.TRUE.equals(req.getScreeningPassed()))
                .costPrice(req.getCostPrice())
                .salePrice(req.getSalePrice())
                .notes(req.getNotes())
                .build();

        BloodUnit saved = unitRepo.save(unit);
        if (donor != null) {
            donor.setTotalDonations((donor.getTotalDonations() == null ? 0 : donor.getTotalDonations()) + 1);
            donor.setLastDonationDate(collection);
            donorRepo.save(donor);
        }
        return toUnitDto(saved, LocalDate.now().plusDays(EXPIRY_WARN_DAYS));
    }

    @Transactional
    public BloodBankDtos.UnitDto updateUnitStatus(UUID id, String newStatusCode) {
        BloodUnit unit = unitRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Unit not found"));
        if ("ISSUED".equals(unit.getStatusCode())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Issued units cannot be re-statused — register a new bag");
        }
        unit.setStatusCode(newStatusCode);
        if ("AVAILABLE".equals(newStatusCode)) {
            unit.setScreeningPassed(true);
        }
        return toUnitDto(unitRepo.save(unit), LocalDate.now().plusDays(EXPIRY_WARN_DAYS));
    }

    /**
     * Atomic issuance + billing. Bag flips to ISSUED, audit fields set,
     * an InvoiceItem with item_type="BLOOD_BANK" is appended to the
     * patient's active admission invoice (or a fresh standalone OPD
     * invoice is created). The link is recorded back on the bag so a
     * future cancel can find the line item.
     */
    @Transactional
    public BloodBankDtos.UnitDto issueUnit(UUID unitId, BloodBankDtos.IssueUnitRequest req, UUID issuedByUserId) {
        BloodUnit unit = unitRepo.findById(unitId)
                .orElseThrow(() -> new RuntimeException("Unit not found"));
        if (!"AVAILABLE".equals(unit.getStatusCode()) && !"RESERVED".equals(unit.getStatusCode())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only AVAILABLE or RESERVED units can be issued; this bag is " + unit.getStatusCode());
        }
        if (unit.getExpiryDate() != null && unit.getExpiryDate().isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot issue an expired bag — mark it EXPIRED first");
        }
        if (req.getPatientId() == null) {
            // Surfaces a clean 400 to callers (notably OTM) instead of a 500
            // when an OT booking has no linked hmsPatientId. OTM Claude
            // flagged this as a callsite worth guarding clearly.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "patientId is required for issuance");
        }

        Patient patient = patientRepository.findById(req.getPatientId())
                .orElseThrow(() -> new RuntimeException("Patient not found"));

        Admission admission = req.getAdmissionId() != null
                ? admissionRepository.findById(req.getAdmissionId()).orElse(null)
                : admissionRepository.findByPatientIdAndStatus(patient.getId(), AdmissionStatus.ADMITTED)
                        .orElse(null);

        User issuer = issuedByUserId != null
                ? userRepository.findById(issuedByUserId).orElse(null)
                : null;

        BigDecimal salePrice = req.getSalePrice() != null
                ? req.getSalePrice()
                : (unit.getSalePrice() != null ? unit.getSalePrice() : BigDecimal.ZERO);

        // Auto-bill — IPD path appends to admission invoice; OPD path
        // creates a standalone. Either way we capture the InvoiceItem
        // id on the bag for downstream reversal.
        Invoice invoice;
        if (admission != null) {
            invoice = invoiceRepository.findAllByAdmission_IdOrderByCreatedAtDesc(admission.getId())
                    .stream().findFirst()
                    .orElseGet(() -> createBlankAdmissionInvoice(unit.getHospital(), patient, admission));
            if (invoice.getItems() == null) invoice.setItems(new ArrayList<>());
            InvoiceItem line = InvoiceItem.builder()
                    .invoice(invoice)
                    .itemType("BLOOD_BANK")
                    .description(buildItemDescription(unit))
                    .quantity(1)
                    .unitPrice(salePrice)
                    .totalPrice(salePrice)
                    .build();
            invoice.getItems().add(line);
            recomputeInvoiceTotal(invoice);
            if (InvoiceStatus.PAID.equals(invoice.getStatus()) || InvoiceStatus.SETTLED.equals(invoice.getStatus())) {
                invoice.setStatus(InvoiceStatus.UNSETTLED);
            }
            invoice.setUpdatedAt(LocalDateTime.now());
            Invoice saved = invoiceRepository.save(invoice);
            unit.setInvoiceItemId(saved.getItems().stream()
                    .filter(it -> it == line || (it.getId() != null && it.getId().equals(line.getId())))
                    .findFirst().map(InvoiceItem::getId).orElse(null));
        } else {
            String invoiceNum = HospitalIdPrefix.of(unit.getHospital())
                    + "BLD-" + unitId.toString().replace("-", "").substring(0, 12).toUpperCase();
            InvoiceItem line = InvoiceItem.builder()
                    .itemType("BLOOD_BANK")
                    .description(buildItemDescription(unit))
                    .quantity(1)
                    .unitPrice(salePrice)
                    .totalPrice(salePrice)
                    .build();
            Invoice fresh = Invoice.builder()
                    .invoiceNumber(invoiceNum)
                    .hospital(unit.getHospital())
                    .patient(patient)
                    .subtotal(salePrice)
                    .tax(BigDecimal.ZERO)
                    .discount(BigDecimal.ZERO)
                    .total(salePrice)
                    .status(InvoiceStatus.UNPAID)
                    .notes("Blood bag " + unit.getBagNumber())
                    .build();
            line.setInvoice(fresh);
            fresh.setItems(new ArrayList<>(List.of(line)));
            Invoice saved = invoiceRepository.save(fresh);
            unit.setInvoiceItemId(saved.getItems().get(0).getId());
        }

        unit.setStatusCode("ISSUED");
        unit.setIssuedToPatient(patient);
        unit.setIssuedToAdmission(admission);
        unit.setIssuedByUser(issuer);
        unit.setIssuedAt(LocalDateTime.now());
        unit.setIssuedDoctorName(req.getDoctorName());
        unit.setReplacementsPledged(req.getReplacementsPledged() != null ? req.getReplacementsPledged() : 0);
        if (req.getNotes() != null && !req.getNotes().isBlank()) {
            unit.setNotes(unit.getNotes() == null ? req.getNotes() : (unit.getNotes() + "\n" + req.getNotes()));
        }
        if (req.getSalePrice() != null) unit.setSalePrice(req.getSalePrice());

        return toUnitDto(unitRepo.save(unit), LocalDate.now().plusDays(EXPIRY_WARN_DAYS));
    }

    private Invoice createBlankAdmissionInvoice(Hospital hospital, Patient patient, Admission admission) {
        String invoiceNum = HospitalIdPrefix.of(hospital)
                + "IPD-" + admission.getId().toString().replace("-", "").substring(0, 12).toUpperCase();
        Invoice invoice = Invoice.builder()
                .invoiceNumber(invoiceNum)
                .hospital(hospital)
                .patient(patient)
                .admission(admission)
                .subtotal(BigDecimal.ZERO)
                .tax(BigDecimal.ZERO)
                .discount(BigDecimal.ZERO)
                .total(BigDecimal.ZERO)
                .status(InvoiceStatus.UNPAID)
                .notes("Auto-created on blood-bank issuance")
                .build();
        invoice.setItems(new ArrayList<>());
        return invoiceRepository.save(invoice);
    }

    private void recomputeInvoiceTotal(Invoice invoice) {
        BigDecimal subtotal = invoice.getItems() == null ? BigDecimal.ZERO
                : invoice.getItems().stream()
                        .map(it -> it.getTotalPrice() != null ? it.getTotalPrice() : BigDecimal.ZERO)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal tax = invoice.getTax() != null ? invoice.getTax() : BigDecimal.ZERO;
        BigDecimal discount = invoice.getDiscount() != null ? invoice.getDiscount() : BigDecimal.ZERO;
        invoice.setSubtotal(subtotal);
        invoice.setTotal(subtotal.add(tax).subtract(discount));
    }

    private String buildItemDescription(BloodUnit unit) {
        return "Blood Bag " + unit.getBagNumber()
                + " · " + unit.getBloodGroupCode()
                + " · " + unit.getComponentCode();
    }

    // ───── Stats ──────────────────────────────────────────────────────

    public BloodBankDtos.StatsDto getStats(UUID hospitalId) {
        LocalDate warnBefore = LocalDate.now().plusDays(EXPIRY_WARN_DAYS);
        long total = unitRepo.findAllByHospital(hospitalId).size();
        long available = unitRepo.countByStatus(hospitalId, "AVAILABLE");
        long quarantine = unitRepo.countByStatus(hospitalId, "QUARANTINE");
        long reserved = unitRepo.countByStatus(hospitalId, "RESERVED");
        long issued = unitRepo.countByStatus(hospitalId, "ISSUED");
        long expiring = unitRepo.countExpiringSoon(hospitalId, warnBefore);
        long totalDonors = donorRepo.countByHospital_Id(hospitalId);

        Map<String, Map<String, Long>> matrix = new LinkedHashMap<>();
        for (Object[] row : unitRepo.stockMatrix(hospitalId)) {
            String group = (String) row[0];
            String component = (String) row[1];
            long count = ((Number) row[2]).longValue();
            matrix.computeIfAbsent(group, g -> new LinkedHashMap<>()).put(component, count);
        }

        List<BloodBankDtos.UnitDto> expiringSoon = unitRepo.findExpiringSoon(hospitalId, warnBefore)
                .stream().limit(10).map(u -> toUnitDto(u, warnBefore)).toList();

        return BloodBankDtos.StatsDto.builder()
                .totalUnits(total)
                .availableUnits(available)
                .quarantineUnits(quarantine)
                .reservedUnits(reserved)
                .issuedUnits(issued)
                .expiringSoonUnits(expiring)
                .totalDonors(totalDonors)
                .stockMatrix(matrix)
                .expiringSoon(expiringSoon)
                .build();
    }

    // ───── Helpers ────────────────────────────────────────────────────

    private int resolveShelfLifeDays(UUID hospitalId, String componentCode) {
        return lookupRepo.resolve(hospitalId, "COMPONENT", componentCode)
                .map(l -> {
                    if (l.getMetadata() == null || l.getMetadata().isBlank()) return 35;
                    try {
                        JsonNode node = JSON.readTree(l.getMetadata());
                        JsonNode shelf = node.get("shelfLifeDays");
                        return shelf != null && shelf.isInt() ? shelf.asInt() : 35;
                    } catch (Exception e) {
                        log.warn("Could not parse component metadata for {}: {}", componentCode, e.getMessage());
                        return 35;
                    }
                })
                .orElse(35);
    }

    private String blank(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private BloodBankDtos.UnitDto toUnitDto(BloodUnit u, LocalDate warnBefore) {
        BloodDonor d = u.getDonor();
        String donorName = d != null
                ? d.getFirstName() + (d.getLastName() != null ? " " + d.getLastName() : "")
                : null;
        Patient p = u.getIssuedToPatient();
        String patientName = p != null
                ? p.getFirstName() + (p.getLastName() != null ? " " + p.getLastName() : "")
                : null;
        Admission a = u.getIssuedToAdmission();
        User issuer = u.getIssuedByUser();
        String issuerName = issuer != null
                ? issuer.getFirstName() + (issuer.getLastName() != null ? " " + issuer.getLastName() : "")
                : null;

        boolean soon = u.getExpiryDate() != null
                && !u.getExpiryDate().isAfter(warnBefore)
                && !"ISSUED".equals(u.getStatusCode())
                && !"EXPIRED".equals(u.getStatusCode())
                && !"DISCARDED".equals(u.getStatusCode());

        return BloodBankDtos.UnitDto.builder()
                .id(u.getId())
                .hospitalId(u.getHospital() != null ? u.getHospital().getId() : null)
                .bagNumber(u.getBagNumber())
                .bloodGroupCode(u.getBloodGroupCode())
                .componentCode(u.getComponentCode())
                .statusCode(u.getStatusCode())
                .sourceCode(u.getSourceCode())
                .donorId(d != null ? d.getId() : null)
                .donorName(donorName)
                .donorPhone(d != null ? d.getPhone() : null)
                .volumeMl(u.getVolumeMl())
                .collectionDate(u.getCollectionDate())
                .expiryDate(u.getExpiryDate())
                .storageLocation(u.getStorageLocation())
                .screeningPassed(u.getScreeningPassed())
                .costPrice(u.getCostPrice())
                .salePrice(u.getSalePrice())
                .issuedToPatientId(p != null ? p.getId() : null)
                .issuedToPatientName(patientName)
                .issuedToAdmissionId(a != null ? a.getId() : null)
                .issuedToAdmissionNumber(a != null ? a.getAdmissionNumber() : null)
                .issuedByUserId(issuer != null ? issuer.getId() : null)
                .issuedByUserName(issuerName)
                .issuedAt(u.getIssuedAt())
                .issuedDoctorName(u.getIssuedDoctorName())
                .replacementsPledged(u.getReplacementsPledged())
                .replacementsReceived(u.getReplacementsReceived())
                .invoiceItemId(u.getInvoiceItemId())
                .notes(u.getNotes())
                .createdAt(u.getCreatedAt())
                .expiringSoon(soon)
                .build();
    }
}

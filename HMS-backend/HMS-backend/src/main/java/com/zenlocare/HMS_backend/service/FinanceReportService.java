package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.DoctorCollectionsDailyResponse;
import com.zenlocare.HMS_backend.dto.DoctorCollectionsSummaryResponse;
import com.zenlocare.HMS_backend.entity.Doctor;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.repository.DoctorRepository;
import com.zenlocare.HMS_backend.repository.InvoicePaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Aggregates collected fees (rows in {@code invoice_payments}) per attending
 * doctor for finance dashboards. All windowing is IST-aligned to match the
 * rest of the platform — see {@link DashboardService} for the same convention.
 *
 * Doctor attribution rules:
 *   - OPD: invoice → appointment → doctor
 *   - IPD: invoice → admission  → admitting doctor
 *   - Neither: bucketed under doctorId = null ("Unattributed")
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class FinanceReportService {

    private static final ZoneId HOSPITAL_TZ = ZoneId.of("Asia/Kolkata");
    /** Hard cap on the daily-breakdown window to keep payloads bounded. */
    private static final int MAX_DAILY_RANGE_DAYS = 93;

    private final InvoicePaymentRepository paymentRepo;
    private final DoctorRepository doctorRepo;

    // ---------- Summary: today / last 7 days / this month ----------

    public DoctorCollectionsSummaryResponse getSummary(UUID hospitalId, LocalDate asOfOverride) {
        LocalDate asOf = asOfOverride != null ? asOfOverride : LocalDate.now(HOSPITAL_TZ);

        LocalDate todayStart = asOf;
        LocalDate weekStart  = asOf.minusDays(6);          // 7-day inclusive window
        LocalDate monthStart = asOf.withDayOfMonth(1);

        // Query the widest window once (start of month or weekStart, whichever is earlier).
        LocalDate fromDate = monthStart.isBefore(weekStart) ? monthStart : weekStart;
        LocalDateTime fromTs = fromDate.atStartOfDay();
        LocalDateTime toTs   = asOf.plusDays(1).atStartOfDay(); // exclusive end-of-day

        List<Object[]> rows = paymentRepo.sumPaymentsByDoctorPerDay(hospitalId, fromTs, toTs);

        Map<UUID, BigDecimal[]> byDoctor = new HashMap<>(); // doctorId → [today, last7, month]
        BigDecimal[] grand = new BigDecimal[]{ BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO };

        for (Object[] row : rows) {
            UUID doctorId = (UUID) row[0];
            LocalDate payDate = toLocalDate(row[1]);
            BigDecimal amount = toBigDecimal(row[2]);
            if (amount.signum() == 0) continue;

            BigDecimal[] buckets = byDoctor.computeIfAbsent(
                    doctorId,
                    k -> new BigDecimal[]{ BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO });

            if (payDate.equals(todayStart)) {
                buckets[0] = buckets[0].add(amount);
                grand[0]   = grand[0].add(amount);
            }
            if (!payDate.isBefore(weekStart) && !payDate.isAfter(todayStart)) {
                buckets[1] = buckets[1].add(amount);
                grand[1]   = grand[1].add(amount);
            }
            if (!payDate.isBefore(monthStart) && !payDate.isAfter(todayStart)) {
                buckets[2] = buckets[2].add(amount);
                grand[2]   = grand[2].add(amount);
            }
        }

        Map<UUID, Doctor> doctorIndex = loadDoctorIndex(byDoctor.keySet(), hospitalId);

        List<DoctorCollectionsSummaryResponse.DoctorCollectionRow> doctorRows = new ArrayList<>(byDoctor.size());
        for (Map.Entry<UUID, BigDecimal[]> entry : byDoctor.entrySet()) {
            UUID doctorId = entry.getKey();
            BigDecimal[] b = entry.getValue();
            Doctor doctor = doctorId == null ? null : doctorIndex.get(doctorId);
            doctorRows.add(DoctorCollectionsSummaryResponse.DoctorCollectionRow.builder()
                    .doctorId(doctorId)
                    .doctorName(doctorDisplayName(doctor))
                    .specialization(doctor != null ? doctor.getSpecialization() : null)
                    .today(b[0])
                    .last7Days(b[1])
                    .thisMonth(b[2])
                    .build());
        }
        // Sort by thisMonth desc for stable, finance-friendly ordering.
        doctorRows.sort(Comparator.comparing(
                (DoctorCollectionsSummaryResponse.DoctorCollectionRow r) -> r.getThisMonth(),
                Comparator.nullsLast(Comparator.reverseOrder())));

        return DoctorCollectionsSummaryResponse.builder()
                .asOfDate(asOf)
                .todayStart(todayStart)
                .weekStart(weekStart)
                .monthStart(monthStart)
                .doctors(doctorRows)
                .totals(DoctorCollectionsSummaryResponse.Totals.builder()
                        .today(grand[0])
                        .last7Days(grand[1])
                        .thisMonth(grand[2])
                        .build())
                .build();
    }

    // ---------- Daily: per-day breakdown over a range ----------

    public DoctorCollectionsDailyResponse getDaily(UUID hospitalId, LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new IllegalArgumentException("from and to are required");
        }
        if (from.isAfter(to)) {
            throw new IllegalArgumentException("from must be on or before to");
        }
        long span = ChronoUnit.DAYS.between(from, to) + 1;
        if (span > MAX_DAILY_RANGE_DAYS) {
            throw new IllegalArgumentException(
                    "Date range exceeds maximum of " + MAX_DAILY_RANGE_DAYS + " days");
        }

        LocalDateTime fromTs = from.atStartOfDay();
        LocalDateTime toTs   = to.plusDays(1).atStartOfDay();

        List<Object[]> rows = paymentRepo.sumPaymentsByDoctorPerDay(hospitalId, fromTs, toTs);

        // doctorId → (date → amount)
        Map<UUID, Map<LocalDate, BigDecimal>> byDoctorByDay = new HashMap<>();
        for (Object[] row : rows) {
            UUID doctorId = (UUID) row[0];
            LocalDate payDate = toLocalDate(row[1]);
            BigDecimal amount = toBigDecimal(row[2]);
            byDoctorByDay
                    .computeIfAbsent(doctorId, k -> new HashMap<>())
                    .merge(payDate, amount, BigDecimal::add);
        }

        Map<UUID, Doctor> doctorIndex = loadDoctorIndex(byDoctorByDay.keySet(), hospitalId);

        List<LocalDate> dayAxis = new ArrayList<>((int) span);
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            dayAxis.add(d);
        }

        List<DoctorCollectionsDailyResponse.DoctorDailyRow> doctorRows =
                new ArrayList<>(byDoctorByDay.size());
        for (Map.Entry<UUID, Map<LocalDate, BigDecimal>> entry : byDoctorByDay.entrySet()) {
            UUID doctorId = entry.getKey();
            Map<LocalDate, BigDecimal> dayMap = entry.getValue();
            Doctor doctor = doctorId == null ? null : doctorIndex.get(doctorId);

            BigDecimal total = BigDecimal.ZERO;
            List<DoctorCollectionsDailyResponse.DailyAmount> series = new ArrayList<>(dayAxis.size());
            for (LocalDate d : dayAxis) {
                BigDecimal amt = dayMap.getOrDefault(d, BigDecimal.ZERO);
                total = total.add(amt);
                series.add(DoctorCollectionsDailyResponse.DailyAmount.builder()
                        .date(d)
                        .amount(amt)
                        .build());
            }

            doctorRows.add(DoctorCollectionsDailyResponse.DoctorDailyRow.builder()
                    .doctorId(doctorId)
                    .doctorName(doctorDisplayName(doctor))
                    .specialization(doctor != null ? doctor.getSpecialization() : null)
                    .total(total)
                    .daily(series)
                    .build());
        }
        doctorRows.sort(Comparator.comparing(
                (DoctorCollectionsDailyResponse.DoctorDailyRow r) -> r.getTotal(),
                Comparator.nullsLast(Comparator.reverseOrder())));

        return DoctorCollectionsDailyResponse.builder()
                .fromDate(from)
                .toDate(to)
                .doctors(doctorRows)
                .build();
    }

    // ---------- helpers ----------

    private Map<UUID, Doctor> loadDoctorIndex(Set<UUID> doctorIds, UUID hospitalId) {
        Set<UUID> nonNullIds = new HashSet<>();
        for (UUID id : doctorIds) if (id != null) nonNullIds.add(id);
        if (nonNullIds.isEmpty()) return Map.of();

        Map<UUID, Doctor> index = new HashMap<>();
        for (Doctor d : doctorRepo.findAllById(nonNullIds)) {
            // Defense in depth: never leak a doctor row from another hospital
            // even if a stale payment somehow attributes to one.
            if (d.getHospital() != null && hospitalId.equals(d.getHospital().getId())) {
                index.put(d.getId(), d);
            }
        }
        return index;
    }

    private static String doctorDisplayName(Doctor doctor) {
        if (doctor == null) return "Unattributed";
        User u = doctor.getUser();
        if (u == null) return "Doctor";
        String first = u.getFirstName() == null ? "" : u.getFirstName().trim();
        String last  = u.getLastName()  == null ? "" : u.getLastName().trim();
        String full  = (first + " " + last).trim();
        return full.isEmpty() ? "Doctor" : "Dr. " + full;
    }

    private static LocalDate toLocalDate(Object dbValue) {
        if (dbValue instanceof java.sql.Date d) return d.toLocalDate();
        if (dbValue instanceof LocalDate ld)    return ld;
        if (dbValue instanceof java.util.Date d) {
            return d.toInstant().atZone(HOSPITAL_TZ).toLocalDate();
        }
        throw new IllegalStateException("Unexpected date type from query: " + dbValue);
    }

    private static BigDecimal toBigDecimal(Object dbValue) {
        if (dbValue == null) return BigDecimal.ZERO;
        if (dbValue instanceof BigDecimal bd) return bd;
        if (dbValue instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        throw new IllegalStateException("Unexpected numeric type from query: " + dbValue);
    }
}

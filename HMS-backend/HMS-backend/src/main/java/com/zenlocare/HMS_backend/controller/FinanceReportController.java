package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.DoctorCollectionsDailyResponse;
import com.zenlocare.HMS_backend.dto.DoctorCollectionsSummaryResponse;
import com.zenlocare.HMS_backend.security.HospitalAccessGuard;
import com.zenlocare.HMS_backend.service.FinanceReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Finance-side reporting endpoints. Owned by HMS because the source of truth
 * for invoice payments, appointments, and admissions lives here. Consumed by
 * the finance app (api-finance.zenohosp.com) via the user's HMS JWT.
 *
 * Multi-tenancy: every endpoint requires {@code hospitalId} and is gated by
 * {@link HospitalAccessGuard} — the caller must belong to the queried hospital
 * (super_admin bypasses). The path is left under {@code /api} (not
 * {@code /api/admin}) so non-admin finance staff with appropriate access can
 * read it; tighten with {@code @PreAuthorize} if finance demands role gating.
 */
@RestController
@RequestMapping("/api/finance")
@RequiredArgsConstructor
public class FinanceReportController {

    private final FinanceReportService financeReportService;
    private final HospitalAccessGuard hospitalAccessGuard;

    /**
     * Per-doctor collected-fees summary for three windows:
     *   - today (asOf)
     *   - last 7 days (asOf − 6 ... asOf, inclusive)
     *   - this month (1st of asOf's month ... asOf, inclusive)
     *
     * All windows are aligned to Asia/Kolkata, regardless of server TZ.
     *
     * @param hospitalId required; must match caller's hospital (super_admin bypasses)
     * @param asOf       optional; defaults to today in IST. Useful for back-dated reports.
     */
    @GetMapping("/doctor-collections/summary")
    public ResponseEntity<DoctorCollectionsSummaryResponse> getDoctorCollectionsSummary(
            @RequestParam UUID hospitalId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf) {
        hospitalAccessGuard.requireAccess(hospitalId);
        return ResponseEntity.ok(financeReportService.getSummary(hospitalId, asOf));
    }

    /**
     * Per-doctor, per-day collected-fees breakdown over a closed date range.
     * Range is capped at 93 days. Days with no collections are returned as 0
     * so the caller can chart a continuous series.
     */
    @GetMapping("/doctor-collections/daily")
    public ResponseEntity<DoctorCollectionsDailyResponse> getDoctorCollectionsDaily(
            @RequestParam UUID hospitalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        hospitalAccessGuard.requireAccess(hospitalId);
        return ResponseEntity.ok(financeReportService.getDaily(hospitalId, from, to));
    }
}

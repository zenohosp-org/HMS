package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final PatientRepository patientRepo;
    private final UserRepository userRepo;
    private final DoctorRepository doctorRepo;
    private final InvoiceRepository invoiceRepo;
    private final AdmissionRepository admissionRepo;
    private final AppointmentRepository appointmentRepo;

    public DashboardSummaryResponse getSummary(UUID hospitalId) {
        // --- KPI Counts ---
        long totalPatients = patientRepo.countByHospitalId(hospitalId);
        long todaysNewPatients = patientRepo.countRegisteredToday(hospitalId);

        // Calculate MoM Patient Growth
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfThisMonth = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime startOfLastMonth = startOfThisMonth.minusMonths(1);
        
        long thisMonthPatients = patientRepo.countRegisteredSince(hospitalId, startOfThisMonth);
        long lastMonthPatients = patientRepo.countRegisteredBetween(hospitalId, startOfLastMonth, startOfThisMonth);
        
        double patientMoMGrowthPercent = 0.0;
        if (lastMonthPatients > 0) {
            patientMoMGrowthPercent = ((double) (thisMonthPatients - lastMonthPatients) / lastMonthPatients) * 100.0;
            // Round to 1 decimal place
            patientMoMGrowthPercent = Math.round(patientMoMGrowthPercent * 10.0) / 10.0;
        } else if (thisMonthPatients > 0) {
            patientMoMGrowthPercent = 100.0; // 100% growth if there are registrations this month but none last month
        }

        long totalDoctors = doctorRepo.countByHospitalId(hospitalId);
        long totalActiveStaff = userRepo.countActiveStaffExcludingSuperAdmin(hospitalId);
        double totalRevenueCollected = invoiceRepo.sumPaidByHospital(hospitalId);
        double totalOutstandingRevenue = invoiceRepo.sumOutstandingByHospital(hospitalId);
        long activeAdmissions = admissionRepo.countActiveByHospital(hospitalId);

        // --- 1. Daily Registration Trend (Last 30 Days) ---
        LocalDateTime thirtyDaysAgo = now.minusDays(29).withHour(0).withMinute(0).withSecond(0).withNano(0);
        List<Object[]> dbTrend = patientRepo.getDailyRegistrationTrend(hospitalId, thirtyDaysAgo);
        
        Map<String, Long> dateCountMap = new HashMap<>();
        for (Object[] row : dbTrend) {
            String dbDate = String.valueOf(row[0]); // "YYYY-MM-DD"
            long count = ((Number) row[1]).longValue();
            dateCountMap.put(dbDate, count);
        }

        List<DailyCountDto> patientTrend = new ArrayList<>();
        DateTimeFormatter displayDateFormatter = DateTimeFormatter.ofPattern("MMM d", Locale.ENGLISH);
        LocalDate todayDate = LocalDate.now();
        for (int i = 29; i >= 0; i--) {
            LocalDate d = todayDate.minusDays(i);
            String dbKey = d.toString(); // "YYYY-MM-DD"
            String displayLabel = d.format(displayDateFormatter); // e.g., "May 18"
            long count = dateCountMap.getOrDefault(dbKey, 0L);
            patientTrend.add(new DailyCountDto(displayLabel, count));
        }

        // --- 2. Monthly Revenue Overview (Last 6 Months) ---
        LocalDateTime sixMonthsAgo = now.minusMonths(5).withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        List<Object[]> dbRevenue = invoiceRepo.getMonthlyRevenueSummary(hospitalId, sixMonthsAgo);

        Map<String, MonthlyRevenueDto> revMap = new LinkedHashMap<>();
        DateTimeFormatter dbMonthFormatter = DateTimeFormatter.ofPattern("yyyy-MM");
        DateTimeFormatter displayMonthFormatter = DateTimeFormatter.ofPattern("MMM yy", Locale.ENGLISH);
        for (int i = 5; i >= 0; i--) {
            LocalDate d = todayDate.minusMonths(i);
            String dbKey = d.format(dbMonthFormatter); // "YYYY-MM"
            String displayKey = d.format(displayMonthFormatter); // "May 26"
            revMap.put(dbKey, new MonthlyRevenueDto(displayKey, 0.0, 0.0));
        }

        for (Object[] row : dbRevenue) {
            String dbKey = String.valueOf(row[0]);
            double paid = ((Number) row[1]).doubleValue();
            double unpaid = ((Number) row[2]).doubleValue();
            if (revMap.containsKey(dbKey)) {
                MonthlyRevenueDto dto = revMap.get(dbKey);
                dto.setPaid(paid);
                dto.setOutstanding(unpaid);
            }
        }
        List<MonthlyRevenueDto> revenueOverview = new ArrayList<>(revMap.values());

        // --- 3. Appointments Status Breakdown (Donut Chart) ---
        List<Object[]> dbAppts = appointmentRepo.getStatusBreakdown(hospitalId);
        Map<String, Long> apptMap = new LinkedHashMap<>();
        apptMap.put("SCHEDULED", 0L);
        apptMap.put("COMPLETED", 0L);
        apptMap.put("CANCELLED", 0L);
        apptMap.put("NO_SHOW", 0L);

        for (Object[] row : dbAppts) {
            String status = String.valueOf(row[0]);
            long count = ((Number) row[1]).longValue();
            if (apptMap.containsKey(status)) {
                apptMap.put(status, count);
            }
        }

        List<StatusCountDto> appointmentsBreakdown = new ArrayList<>();
        for (Map.Entry<String, Long> entry : apptMap.entrySet()) {
            appointmentsBreakdown.add(new StatusCountDto(entry.getKey(), entry.getValue()));
        }

        // --- 4. Patient Age Groups Breakdown (Bar Chart) ---
        List<Object[]> dbAgeGroups = patientRepo.getAgeGroupBreakdown(hospitalId);
        Map<String, Long> ageMap = new LinkedHashMap<>();
        ageMap.put("0–17", 0L);
        ageMap.put("18–34", 0L);
        ageMap.put("35–54", 0L);
        ageMap.put("55–74", 0L);
        ageMap.put("75+", 0L);

        for (Object[] row : dbAgeGroups) {
            String groupName = String.valueOf(row[0]); // e.g. "0–17"
            long count = ((Number) row[1]).longValue();
            if (ageMap.containsKey(groupName)) {
                ageMap.put(groupName, count);
            }
        }

        List<StatusCountDto> patientAgeGroups = new ArrayList<>();
        for (Map.Entry<String, Long> entry : ageMap.entrySet()) {
            patientAgeGroups.add(new StatusCountDto(entry.getKey(), entry.getValue()));
        }

        // --- 5. Staff Roles Breakdown (Donut Chart) ---
        List<Object[]> dbStaff = userRepo.getStaffByRole(hospitalId);
        List<StatusCountDto> staffByRole = new ArrayList<>();
        for (Object[] row : dbStaff) {
            String roleName = (String) row[0];
            if (roleName == null) {
                roleName = "Staff";
            }
            long count = ((Number) row[1]).longValue();
            String formattedRole = roleName.replace("_", " ").toUpperCase();
            staffByRole.add(new StatusCountDto(formattedRole, count));
        }

        return DashboardSummaryResponse.builder()
                .totalPatients(totalPatients)
                .todaysNewPatients(todaysNewPatients)
                .patientMoMGrowthPercent(patientMoMGrowthPercent)
                .totalDoctors(totalDoctors)
                .totalActiveStaff(totalActiveStaff)
                .totalRevenueCollected(totalRevenueCollected)
                .totalOutstandingRevenue(totalOutstandingRevenue)
                .activeAdmissions(activeAdmissions)
                .patientRegistrationsTrend(patientTrend)
                .revenueOverview(revenueOverview)
                .appointmentsBreakdown(appointmentsBreakdown)
                .patientAgeGroups(patientAgeGroups)
                .staffByRole(staffByRole)
                .build();
    }
}

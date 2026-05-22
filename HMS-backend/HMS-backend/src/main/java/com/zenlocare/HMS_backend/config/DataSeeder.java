package com.zenlocare.HMS_backend.config;

import com.zenlocare.HMS_backend.entity.Hospital;
import com.zenlocare.HMS_backend.entity.Role;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.repository.HospitalRepository;
import com.zenlocare.HMS_backend.repository.RoleRepository;
import com.zenlocare.HMS_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final HospitalRepository hospitalRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        try {
            jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN last_name DROP NOT NULL");
            log.info("✅ Made last_name nullable in users table");
        } catch (Exception e) {
            log.warn("Could not alter users.last_name: " + e.getMessage());
        }
        try {
            jdbcTemplate.execute(
                "UPDATE doctors SET available_days_mask = " +
                "  (CASE WHEN available_days LIKE '%MON%' THEN 1  ELSE 0 END) +" +
                "  (CASE WHEN available_days LIKE '%TUE%' THEN 2  ELSE 0 END) +" +
                "  (CASE WHEN available_days LIKE '%WED%' THEN 4  ELSE 0 END) +" +
                "  (CASE WHEN available_days LIKE '%THU%' THEN 8  ELSE 0 END) +" +
                "  (CASE WHEN available_days LIKE '%FRI%' THEN 16 ELSE 0 END) +" +
                "  (CASE WHEN available_days LIKE '%SAT%' THEN 32 ELSE 0 END) +" +
                "  (CASE WHEN available_days LIKE '%SUN%' THEN 64 ELSE 0 END) " +
                "WHERE available_days IS NOT NULL AND available_days_mask IS NULL");
            log.info("✅ Migrated available_days → available_days_mask bitmask");
        } catch (Exception e) {
            log.warn("Could not migrate available_days to bitmask: " + e.getMessage());
        }
        try {
            jdbcTemplate.execute(
                "UPDATE doctors SET specialization_id_1 = specialization_id " +
                "WHERE specialization_id_1 IS NULL AND specialization_id IS NOT NULL");
            log.info("✅ Migrated specialization_id → specialization_id_1");
        } catch (Exception e) {
            log.warn("Could not migrate specialization_id: " + e.getMessage());
        }
        try {
            jdbcTemplate.execute("ALTER TABLE patients ALTER COLUMN dob DROP NOT NULL");
            log.info("✅ Dropped NOT NULL on patients.dob");
        } catch (Exception e) {
            log.warn("Could not alter patients.dob: " + e.getMessage());
        }
        try {
            jdbcTemplate.execute("ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS room_id bigint");
            log.info("✅ Added room_id to stores");
        } catch (Exception e) {
            log.warn("Could not add room_id to stores: " + e.getMessage());
        }
        try {
            jdbcTemplate.execute("ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_room_type_check");
            log.info("✅ Dropped rooms_room_type_check constraint");
        } catch (Exception e) {
            log.warn("Could not drop rooms_room_type_check: " + e.getMessage());
        }
        try {
            jdbcTemplate.execute("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS admission_id UUID REFERENCES admissions(id)");
            log.info("✅ Added admission_id to appointments");
        } catch (Exception e) {
            log.warn("Could not add admission_id to appointments: " + e.getMessage());
        }

        dropGhostStatusNotNullConstraints();
        seedReferenceTables();
        migrateStatusColumns();
        migrateDischargeData();
        seedRoomTypeConfigs();
        seedRoles();
        seedHospitalAdmin();
    }

    private void seedReferenceTables() {
        seedRefTable("appointment_statuses", new Object[][]{
            {1, "SCHEDULED"}, {2, "CONFIRMED"}, {3, "CHECKED_IN"}, {4, "IN_PROGRESS"},
            {5, "COMPLETED"}, {6, "CANCELLED"}, {7, "NO_SHOW"}, {8, "BILLED"}
        });
        seedRefTable("appointment_types", new Object[][]{
            {1, "OPD"}, {2, "FOLLOWUP"}, {3, "EMERGENCY"}, {4, "TELECONSULT"}, {5, "HEALTH_CHECKUP"}
        });
        seedRefTable("invoice_statuses", new Object[][]{
            {1, "UNPAID"}, {2, "PARTIAL"}, {3, "PAID"}, {4, "CANCELLED"}, {5, "SETTLED"}, {6, "UNSETTLED"}
        });
        seedRefTable("room_statuses", new Object[][]{
            {1, "AVAILABLE"}, {2, "OCCUPIED"}, {3, "MAINTENANCE"}
        });
        seedRefTable("bed_statuses", new Object[][]{
            {1, "AVAILABLE"}, {2, "OCCUPIED"}
        });
        seedRefTable("radiology_statuses", new Object[][]{
            {1, "PENDING_SCAN"}, {2, "AWAITING_REPORT"}, {3, "REPORT_GENERATED"}, {4, "BILLED"}
        });
        seedRefTable("radiology_priorities", new Object[][]{
            {1, "ROUTINE"}, {2, "URGENT"}, {3, "STAT"}
        });
        seedRefTable("ambulance_booking_statuses", new Object[][]{
            {1, "PENDING"}, {2, "DISPATCHED"}, {3, "EN_ROUTE"}, {4, "COMPLETED"}, {5, "CANCELLED"}
        });
        seedRefTable("ambulance_vehicle_statuses", new Object[][]{
            {1, "AVAILABLE"}, {2, "IN_USE"}, {3, "MAINTENANCE"}
        });
        seedRefTable("checkup_booking_statuses", new Object[][]{
            {1, "SCHEDULED"}, {2, "CHECKED_IN"}, {3, "IN_PROGRESS"},
            {4, "COMPLETED"}, {5, "CANCELLED"}, {6, "NO_SHOW"}
        });
        seedRefTable("admission_statuses", new Object[][]{
            {1, "ADMITTED"}, {2, "DISCHARGED"}, {3, "TRANSFERRED"}, {4, "ABSCONDED"}
        });
        seedRefTable("admission_types", new Object[][]{
            {1, "OPD_REFERRAL"}, {2, "EMERGENCY"}, {3, "DIRECT"}
        });
        seedRefTable("admission_sources", new Object[][]{
            {1, "OPD_REFERRAL"}, {2, "EMERGENCY_WALK_IN"}, {3, "DIRECT"}, {4, "TRANSFER_IN"}
        });
        log.info("✅ Reference tables seeded (13 tables).");
    }

    private void seedRefTable(String tableName, Object[][] rows) {
        try {
            jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS " + tableName + " (id INTEGER PRIMARY KEY, code VARCHAR(50) NOT NULL)"
            );
            for (Object[] row : rows) {
                jdbcTemplate.update(
                    "INSERT INTO " + tableName + " (id, code) VALUES (?, ?) ON CONFLICT (id) DO NOTHING",
                    row[0], row[1]
                );
            }
        } catch (Exception e) {
            log.warn("Could not seed " + tableName + ": " + e.getMessage());
        }
    }

    private void dropGhostStatusNotNullConstraints() {
        String[][] cols = {
            {"invoices",               "status"},
            {"appointments",           "status"},
            {"appointments",           "type"},
            {"rooms",                  "status"},
            {"beds",                   "status"},
            {"radiology_orders",       "status"},
            {"radiology_orders",       "priority"},
            {"ambulance_bookings",     "status"},
            {"ambulance_vehicles",     "status"},
            {"health_checkup_bookings","status"},
            {"admissions",             "status"},
            {"admissions",             "admission_type"},
            {"admissions",             "admission_source"},
        };
        for (String[] col : cols) {
            try {
                jdbcTemplate.execute("ALTER TABLE " + col[0] + " ALTER COLUMN " + col[1] + " DROP NOT NULL");
                log.info("✅ Dropped NOT NULL on " + col[0] + "." + col[1]);
            } catch (Exception e) {
                log.warn("Could not drop NOT NULL on " + col[0] + "." + col[1] + ": " + e.getMessage());
            }
        }
    }

    private void migrateStatusColumns() {
        migrateColumn("appointments", "status_id", "status",
            new Object[][]{{1,"SCHEDULED"},{2,"CONFIRMED"},{3,"CHECKED_IN"},{4,"IN_PROGRESS"},
                           {5,"COMPLETED"},{6,"CANCELLED"},{7,"NO_SHOW"},{8,"BILLED"}});
        migrateColumn("appointments", "type_id", "type",
            new Object[][]{{1,"OPD"},{2,"FOLLOWUP"},{3,"EMERGENCY"},{4,"TELECONSULT"},{5,"HEALTH_CHECKUP"}});
        migrateColumn("invoices", "status_id", "status",
            new Object[][]{{1,"UNPAID"},{2,"PARTIAL"},{3,"PAID"},{4,"CANCELLED"},{5,"SETTLED"},{6,"UNSETTLED"}});
        migrateColumn("rooms", "status_id", "status",
            new Object[][]{{1,"AVAILABLE"},{2,"OCCUPIED"},{3,"MAINTENANCE"}});
        migrateColumn("beds", "status_id", "status",
            new Object[][]{{1,"AVAILABLE"},{2,"OCCUPIED"}});
        migrateColumn("radiology_orders", "status_id", "status",
            new Object[][]{{1,"PENDING_SCAN"},{2,"AWAITING_REPORT"},{3,"REPORT_GENERATED"},{4,"BILLED"}});
        migrateColumn("radiology_orders", "priority_id", "priority",
            new Object[][]{{1,"ROUTINE"},{2,"URGENT"},{3,"STAT"}});
        migrateColumn("ambulance_bookings", "status_id", "status",
            new Object[][]{{1,"PENDING"},{2,"DISPATCHED"},{3,"EN_ROUTE"},{4,"COMPLETED"},{5,"CANCELLED"}});
        migrateColumn("ambulance_vehicles", "status_id", "status",
            new Object[][]{{1,"AVAILABLE"},{2,"IN_USE"},{3,"MAINTENANCE"}});
        migrateColumn("health_checkup_bookings", "status_id", "status",
            new Object[][]{{1,"SCHEDULED"},{2,"CHECKED_IN"},{3,"IN_PROGRESS"},
                           {4,"COMPLETED"},{5,"CANCELLED"},{6,"NO_SHOW"}});
        migrateColumn("admissions", "status_id", "status",
            new Object[][]{{1,"ADMITTED"},{2,"DISCHARGED"},{3,"TRANSFERRED"},{4,"ABSCONDED"}});
        migrateColumn("admissions", "admission_type_id", "admission_type",
            new Object[][]{{1,"OPD_REFERRAL"},{2,"EMERGENCY"},{3,"DIRECT"}});
        migrateColumn("admissions", "admission_source_id", "admission_source",
            new Object[][]{{1,"OPD_REFERRAL"},{2,"EMERGENCY_WALK_IN"},{3,"DIRECT"},{4,"TRANSFER_IN"}});
        log.info("✅ Status columns migrated to integer IDs.");
    }

    private void migrateColumn(String table, String newCol, String oldCol, Object[][] mapping) {
        try {
            StringBuilder sql = new StringBuilder(
                "UPDATE " + table + " SET " + newCol + " = CASE " + oldCol
            );
            for (Object[] entry : mapping) {
                sql.append(" WHEN '").append(entry[1]).append("' THEN ").append(entry[0]);
            }
            sql.append(" ELSE NULL END WHERE ").append(newCol).append(" IS NULL AND ")
               .append(oldCol).append(" IS NOT NULL");
            jdbcTemplate.execute(sql.toString());
        } catch (Exception e) {
            log.warn("Could not migrate " + table + "." + oldCol + " → " + newCol + ": " + e.getMessage());
        }
    }

    private void seedRoomTypeConfigs() {
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS room_type_configs (
                    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    hospital_id   UUID REFERENCES hospitals(id),
                    code          VARCHAR(30)  NOT NULL,
                    label         VARCHAR(100) NOT NULL,
                    category      VARCHAR(20)  DEFAULT 'WARD',
                    icon          VARCHAR(50),
                    color         VARCHAR(20),
                    is_system     BOOLEAN      DEFAULT false,
                    is_active     BOOLEAN      DEFAULT true,
                    display_order INTEGER      DEFAULT 0,
                    created_at    TIMESTAMP    DEFAULT now(),
                    UNIQUE(hospital_id, code)
                )
            """);
        } catch (Exception e) {
            log.warn("room_type_configs table may already exist: " + e.getMessage());
        }

        String[][] defaults = {
            {"GENERAL",      "General Ward",        "WARD",  "bed-double",  "#3b82f6",  "0"},
            {"WARD",         "Shared Ward",         "WARD",  "bed-double",  "#6366f1",  "1"},
            {"SEMI_PRIVATE", "Semi-Private Room",   "WARD",  "bed-single",  "#8b5cf6",  "2"},
            {"PRIVATE",      "Private Room",        "WARD",  "bed-single",  "#a855f7",  "3"},
            {"DELUXE",       "Deluxe / VIP Room",   "WARD",  "crown",       "#f59e0b",  "4"},
            {"ICU",          "ICU",                 "WARD",  "heart-pulse", "#ef4444",  "5"},
            {"NICU",         "Neonatal ICU",        "WARD",  "baby",        "#f87171",  "6"},
            {"ISOLATION",    "Isolation Room",      "WARD",  "shield",      "#f97316",  "7"},
            {"EMERGENCY",    "Emergency / ER",      "WARD",  "siren",       "#dc2626",  "8"},
            {"LABOUR",       "Labour & Delivery",   "WARD",  "heart",       "#ec4899",  "9"},
            {"OT",           "Operating Theatre",   "OT",    "scissors",    "#10b981", "10"},
            {"POST_OT",      "Post-Op Recovery",    "OT",    "activity",    "#14b8a6", "11"},
            {"STORE",        "Inventory Store",     "STORE", "package",     "#f59e0b", "12"},
        };

        for (String[] d : defaults) {
            try {
                jdbcTemplate.update("""
                    INSERT INTO room_type_configs (hospital_id, code, label, category, icon, color, is_system, is_active, display_order)
                    VALUES (NULL, ?, ?, ?, ?, ?, true, true, ?)
                    ON CONFLICT (hospital_id, code) DO UPDATE SET label = EXCLUDED.label, category = EXCLUDED.category,
                        icon = EXCLUDED.icon, color = EXCLUDED.color, is_system = true, display_order = EXCLUDED.display_order
                """, d[0], d[1], d[2], d[3], d[4], Integer.parseInt(d[5]));
            } catch (Exception e) {
                log.warn("Could not seed room type " + d[0] + ": " + e.getMessage());
            }
        }
        log.info("✅ Room type configs seeded (13 system defaults).");
    }

    private void seedRoles() {
        createRoleIfAbsent("super_admin",    "Super Admin",    "Full system access",                    true, true, true,  true,  true, true);
        createRoleIfAbsent("hospital_admin", "Hospital Admin", "Administrative access for hospital",    true, true, true,  true,  true, true);
        createRoleIfAbsent("doctor",         "Doctor",         "Medical professional access",           true, true, false, false, true, false);
        createRoleIfAbsent("staff",          "Staff",          "General staff access",                  true, true, false, true,  false, true);
        createRoleIfAbsent("technician",     "Technician",     "Technical staff access",                true, true, false, false, true, true);
        log.info("✅ Roles seeded.");
    }

    private void createRoleIfAbsent(String name, String displayName, String description, boolean isSystem,
            boolean hms, boolean asset, boolean inventory, boolean ot, boolean pharmacy) {
        Role role = roleRepository.findByName(name).orElseGet(() -> Role.builder().name(name).build());
        role.setDisplayName(displayName);
        role.setDescription(description);
        role.setIsSystemRole(isSystem);
        role.setCanAccessHms(hms);
        role.setCanAccessAsset(asset);
        role.setCanAccessInventory(inventory);
        role.setCanAccessOt(ot);
        role.setCanAccessPharmacy(pharmacy);
        roleRepository.save(role);
    }

    private void seedHospitalAdmin() {
        Hospital hospital = hospitalRepository.findByCode("srm")
                .orElseGet(() -> hospitalRepository.save(
                        Hospital.builder()
                                .code("srm")
                                .name("SRM Hospital")
                                .subdomain("srm")
                                .address("Chennai, Tamil Nadu")
                                .build()));

        Role adminRole = roleRepository.findByName("hospital_admin")
                .orElseThrow(() -> new IllegalStateException("hospital_admin role not found after seed"));

        boolean exists = userRepository.existsByEmailAndHospital("admin@gmail.com", hospital);
        if (exists) {
            log.info("ℹ️  Hospital admin already exists — skipping.");
            return;
        }

        userRepository.save(
                User.builder()
                        .hospital(hospital)
                        .role(adminRole)
                        .email("admin@gmail.com")
                        .passwordHash(passwordEncoder.encode("admin123"))
                        .firstName("Zeno")
                        .lastName("Admin")
                        .isActive(true)
                        .build());

        log.info("✅ Hospital admin seeded → admin@gmail.com / admin123  [Hospital: SRM Hospital]");
    }

    private void migrateDischargeData() {
        try {
            // Migrate existing discharge data from legacy columns on admissions into the new discharges table.
            // Runs idempotently — skips admissions that already have a discharge row.
            int rows = jdbcTemplate.update("""
                INSERT INTO discharges (admission_id, actual_discharge_date, discharge_diagnosis, discharge_note, discharged_by, discharged_at)
                SELECT a.id,
                       a.actual_discharge_date,
                       a.discharge_diagnosis,
                       a.discharge_note,
                       'migrated',
                       COALESCE(a.updated_at, NOW())
                FROM admissions a
                WHERE a.status_id = 2
                  AND (a.discharge_diagnosis IS NOT NULL OR a.discharge_note IS NOT NULL OR a.actual_discharge_date IS NOT NULL)
                  AND a.id NOT IN (SELECT admission_id FROM discharges)
                ON CONFLICT DO NOTHING
            """);
            if (rows > 0) log.info("✅ Migrated {} discharge record(s) from admissions → discharges", rows);
        } catch (Exception e) {
            log.warn("Could not migrate discharge data: " + e.getMessage());
        }
    }
}

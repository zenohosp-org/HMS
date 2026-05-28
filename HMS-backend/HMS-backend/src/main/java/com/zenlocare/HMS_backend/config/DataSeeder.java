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
        try {
            // Stamp pulled pharmacy bills onto invoice_items so the IPD finalize
            // modal can dedupe across reloads without comparing drug names.
            jdbcTemplate.execute(
                "ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS pharmacy_bill_id UUID");
            jdbcTemplate.execute(
                "CREATE INDEX IF NOT EXISTS idx_invoice_items_pharmacy_bill_id ON invoice_items(pharmacy_bill_id)");
            log.info("✅ Ensured invoice_items.pharmacy_bill_id");
        } catch (Exception e) {
            log.warn("Could not add pharmacy_bill_id to invoice_items: " + e.getMessage());
        }
        try {
            // One in-flight consultation per appointment. Cleared on save.
            // FK to users(created_by) is enforced by JPA on read/write; we
            // skip the explicit REFERENCES so the DDL doesn't need to know
            // the users PK column name across profiles.
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS consultation_drafts (
                    id              uuid PRIMARY KEY,
                    appointment_id  uuid NOT NULL UNIQUE,
                    hospital_id     uuid NOT NULL,
                    patient_id      integer NOT NULL,
                    created_by      uuid NOT NULL,
                    payload         text NOT NULL,
                    created_at      timestamp without time zone NOT NULL DEFAULT NOW(),
                    updated_at      timestamp without time zone NOT NULL DEFAULT NOW()
                )
                """);
            jdbcTemplate.execute(
                "CREATE INDEX IF NOT EXISTS idx_consultation_drafts_hospital_id ON consultation_drafts(hospital_id)");
            log.info("✅ Ensured consultation_drafts table");
        } catch (Exception e) {
            log.warn("Could not ensure consultation_drafts: " + e.getMessage());
        }
        try {
            // Per-visit vitals captured by the nurse before the doctor
            // starts the consultation. One row per appointment (UNIQUE);
            // re-takes UPDATE the same row. Individually-typed columns
            // (no JSON blob) so each measure is trendable and alertable
            // downstream.
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS appointment_vitals (
                    id              uuid PRIMARY KEY,
                    appointment_id  uuid NOT NULL UNIQUE,
                    hospital_id     uuid NOT NULL,
                    patient_id      integer NOT NULL,
                    bp_systolic     integer NULL,
                    bp_diastolic    integer NULL,
                    spo2            integer NULL,
                    heart_rate      integer NULL,
                    weight_kg       numeric(5,2) NULL,
                    recorded_by     uuid NOT NULL,
                    recorded_at     timestamp without time zone NOT NULL DEFAULT NOW(),
                    updated_at      timestamp without time zone NOT NULL DEFAULT NOW()
                )
                """);
            jdbcTemplate.execute(
                "CREATE INDEX IF NOT EXISTS idx_appointment_vitals_hospital_id ON appointment_vitals(hospital_id)");
            jdbcTemplate.execute(
                "CREATE INDEX IF NOT EXISTS idx_appointment_vitals_patient_id ON appointment_vitals(patient_id, recorded_at DESC)");
            log.info("✅ Ensured appointment_vitals table");
        } catch (Exception e) {
            log.warn("Could not ensure appointment_vitals: " + e.getMessage());
        }
        try {
            // Ward's roomType used to live only on its rooms — empty wards or
            // edits before adding rooms lost the type. Persist it on the ward
            // itself and backfill from the first room for legacy rows.
            jdbcTemplate.execute("ALTER TABLE hospital_wards ADD COLUMN IF NOT EXISTS room_type VARCHAR(30)");
            jdbcTemplate.update("""
                UPDATE hospital_wards w
                   SET room_type = sub.room_type
                  FROM (
                      SELECT DISTINCT ON (ward_id) ward_id, room_type
                        FROM rooms
                       WHERE ward_id IS NOT NULL AND room_type IS NOT NULL
                       ORDER BY ward_id, room_id
                  ) sub
                 WHERE w.id = sub.ward_id
                   AND (w.room_type IS NULL OR w.room_type = '')
                """);
            log.info("✅ Ensured hospital_wards.room_type column and backfilled from rooms");
        } catch (Exception e) {
            log.warn("Could not ensure hospital_wards.room_type: " + e.getMessage());
        }

        dropGhostStatusNotNullConstraints();
        seedReferenceTables();
        migrateStatusColumns();
        migrateDischargeData();
        backfillHospitalNumericCodes();
        backfillInvoiceVersions();
        backfillPatientRegistrationFlag();
        backfillAppointmentTokens();
        migrateRoomAttenderToAdmission();
        ensurePrescriptionSchema();
        seedRoomTypeConfigs();
        seedRoles();
        seedHospitalAdmin();
    }

    /**
     * One-time migration: attender data lived on Room (attender_name / attender_phone /
     * attender_relationship). Refactor moved it to Admission so multi-bed wards each
     * get their own per-bed attender. Before dropping the Room columns:
     *   1. For every active (ADMITTED) admission still missing attender data on the
     *      admission but whose Room has it, copy the values across.
     *   2. Drop the now-unused Room attender_* columns.
     * Runs idempotently — DROP COLUMN IF EXISTS means subsequent boots are a no-op.
     */
    private void migrateRoomAttenderToAdmission() {
        try {
            int copied = jdbcTemplate.update("""
                UPDATE admissions adm
                   SET attender_name         = r.attender_name,
                       attender_phone        = r.attender_phone,
                       attender_relationship = r.attender_relationship
                  FROM rooms r
                 WHERE adm.room_id = r.room_id
                   AND adm.status_id = 1                       -- ADMITTED
                   AND (adm.attender_name IS NULL OR adm.attender_name = '')
                   AND r.attender_name IS NOT NULL
                """);
            if (copied > 0) log.info("✅ Copied attender_* from Room → Admission on {} active rows", copied);
        } catch (Exception e) {
            log.warn("Could not copy room.attender_* into admission: " + e.getMessage());
        }
        try {
            jdbcTemplate.execute("ALTER TABLE rooms DROP COLUMN IF EXISTS attender_name");
            jdbcTemplate.execute("ALTER TABLE rooms DROP COLUMN IF EXISTS attender_phone");
            jdbcTemplate.execute("ALTER TABLE rooms DROP COLUMN IF EXISTS attender_relationship");
        } catch (Exception e) {
            log.warn("Could not drop rooms.attender_* columns: " + e.getMessage());
        }
    }

    /**
     * Prescription support — adds the appointment_id audit column to
     * patient_records (OPD prescriptions link back to the appointment they
     * were written for) and creates the structured prescription_items child
     * table. Hibernate's ddl-auto=update would handle most of this for new
     * deployments, but explicit SQL means a fresh boot doesn't depend on
     * entity scan order, and the FK + indexes get the names we want.
     *
     * Idempotent via IF NOT EXISTS — safe to re-run on every boot.
     */
    private void ensurePrescriptionSchema() {
        try {
            jdbcTemplate.execute(
                "ALTER TABLE patient_records ADD COLUMN IF NOT EXISTS appointment_id uuid");
            // OPD consultation form stores discharge / follow-up instructions
            // separately from the doctor's narrative description so prints can
            // split them without parsing prose.
            jdbcTemplate.execute(
                "ALTER TABLE patient_records ADD COLUMN IF NOT EXISTS instructions text");

            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS prescription_items (
                    id              uuid PRIMARY KEY,
                    history_id      uuid NOT NULL REFERENCES patient_records(history_id) ON DELETE CASCADE,
                    drug_id         uuid NULL,
                    drug_name       varchar(255) NOT NULL,
                    drug_generic    varchar(255) NULL,
                    drug_strength   varchar(100) NULL,
                    drug_form       varchar(50)  NULL,
                    dose            varchar(100) NULL,
                    frequency_id    integer      NULL,
                    duration_days   integer      NULL,
                    quantity        integer      NOT NULL,
                    route_id        integer      NULL,
                    instructions    text         NULL,
                    display_order   integer      NULL DEFAULT 0,
                    created_at      timestamp without time zone NOT NULL DEFAULT NOW()
                )
                """);

            // If an earlier build of this table used varchar columns for frequency/route,
            // migrate to the integer-FK shape that matches the rest of the codebase.
            // Both ADD and DROP are guarded so this runs idempotently on every boot.
            jdbcTemplate.execute(
                "ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS frequency_id integer");
            jdbcTemplate.execute(
                "ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS route_id integer");
            jdbcTemplate.execute("ALTER TABLE prescription_items DROP COLUMN IF EXISTS frequency");
            jdbcTemplate.execute("ALTER TABLE prescription_items DROP COLUMN IF EXISTS route");

            jdbcTemplate.execute(
                "CREATE INDEX IF NOT EXISTS idx_prescription_items_history_id ON prescription_items(history_id)");
            jdbcTemplate.execute(
                "CREATE INDEX IF NOT EXISTS idx_prescription_items_drug_id ON prescription_items(drug_id)");
        } catch (Exception e) {
            log.warn("Could not ensure prescription schema: " + e.getMessage());
        }
    }

    /**
     * Tokens used to be assigned only when (apptDate == today). Future-dated
     * appointments that staff moved straight to CONFIRMED/COMPLETED ended up
     * with token_number = NULL. Walk those rows and assign sequential tokens
     * per (hospital_id, appt_date) in createdAt order, continuing from the
     * day's existing MAX. Status IDs: 2=CONFIRMED 3=CHECKED_IN 4=IN_PROGRESS
     * 5=COMPLETED 8=BILLED.
     */
    private void backfillAppointmentTokens() {
        try {
            int rows = jdbcTemplate.update("""
                WITH eligible AS (
                  SELECT a.id,
                         (SELECT COALESCE(MAX(a2.token_number), 0)
                            FROM appointments a2
                           WHERE a2.hospital_id = a.hospital_id
                             AND a2.appt_date   = a.appt_date) AS day_max,
                         ROW_NUMBER() OVER (
                           PARTITION BY a.hospital_id, a.appt_date
                           ORDER BY a.created_at
                         ) AS rn
                    FROM appointments a
                   WHERE a.token_number IS NULL
                     AND a.status_id IN (2, 3, 4, 5, 8)
                )
                UPDATE appointments
                   SET token_number = e.day_max + e.rn
                  FROM eligible e
                 WHERE appointments.id = e.id
                   AND (e.day_max + e.rn) <= 100
                """);
            if (rows > 0) log.info("✅ Backfilled token_number on {} legacy appointment rows", rows);
        } catch (Exception e) {
            log.warn("Could not backfill appointment tokens: " + e.getMessage());
        }
    }

    /**
     * registration_fee_paid was added to support a once-per-patient registration
     * charge. For existing patients we need to:
     *   1. Make sure the column exists (Hibernate ddl-auto adds it, but be defensive).
     *   2. Backfill NULLs to FALSE so the column has a definite value everywhere.
     *   3. Flip to TRUE for any patient who already has a REGISTRATION line
     *      anywhere in their invoice history — they've already paid, must not
     *      be re-charged when they next visit.
     */
    private void backfillPatientRegistrationFlag() {
        try {
            jdbcTemplate.execute("ALTER TABLE patients ADD COLUMN IF NOT EXISTS registration_fee_paid boolean");
            int nullFixed = jdbcTemplate.update(
                    "UPDATE patients SET registration_fee_paid = FALSE WHERE registration_fee_paid IS NULL");
            if (nullFixed > 0) log.info("✅ Defaulted registration_fee_paid=FALSE on {} legacy patient rows", nullFixed);

            int marked = jdbcTemplate.update("""
                UPDATE patients
                   SET registration_fee_paid = TRUE
                 WHERE registration_fee_paid = FALSE
                   AND patient_id IN (
                       SELECT DISTINCT inv.patient_id
                         FROM invoices inv
                         JOIN invoice_items ii ON ii.invoice_id = inv.id
                        WHERE ii.item_type = 'REGISTRATION'
                   )
                """);
            if (marked > 0) log.info("✅ Marked {} patients as already-registered based on past REGISTRATION items", marked);
        } catch (Exception e) {
            log.warn("Could not backfill patients.registration_fee_paid: " + e.getMessage());
        }
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
        seedRefTable("record_history_types", new Object[][]{
            {1, "CONSULTATION"}, {2, "PRESCRIPTION"}, {3, "LAB_RESULT"},
            {4, "SURGERY"}, {5, "DIAGNOSIS"}, {6, "OTHERS"}
        });
        // Clinical taxonomies for the prescription picker. Ids are stable
        // contract — adding new rows is OK, renumbering is not.
        seedRefTable("prescription_frequencies", new Object[][]{
            {1, "OD"}, {2, "BD"}, {3, "TDS"}, {4, "QID"},
            {5, "Q4H"}, {6, "Q6H"}, {7, "Q8H"},
            {8, "HS"}, {9, "AC"}, {10, "PC"},
            {11, "SOS"}, {12, "STAT"}
        });
        seedRefTable("prescription_routes", new Object[][]{
            {1, "ORAL"}, {2, "IV"}, {3, "IM"}, {4, "SC"},
            {5, "TOPICAL"}, {6, "INHALED"},
            {7, "OPHTHALMIC"}, {8, "OTIC"}, {9, "NASAL"}, {10, "RECTAL"}
        });
        log.info("✅ Reference tables seeded (16 tables).");
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
            {"patient_records",        "history_type"},
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
        migrateColumn("patient_records", "history_type_id", "history_type",
            new Object[][]{{1,"CONSULTATION"},{2,"PRESCRIPTION"},{3,"LAB_RESULT"},
                           {4,"SURGERY"},{5,"DIAGNOSIS"},{6,"OTHERS"}});
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

    private void backfillHospitalNumericCodes() {
        try {
            // Ensure the shared sequence exists and is synced to the current max — directory-backend
            // creates it too, but HMS-backend may start first on a fresh deploy. Idempotent.
            jdbcTemplate.execute(
                "CREATE SEQUENCE IF NOT EXISTS hospital_numeric_code_seq MINVALUE 1001 MAXVALUE 9999 START WITH 1001");
            jdbcTemplate.execute(
                "SELECT setval('hospital_numeric_code_seq', GREATEST(1000, "
                + "(SELECT COALESCE(MAX(CAST(numeric_code AS INTEGER)), 1000) FROM hospitals WHERE numeric_code ~ '^[0-9]{4}$')))");

            // Backfill any hospital rows that arrived with NULL numeric_code (legacy data or
            // hospitals created before directory-backend gained the auto-assign hook).
            // Order by created_at so older hospitals get the lower codes deterministically.
            java.util.List<java.util.Map<String, Object>> nullCoded = jdbcTemplate.queryForList(
                "SELECT id FROM hospitals WHERE numeric_code IS NULL ORDER BY created_at ASC NULLS LAST, id ASC");

            for (java.util.Map<String, Object> row : nullCoded) {
                Object id = row.get("id");
                Long next = jdbcTemplate.queryForObject(
                    "SELECT nextval('hospital_numeric_code_seq')", Long.class);
                if (next == null || next > 9999) {
                    log.error("❌ Hospital numeric_code sequence exhausted (>9999). Hospital {} left unassigned.", id);
                    break;
                }
                String code = String.format("%04d", next);
                jdbcTemplate.update("UPDATE hospitals SET numeric_code = ? WHERE id = ?", code, id);
                log.info("✅ Assigned numeric_code {} to hospital {}", code, id);
            }
        } catch (Exception e) {
            log.warn("Could not backfill hospital numeric codes: " + e.getMessage());
        }
    }

    private void backfillInvoiceVersions() {
        try {
            int rows = jdbcTemplate.update("UPDATE invoices SET version = 0 WHERE version IS NULL");
            if (rows > 0) log.info("✅ Backfilled version=0 on {} legacy invoice rows", rows);
        } catch (Exception e) {
            log.warn("Could not backfill invoice versions: " + e.getMessage());
        }
        // Same optimistic-lock cursor added to admissions, rooms, and checkup
        // bookings — Hibernate's ddl-auto=update adds the column nullable; we
        // default existing rows to 0 so Hibernate doesn't trip on null version
        // on first read.
        for (String table : new String[] {"admissions", "rooms", "health_checkup_bookings"}) {
            try {
                jdbcTemplate.execute("ALTER TABLE " + table + " ADD COLUMN IF NOT EXISTS version bigint");
                int rows = jdbcTemplate.update("UPDATE " + table + " SET version = 0 WHERE version IS NULL");
                if (rows > 0) log.info("✅ Backfilled version=0 on {} legacy {} rows", rows, table);
            } catch (Exception e) {
                log.warn("Could not backfill {} versions: {}", table, e.getMessage());
            }
        }
        // Health-checkup invoice link column — auto-billing sets booking.invoice_id
        // pointing at the produced invoice.
        try {
            jdbcTemplate.execute("ALTER TABLE health_checkup_bookings ADD COLUMN IF NOT EXISTS invoice_id uuid");
        } catch (Exception e) {
            log.warn("Could not add health_checkup_bookings.invoice_id: " + e.getMessage());
        }
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

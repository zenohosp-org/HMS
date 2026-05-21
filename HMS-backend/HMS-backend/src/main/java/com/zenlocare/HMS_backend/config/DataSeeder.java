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
        // Migrate available_days string → available_days_mask bitmask (MON=1,TUE=2,WED=4,THU=8,FRI=16,SAT=32,SUN=64)
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
            log.info("✅ Migrated available_days string → available_days_mask bitmask");
        } catch (Exception e) {
            log.warn("Could not migrate available_days to bitmask: " + e.getMessage());
        }
        // Migrate old single specialization_id → specialization_id_1 (existing rows only)
        try {
            jdbcTemplate.execute(
                "UPDATE doctors SET specialization_id_1 = specialization_id " +
                "WHERE specialization_id_1 IS NULL AND specialization_id IS NOT NULL");
            log.info("✅ Migrated specialization_id → specialization_id_1");
        } catch (Exception e) {
            log.warn("Could not migrate specialization_id (may not exist yet): " + e.getMessage());
        }
        try {
            jdbcTemplate.execute("ALTER TABLE patients ALTER COLUMN dob DROP NOT NULL");
            log.info("✅ Dropped NOT NULL constraint on patients.dob column");
        } catch (Exception e) {
            log.warn("Could not alter patients.dob constraint: " + e.getMessage());
        }
        try {
            jdbcTemplate.execute("ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS room_id bigint");
            log.info("✅ Added room_id column to stores table");
        } catch (Exception e) {
            log.warn("Could not alter stores table to add room_id: " + e.getMessage());
        }
        // Drop the old hardcoded room_type CHECK constraint — types are now dynamic
        try {
            jdbcTemplate.execute("ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_room_type_check");
            log.info("✅ Dropped rooms_room_type_check constraint (now dynamic)");
        } catch (Exception e) {
            log.warn("Could not drop rooms_room_type_check: " + e.getMessage());
        }
        try {
            jdbcTemplate.execute("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS admission_id UUID REFERENCES admissions(id)");
            log.info("✅ Added admission_id column to appointments table");
        } catch (Exception e) {
            log.warn("Could not add admission_id to appointments: " + e.getMessage());
        }
        seedRoomTypeConfigs();
        seedRoles();
        seedHospitalAdmin();
    }

    /**
     * Creates the room_type_configs table and seeds system-wide default room types.
     */
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

        // Seed system-wide defaults (hospital_id IS NULL)
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
        createRoleIfAbsent("super_admin", "Super Admin", "Full system access", true, true, true, true, true, true);
        createRoleIfAbsent("hospital_admin", "Hospital Admin", "Administrative access for hospital", true, true, true,
                true, true, true);
        createRoleIfAbsent("doctor", "Doctor", "Medical professional access", true, true, false, false, true, false);
        createRoleIfAbsent("staff", "Staff", "General staff access", true, true, false, true, false, true);
        createRoleIfAbsent("technician", "Technician", "Technical staff access", true, true, false, false, true, true);
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

        // Unique constraint is (email, hospital_id) — check both to avoid duplicates
        boolean exists = userRepository.existsByEmailAndHospital(
                "admin@gmail.com", hospital);
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
}

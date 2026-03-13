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

    @Override
    public void run(String... args) {
        seedRoles();
        seedHospitalAdmin();
    }

    /**
     * Seeds all system roles. Idempotent — skips roles that already exist.
     */
    private void seedRoles() {
        createRoleIfAbsent("SUPER_ADMIN", "Super Admin", "Full system access", true, true, true, true, true, true);
        createRoleIfAbsent("HOSPITAL_ADMIN", "Hospital Admin", "Administrative access for hospital", true, true, true, true, true, true);
        createRoleIfAbsent("DOCTOR", "Doctor", "Medical professional access", true, true, false, false, true, false);
        createRoleIfAbsent("STAFF", "Staff", "General staff access", true, true, false, true, false, true);
        log.info("✅ Roles seeded.");
    }

    private void createRoleIfAbsent(String name, String displayName, String description, boolean isSystem,
                                    boolean hms, boolean asset, boolean inventory, boolean ot, boolean pharmacy) {
        if (!roleRepository.existsByName(name)) {
            roleRepository.save(Role.builder()
                    .name(name)
                    .displayName(displayName)
                    .description(description)
                    .isSystemRole(isSystem)
                    .canAccessHms(hms)
                    .canAccessAsset(asset)
                    .canAccessInventory(inventory)
                    .canAccessOt(ot)
                    .canAccessPharmacy(pharmacy)
                    .build());
        }
    }

    /**
     * Seeds the initial Hospital Admin account.
     * Email : admin@zenohosp.com
     * Password: admin123
     * Role : HOSPITAL_ADMIN
     * Hospital: Zeno Hospital
     *
     * Idempotent — skips if the admin already exists.
     */
    private void seedHospitalAdmin() {
        if (userRepository.existsByEmail("admin@zenohosp.com")) {
            log.info("ℹ️  Hospital admin already exists — skipping.");
            return;
        }

        Role adminRole = roleRepository.findByName("HOSPITAL_ADMIN")
                .orElseThrow(() -> new IllegalStateException("HOSPITAL_ADMIN role not found after seed"));

        // Get or create the hospital - check if it already exists
        Hospital hospital = hospitalRepository.findByCode("SRM")
                .orElseGet(() -> hospitalRepository.save(
                        Hospital.builder()
                                .code("SRM")
                                .name("SRM Hospital")
                                .subdomain("srm")
                                .address("Chennai, Tamil Nadu")
                                .build()));

        // Create the admin user
        userRepository.save(
                User.builder()
                        .hospital(hospital)
                        .role(adminRole)
                        .email("admin@zenohosp.com")
                        .passwordHash(passwordEncoder.encode("admin123"))
                        .firstName("Zeno")
                        .lastName("Admin")
                        .isActive(true)
                        .build());

        log.info("✅ Hospital admin seeded → admin@zenohosp.com / admin123  [Hospital: Zeno Hospital]");
    }
}

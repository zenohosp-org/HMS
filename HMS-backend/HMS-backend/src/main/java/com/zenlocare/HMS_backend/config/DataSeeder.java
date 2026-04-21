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
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final HospitalRepository hospitalRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        seedRoles();
        seedHospitalAdmin();
    }

    private void seedRoles() {
        createRoleIfAbsent("super_admin", "Super Admin", "Full system access", true, true, true, true, true, true);
        createRoleIfAbsent("hospital_admin", "Hospital Admin", "Administrative access for hospital", true, true, true,
                true, true, true);
        createRoleIfAbsent("doctor", "Doctor", "Medical professional access", true, true, false, false, true, false);
        createRoleIfAbsent("staff", "Staff", "General staff access", true, true, false, true, false, true);
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

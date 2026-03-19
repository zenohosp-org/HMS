package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.entity.Hospital;
import com.zenlocare.HMS_backend.entity.Role;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.exception.ConflictException;
import com.zenlocare.HMS_backend.exception.ResourceNotFoundException;
import com.zenlocare.HMS_backend.repository.HospitalRepository;
import com.zenlocare.HMS_backend.repository.RoleRepository;
import com.zenlocare.HMS_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final HospitalRepository hospitalRepository;
    private final PasswordEncoder passwordEncoder;

    public List<User> getUsersByHospital(UUID hospitalId) {
        return userRepository.findByHospitalId(hospitalId);
    }

    public User getUserById(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
    }

    public List<User> searchUsers(UUID hospitalId, String query, String role) {
        if (query == null || query.trim().isEmpty()) {
            if (role != null && !role.trim().isEmpty()) {
                return userRepository.findByHospitalIdAndRoleName(hospitalId, role);
            }
            return userRepository.findByHospitalId(hospitalId);
        }

        // Use pagination request to limit to top 20 results for performance
        org.springframework.data.domain.Pageable limit = org.springframework.data.domain.PageRequest.of(0, 20);
        return userRepository.searchUsers(hospitalId, query.trim(), role, limit);
    }

    public User createUser(String email, String password, String firstName, String lastName,
            String roleName, UUID hospitalId, String phone, String employeeCode, String designation,
            String gender, java.time.LocalDate dateOfJoining, UUID branchId, UUID departmentId) {

        final String normalizedEmail = email != null ? email.toLowerCase().trim() : null;
        final String normalizedRoleName = roleName != null ? roleName.toLowerCase().trim() : null;

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new ConflictException("Email already exists: " + normalizedEmail);
        }

        Role role = roleRepository.findByName(normalizedRoleName)
                .orElseThrow(() -> new ResourceNotFoundException("Role not found: " + normalizedRoleName));

        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Hospital not found"));

        User user = User.builder()
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(password != null ? password : "defaultPassword123"))
                .firstName(firstName)
                .lastName(lastName)
                .role(role)
                .hospital(hospital)
                .phone(phone)
                .employeeCode(employeeCode)
                .designation(designation)
                .gender(gender)
                .dateOfJoining(dateOfJoining)
                .branchId(branchId)
                .departmentId(departmentId)
                .isActive(true)
                .build();

        return userRepository.save(user);
    }

    public User updateUser(UUID userId, User updatedData) {
        User user = getUserById(userId);

        if (updatedData.getFirstName() != null)
            user.setFirstName(updatedData.getFirstName());
        if (updatedData.getLastName() != null)
            user.setLastName(updatedData.getLastName());
        if (updatedData.getPhone() != null)
            user.setPhone(updatedData.getPhone());

        return userRepository.save(user);
    }

    public void deactivateUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setIsActive(false);
        userRepository.save(user);
    }

    public void activateUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setIsActive(true);
        userRepository.save(user);
    }
}

package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.service.UserService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<List<UserDto>> listUsers(@RequestParam UUID hospitalId) {
        List<User> users = userService.getUsersByHospital(hospitalId);
        List<UserDto> dtos = users.stream().map(this::mapToDto).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getUser(@PathVariable UUID id) {
        User user = userService.getUserById(id);
        return ResponseEntity.ok(mapToDto(user));
    }

    @GetMapping("/search")
    public ResponseEntity<List<UserDto>> searchUsers(
            @RequestParam UUID hospitalId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String role) {
        List<User> users = userService.searchUsers(hospitalId, q, role);
        List<UserDto> dtos = users.stream().map(this::mapToDto).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PostMapping
    @PreAuthorize("hasRole('hospital_admin')")
    public ResponseEntity<UserDto> createUser(@RequestBody CreateUserRequest req) {
        User user = userService.createUser(
                req.getEmail(), req.getPassword(), req.getFirstName(), req.getLastName(),
                req.getRole(), req.getHospitalId(), req.getPhone(),
                req.getEmployeeCode(), req.getDesignation(), req.getGender(),
                req.getDateOfJoining(), req.getBranchId(), req.getDepartmentId());
        return ResponseEntity.ok(mapToDto(user));
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('hospital_admin')")
    public ResponseEntity<Void> deactivateUser(@PathVariable java.util.UUID id) {
        userService.deactivateUser(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasRole('hospital_admin')")
    public ResponseEntity<Void> activateUser(@PathVariable java.util.UUID id) {
        userService.activateUser(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserDto> updateUser(@PathVariable UUID id, @RequestBody UserDto req) {
        User updatedData = new User();
        updatedData.setFirstName(req.getFirstName());
        updatedData.setLastName(req.getLastName());
        updatedData.setPhone(req.getPhone());

        User user = userService.updateUser(id, updatedData);
        return ResponseEntity.ok(mapToDto(user));
    }

    private UserDto mapToDto(User user) {
        UserDto dto = new UserDto();
        dto.setId(user.getId().toString());
        dto.setEmail(user.getEmail());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setRole(user.getRole().getName());
        dto.setRoleDisplay(user.getRole().getDisplayName());
        dto.setPhone(user.getPhone());
        dto.setIsActive(user.getIsActive());

        dto.setEmployeeCode(user.getEmployeeCode());
        dto.setDesignation(user.getDesignation());
        dto.setGender(user.getGender());
        dto.setDateOfJoining(user.getDateOfJoining());
        dto.setBranchId(user.getBranchId());
        dto.setDepartmentId(user.getDepartmentId());
        dto.setLastLoginAt(user.getLastLoginAt());

        return dto;
    }

    @Data
    public static class CreateUserRequest {
        private String email;
        private String password;
        private String firstName;
        private String lastName;
        private String role;
        private UUID hospitalId;
        private String phone;
        private String employeeCode;
        private String designation;
        private String gender;
        private java.time.LocalDate dateOfJoining;
        private UUID branchId;
        private UUID departmentId;
    }

    @Data
    public static class UserDto {
        private String id;
        private String email;
        private String firstName;
        private String lastName;
        private String role;
        private String roleDisplay;
        private Boolean isActive;
        private String phone;
        private String employeeCode;
        private String designation;
        private String gender;
        private java.time.LocalDate dateOfJoining;
        private UUID branchId;
        private UUID departmentId;
        private java.time.LocalDateTime lastLoginAt;
    }
}

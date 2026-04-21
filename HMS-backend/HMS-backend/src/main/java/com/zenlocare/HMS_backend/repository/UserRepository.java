package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.Hospital;
import com.zenlocare.HMS_backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    Optional<User> findByEmailAndHospitalId(String email, UUID hospitalId);

    List<User> findByHospitalId(UUID hospitalId);

    List<User> findByHospitalIdAndRoleName(UUID hospitalId, String roleName);

    List<User> findByRoleName(String roleName);

    boolean existsByEmail(String email);

    boolean existsByEmailAndHospital(String email, Hospital hospital);

    @org.springframework.data.jpa.repository.Query("SELECT u FROM User u WHERE u.hospital.id = :hospitalId AND " +
            "(:role IS NULL OR u.role.name = :role) AND " +
            "(LOWER(u.firstName) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
            "OR LOWER(u.lastName) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
            "OR LOWER(u.email) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
            "OR LOWER(u.phone) LIKE LOWER(CONCAT('%', :searchTerm, '%')))")
    List<User> searchUsers(
            @org.springframework.data.repository.query.Param("hospitalId") UUID hospitalId,
            @org.springframework.data.repository.query.Param("searchTerm") String searchTerm,
            @org.springframework.data.repository.query.Param("role") String role,
            org.springframework.data.domain.Pageable pageable);
}

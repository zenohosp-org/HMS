package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.CasualtyDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CasualtyDetailRepository extends JpaRepository<CasualtyDetail, Long> {
    Optional<CasualtyDetail> findByPatientId(Integer patientId);
}

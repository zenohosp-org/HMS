package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.BirthRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BirthRecordRepository extends JpaRepository<BirthRecord, Long> {
    List<BirthRecord> findByMother_Id(Integer motherPatientId);
}

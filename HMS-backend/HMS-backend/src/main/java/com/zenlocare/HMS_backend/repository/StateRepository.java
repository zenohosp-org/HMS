package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.State;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StateRepository extends JpaRepository<State, UUID> {
    List<State> findByIsActiveTrueOrderByDisplayOrderAsc();
}

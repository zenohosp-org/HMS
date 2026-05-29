package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.AttachmentAccessLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AttachmentAccessLogRepository extends JpaRepository<AttachmentAccessLog, Long> {

    /** Audit drill-down: who has accessed a particular attachment. Newest first. */
    List<AttachmentAccessLog> findByAttachmentIdOrderByAccessedAtDesc(UUID attachmentId);
}

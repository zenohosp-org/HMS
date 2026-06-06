package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.InvoiceItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface InvoiceItemRepository extends JpaRepository<InvoiceItem, UUID> {

    // Cheap insurance for future server-side dedupe of OT lines. Not consumed
    // today — the IPD finalize modal still dedupes on the client — but lets a
    // background reconciler ask "has this OTM invoice item already been
    // mirrored into HMS?" without scanning every invoice.
    boolean existsByOtInvoiceItemId(UUID otInvoiceItemId);
}

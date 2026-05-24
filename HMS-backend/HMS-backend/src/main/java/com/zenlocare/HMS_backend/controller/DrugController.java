package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.entity.User;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Thin read-only window into {@code pharmacy_drug_master}, owned by the
 * pharmacy backend, exposed here so the HMS prescription picker doesn't have
 * to make cross-origin calls to pharmacy. Pharmacy + HMS share the same DB
 * (see schema co-location), so a direct read is safe; nothing here writes.
 *
 * Gated to clinicians + hospital admins so general staff can't enumerate the
 * drug catalogue through this endpoint.
 */
@RestController
@RequestMapping("/api/drugs")
@RequiredArgsConstructor
public class DrugController {

    private final JdbcTemplate jdbc;

    /**
     * Search active drugs in a hospital's master. Matches on brand_name,
     * generic_name, or salt_name (case-insensitive prefix-or-contains).
     * Capped at 50 results — picker is a typeahead, not a catalogue browser.
     *
     * `inStock` reflects whether the drug is linked to an inventory item id —
     * pharmacy uses this to know what it actually carries. UI displays a
     * subtle hint; doctors can still prescribe out-of-stock drugs because
     * pharmacy resolves substitution / sourcing at dispense time.
     */
    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('doctor', 'hospital_admin', 'super_admin')")
    public ResponseEntity<List<DrugDto>> search(
            @RequestParam UUID hospitalId,
            @RequestParam(required = false, defaultValue = "") String q,
            @AuthenticationPrincipal User user) {

        // Tenant guard — the hospitalId on the URL must match the caller's hospital
        // (super_admin bypasses). Without this, a forged hospitalId would expose
        // another hospital's drug catalogue via this endpoint.
        if (user != null && user.getRole() != null
                && !"super_admin".equalsIgnoreCase(user.getRole().getName())
                && user.getHospital() != null
                && !user.getHospital().getId().equals(hospitalId)) {
            throw new AccessDeniedException("Drug search restricted to caller's hospital");
        }

        String like = "%" + (q == null ? "" : q.trim().toLowerCase()) + "%";
        String sql = """
            SELECT id, brand_name, generic_name, salt_name, strength, form, schedule, inventory_item_id
              FROM pharmacy_drug_master
             WHERE hospital_id = ?
               AND COALESCE(is_active, TRUE) = TRUE
               AND (
                   LOWER(brand_name)   LIKE ?
                OR LOWER(COALESCE(generic_name, '')) LIKE ?
                OR LOWER(COALESCE(salt_name, ''))    LIKE ?
               )
             ORDER BY brand_name ASC
             LIMIT 50
            """;

        List<DrugDto> rows = jdbc.query(sql,
                ps -> {
                    ps.setObject(1, hospitalId);
                    ps.setString(2, like);
                    ps.setString(3, like);
                    ps.setString(4, like);
                },
                (rs, i) -> {
                    DrugDto d = new DrugDto();
                    Object idObj = rs.getObject("id");
                    d.setId(idObj != null ? idObj.toString() : null);
                    d.setBrandName(rs.getString("brand_name"));
                    d.setGenericName(rs.getString("generic_name"));
                    d.setSaltName(rs.getString("salt_name"));
                    d.setStrength(rs.getString("strength"));
                    d.setForm(rs.getString("form"));
                    d.setSchedule(rs.getString("schedule"));
                    d.setInStock(rs.getObject("inventory_item_id") != null);
                    return d;
                });
        return ResponseEntity.ok(rows);
    }

    @Data
    public static class DrugDto {
        private String id;
        private String brandName;
        private String genericName;
        private String saltName;
        private String strength;
        private String form;
        /** H, H1, X, etc. — controlled-substance schedule per the Drugs Act. */
        private String schedule;
        /** True if pharmacy actually carries this in inventory today. */
        private boolean inStock;
    }
}

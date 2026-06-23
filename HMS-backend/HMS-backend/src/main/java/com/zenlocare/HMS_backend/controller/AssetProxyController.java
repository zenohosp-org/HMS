package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.integration.AssetsClient;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Read-only proxy that forwards asset retrieval to the asset-manager
 * service. Lives alongside {@link AssetRoomController} — Spring's path
 * matcher gives priority to AssetRoomController's more-specific patterns
 * (e.g. {@code /room/{roomId}}, {@code /available}) so the existing
 * room-assignment endpoints continue to read HMS's local assets table
 * unchanged. The two routes added here are paths AssetRoomController
 * does NOT claim:
 *
 *   GET /api/assets            → asset-manager's GET /api/assets
 *   GET /api/assets/{id}       → asset-manager's GET /api/assets/{id}
 *
 * Both forward the caller's JWT so asset-manager resolves hospital
 * scoping from the same claims HMS just validated — no double-scoping,
 * no shared cookie required.
 *
 * Why a proxy (not a direct frontend call to api-asset): single origin,
 * single auth flow, single log stream — same reasoning as
 * {@link HealthCheckupProxyController}. The HMS frontend treats
 * {@code /api/assets} as one cohesive surface; it doesn't need to know
 * that the list/get rows come from a separate service.
 *
 * Writes (create, update, delete, assign-room, transfer) are not
 * proxied here — they still touch HMS-side rooms and live on the local
 * {@link AssetRoomController}. A follow-up will migrate them once
 * room/bed linkage is also externalised.
 */
@RestController
@RequestMapping("/api/assets")
@RequiredArgsConstructor
@Slf4j
public class AssetProxyController {

    private final AssetsClient assetsClient;

    /**
     * GET /api/assets[?roomId=&sourceItemId=] — forward to
     * asset-manager. Hospital scoping is derived upstream from the JWT,
     * so we don't add a hospitalId parameter on our side.
     */
    @GetMapping
    public ResponseEntity<String> listAssets(HttpServletRequest request) {
        return forward(HttpMethod.GET, request, null);
    }

    /**
     * GET /api/assets/{id} — forward to asset-manager. Regex
     * constraint on {id} ensures this only matches UUIDs so we don't
     * shadow AssetRoomController's literal sub-paths (e.g.
     * {@code /room/{roomId}}, {@code /available}) — those have
     * non-UUID segments and route to the local controller.
     */
    @GetMapping("/{id:[0-9a-fA-F-]{36}}")
    public ResponseEntity<String> getAsset(@PathVariable String id, HttpServletRequest request) {
        UUID.fromString(id); // defensive — pattern already enforced
        return forward(HttpMethod.GET, request, null);
    }

    private ResponseEntity<String> forward(HttpMethod method, HttpServletRequest request, String body) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String jwt = (auth != null && auth.getCredentials() instanceof String s) ? s : null;
        return assetsClient.proxyJson(method, request.getRequestURI(),
                request.getQueryString(), body, jwt);
    }
}

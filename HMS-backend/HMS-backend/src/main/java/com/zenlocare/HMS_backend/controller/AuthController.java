package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.AuthResponse;
import com.zenlocare.HMS_backend.dto.LoginRequest;
import com.zenlocare.HMS_backend.dto.RegisterRequest;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * POST /api/auth/login
     * Body: { "email": "...", "password": "..." }
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    /**
     * POST /api/auth/register
     * Body: { "email": "...", "password": "...", "firstName": "...", "lastName":
     * "...", "phone": "..." }
     */
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    /**
     * GET /api/auth/me
     * Returns profile of the currently authenticated user (from JWT).
     */
    @GetMapping("/me")
    public ResponseEntity<AuthResponse> getProfile(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(authService.getProfile(user));
    }

    /**
     * GET /api/auth/health
     * Public health check endpoint.
     */
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("Auth service is running ✅");
    }
}

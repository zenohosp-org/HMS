package com.zenlocare.HMS_backend.security;

import com.zenlocare.HMS_backend.entity.Role;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.repository.RoleRepository;
import com.zenlocare.HMS_backend.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * After successful Google login:
 *  1. Extract email + googleId from the OIDC token.
 *  2. Find the existing user by email OR create a new STAFF user.
 *  3. Save / update googleId on the user record.
 *  4. Issue a JWT and redirect to the frontend with the token in the URL.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GoogleOAuth2SuccessHandler implements AuthenticationSuccessHandler {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final JwtUtil jwtUtil;

    @Value("${frontend.url}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {

        OidcUser oidcUser = (OidcUser) authentication.getPrincipal();

        String email    = oidcUser.getEmail();
        String googleId = oidcUser.getSubject();
        String firstName = oidcUser.getGivenName() != null ? oidcUser.getGivenName() : email;
        String lastName  = oidcUser.getFamilyName();

        // Find existing user by email, or create a new STAFF user
        User user = userRepository.findByEmail(email).orElseGet(() -> {
            Role staffRole = roleRepository.findByName("STAFF")
                    .orElseThrow(() -> new IllegalStateException("STAFF role not found"));

            return User.builder()
                    .email(email)
                    .firstName(firstName)
                    .lastName(lastName)
                    .googleId(googleId)
                    .role(staffRole)
                    .isActive(true)
                    .build();
        });

        // Update googleId if it's missing (e.g. user existed with email/password before)
        if (user.getGoogleId() == null) {
            user.setGoogleId(googleId);
        }

        userRepository.save(user);

        String roleName   = user.getRole().getName();
        String hospitalId = user.getHospital() != null ? user.getHospital().getId().toString() : null;
        String token      = jwtUtil.generateToken(email, roleName, hospitalId);

        log.info("Google OAuth2 login success for: {} ({})", email, roleName);

        // Redirect to frontend — token is passed as a query param so the SPA can store it
        String redirectUrl = frontendUrl + "/auth/google/callback?token=" + token;
        response.sendRedirect(redirectUrl);
    }
}

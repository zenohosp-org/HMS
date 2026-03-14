package com.zenlocare.HMS_backend.security;

import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

/**
 * Handles successful Directory SSO login.
 *
 * After Spring Security completes the code→token exchange with Directory Backend:
 *  1. Extract email from the OAuth2 user attributes.
 *  2. Look up the user in the local zenohosp DB by email.
 *  3. Issue a local HMS JWT via JwtUtil.
 *  4. Redirect browser to HMS Frontend /sso/callback?token=<jwt>.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DirectorySsoSuccessHandler implements AuthenticationSuccessHandler {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    @Value("${frontend.url}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                         HttpServletResponse response,
                                         Authentication authentication) throws IOException {
        
        try {
            log.info("Directory SSO: Processing successful authentication for principal: {}", authentication.getName());
            OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
            Map<String, Object> attributes = oauthToken.getPrincipal().getAttributes();
            log.info("Directory SSO: Attributes received: {}", attributes);

        String email = (String) attributes.get("email");

        // Robustness: If not at top level, check if it's wrapped in a 'data' object
        if (email == null && attributes.containsKey("data") && attributes.get("data") instanceof Map) {
            Map<?, ?> data = (Map<?, ?>) attributes.get("data");
            email = (String) data.get("email");
            log.info("Directory SSO: Found email in 'data' wrapper: {}", email);
        }

        if (email == null) {
            log.error("Directory SSO: email attribute missing from user-info response. Attributes keys: {}", attributes.keySet());
            response.sendRedirect(frontendUrl + "/login?error=sso_failed");
            return;
        }

        User user = userRepository.findByEmail(email).orElse(null);
        log.debug("Directory SSO: Local user lookup result: {}", user != null ? "Found" : "Not Found");
 
        if (user == null) {
            log.warn("Directory SSO: no local HMS user found for email={}", email);
            response.sendRedirect(frontendUrl + "/login?error=user_not_found");
            return;
        }
 
        if (user.getRole() == null) {
            log.error("Directory SSO: User {} has no role assigned!", email);
            response.sendRedirect(frontendUrl + "/login?error=role_missing");
            return;
        }

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            log.warn("Directory SSO: user account is inactive for email={}", email);
            response.sendRedirect(frontendUrl + "/login?error=account_inactive");
            return;
        }

        // Check if HMS access is enabled for this user's role
        if (!Boolean.TRUE.equals(user.getRole().getCanAccessHms())) {
            log.warn("Directory SSO: HMS access not enabled for user email={} role={}", email, user.getRole().getName());
            response.sendRedirect(frontendUrl + "/login?error=no_hms_access");
            return;
        }

        String roleName   = user.getRole().getName();
        String hospitalId = user.getHospital() != null ? user.getHospital().getId().toString() : null;
        String localToken = jwtUtil.generateToken(email, roleName, hospitalId);
 
        log.info("Directory SSO login success for: {}. redirecting to frontend callback.", email);
 
        response.sendRedirect(frontendUrl + "/sso/callback?token=" + localToken);
        } catch (Exception e) {
            log.error("Directory SSO: Critical error in success handler: {}", e.getMessage(), e);
            response.sendRedirect(frontendUrl + "/login?error=internal_server_error");
        }
    }
}

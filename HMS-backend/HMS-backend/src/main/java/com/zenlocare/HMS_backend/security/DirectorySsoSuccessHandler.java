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

/**
 * Handles successful Directory SSO login.
 *
 * After Spring Security completes the code→token exchange with Directory Backend:
 *  1. Extract email from the OAuth2 user attributes.
 *  2. Look up the user in the local HMS DB by email.
 *  3. Issue a local HMS JWT via JwtUtil.
 *  4. Set JWT as an HttpOnly cookie via raw Set-Cookie header (same technique as Directory).
 *  5. Redirect to /sso/callback — no token in the URL.
 *
 * WHY raw Set-Cookie header (not Java Cookie API):
 *   Java's Cookie.setDomain("zenohosp.com") sends "Domain=zenohosp.com" without a leading dot.
 *   Browsers require the leading dot to send the cookie to all subdomains.
 *   Java's Cookie API cannot set the leading dot, so we write the header manually — matching
 *   the exact approach used in the Directory backend AuthController.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DirectorySsoSuccessHandler implements AuthenticationSuccessHandler {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    @Value("${frontend.url}")
    private String frontendUrl;

    @Value("${jwt.cookie.name}")
    private String cookieName;

    @Value("${jwt.cookie.domain:localhost}")
    private String cookieDomain;

    @Value("${jwt.cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${jwt.expiration:86400}")
    private int cookieMaxAge;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                         HttpServletResponse response,
                                         Authentication authentication) throws IOException {

        try {
            log.info("Directory SSO: Processing authentication for principal: {}", authentication.getName());
            OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
            Map<String, Object> attributes = oauthToken.getPrincipal().getAttributes();

            String email = (String) attributes.get("email");

            if (email == null && attributes.containsKey("data") && attributes.get("data") instanceof Map) {
                Map<?, ?> data = (Map<?, ?>) attributes.get("data");
                email = (String) data.get("email");
                log.info("Directory SSO: Found email in 'data' wrapper: {}", email);
            }

            if (email == null) {
                log.error("Directory SSO: email attribute missing. Keys: {}", attributes.keySet());
                response.sendRedirect(frontendUrl + "/login?error=sso_failed");
                return;
            }

            User user = userRepository.findByEmail(email).orElse(null);

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
                log.warn("Directory SSO: user account inactive for email={}", email);
                response.sendRedirect(frontendUrl + "/login?error=account_inactive");
                return;
            }

            if (!Boolean.TRUE.equals(user.getRole().getCanAccessHms())) {
                log.warn("Directory SSO: HMS access not enabled for email={} role={}", email, user.getRole().getName());
                response.sendRedirect(frontendUrl + "/login?error=no_hms_access");
                return;
            }

            String roleName   = user.getRole().getName(); // already lowercase via Role.normalizeCase()
            String hospitalId = user.getHospital() != null ? user.getHospital().getId().toString() : null;
            String localToken = jwtUtil.generateToken(email, roleName, hospitalId);

            setJwtCookieHeader(response, localToken);

            log.info("Directory SSO login success for: {}, redirecting to callback.", email);
            response.sendRedirect(frontendUrl + "/sso/callback");

        } catch (Exception e) {
            log.error("Directory SSO: Critical error: {}", e.getMessage(), e);
            response.sendRedirect(frontendUrl + "/login?error=internal_server_error");
        }
    }

    /**
     * Sets the JWT cookie using a raw Set-Cookie header.
     * In production (secure=true): Domain=.zenohosp.com; Secure; SameSite=None
     * In development (secure=false): no Domain, no Secure, SameSite=Lax
     */
    private void setJwtCookieHeader(HttpServletResponse response, String token) {
        String header;
        if (cookieSecure) {
            String domain = cookieDomain.startsWith(".") ? cookieDomain.substring(1) : cookieDomain;
            header = String.format(
                "%s=%s; Domain=.%s; Path=/; Max-Age=%d; HttpOnly; Secure; SameSite=None",
                cookieName, token, domain, cookieMaxAge);
        } else {
            header = String.format(
                "%s=%s; Path=/; Max-Age=%d; HttpOnly; SameSite=Lax",
                cookieName, token, cookieMaxAge);
        }
        response.addHeader("Set-Cookie", header);
    }
}

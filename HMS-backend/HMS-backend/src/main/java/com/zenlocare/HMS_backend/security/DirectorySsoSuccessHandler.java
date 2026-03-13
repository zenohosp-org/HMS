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
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;

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
    private final OAuth2AuthorizedClientService authorizedClientService;

    @Value("${frontend.url}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                         HttpServletResponse response,
                                         Authentication authentication) throws IOException {

        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
        Map<String, Object> attributes = oauthToken.getPrincipal().getAttributes();

        String email = (String) attributes.get("email");

        if (email == null) {
            log.error("Directory SSO: email attribute missing from user-info response");
            response.sendRedirect(frontendUrl + "/login?error=sso_failed");
            return;
        }

        User user = userRepository.findByEmail(email).orElse(null);

        if (user == null) {
            log.warn("Directory SSO: no local HMS user found for email={}", email);
            response.sendRedirect(frontendUrl + "/login?error=user_not_found");
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

        // Get the original access token from Directory
        String clientRegistrationId = oauthToken.getAuthorizedClientRegistrationId();
        var client = authorizedClientService.loadAuthorizedClient(clientRegistrationId, oauthToken.getName());
        
        if (client == null) {
            log.error("Directory SSO: Could not load authorized client for registrationId={} principal={}", 
                      clientRegistrationId, oauthToken.getName());
            response.sendRedirect(frontendUrl + "/login?error=token_retrieval_failed");
            return;
        }

        String token = client.getAccessToken().getTokenValue();

        log.info("Directory SSO login success for: {}. Using shared Directory token.", email);

        response.sendRedirect(frontendUrl + "/sso/callback?token=" + token);
    }
}

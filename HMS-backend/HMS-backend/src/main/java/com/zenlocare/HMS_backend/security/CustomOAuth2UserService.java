package com.zenlocare.HMS_backend.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private void logBoth(String message) {
        System.out.println("SSO_DIAGNOSTIC: " + message);
        try (PrintWriter out = new PrintWriter(new FileWriter("sso_debug.log", true))) {
            out.println(LocalDateTime.now() + " : " + message);
        } catch (Exception e) {
            log.error("Failed to write to sso_debug.log", e);
        }
    }

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        try {
            if (userRequest == null || userRequest.getClientRegistration() == null) {
                logBoth("CRITICAL: userRequest or ClientRegistration is NULL");
                throw new OAuth2AuthenticationException("Invalid user request");
            }

            String registrationId = userRequest.getClientRegistration().getRegistrationId();
            logBoth("Starting loadUser for registration: " + registrationId);
            
            if ("directory".equalsIgnoreCase(registrationId)) {
                return loadDirectoryUser(userRequest);
            }

            return super.loadUser(userRequest);
        } catch (Throwable t) {
            logBoth("CRITICAL GLOBAL ERROR in loadUser: " + t.getMessage());
            t.printStackTrace();
            if (t instanceof OAuth2AuthenticationException oae) throw oae;
            throw new OAuth2AuthenticationException(t.getMessage());
        }
    }

    private OAuth2User loadDirectoryUser(OAuth2UserRequest userRequest) {
        logBoth("Inside loadDirectoryUser");
        try {
            var providerDetails = userRequest.getClientRegistration().getProviderDetails();
            var userInfoEndpoint = providerDetails.getUserInfoEndpoint();
            String userInfoUri = userInfoEndpoint.getUri();
            String accessToken = userRequest.getAccessToken().getTokenValue();
            
            logBoth("Manually fetching user info from: " + userInfoUri);
            logBoth("Token (first 10 chars): " + (accessToken != null && accessToken.length() > 10 ? accessToken.substring(0, 10) : "null"));
            
            if (userInfoUri == null) {
                logBoth("ERROR: User Info URI is NULL in configuration!");
                throw new RuntimeException("User Info URI is missing");
            }

            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            logBoth("Executing RestTemplate exchange...");
            ResponseEntity<Map> response = restTemplate.exchange(userInfoUri, HttpMethod.GET, entity, Map.class);
            Map<String, Object> attributes = (Map<String, Object>) response.getBody();
            logBoth("Manual fetch response status: " + response.getStatusCode());
            logBoth("Manual fetch response body: " + attributes);
            
            if (attributes == null) {
                throw new RuntimeException("Received empty response body from user-info endpoint");
            }

            Map<String, Object> processedAttributes = new HashMap<>(attributes);
            
            if (attributes.containsKey("data") && attributes.get("data") instanceof Map) {
                Map<String, Object> data = (Map<String, Object>) attributes.get("data");
                processedAttributes.putAll(data);
                logBoth("Unwrapped 'data' into top level");
            }

            String userNameAttributeName = userInfoEndpoint.getUserNameAttributeName();
            if (userNameAttributeName == null) userNameAttributeName = "email";
            
            logBoth("Using userNameAttributeName: " + userNameAttributeName);
            
            if (!processedAttributes.containsKey(userNameAttributeName)) {
                logBoth("Warning: '" + userNameAttributeName + "' not found. Keys: " + processedAttributes.keySet());
                if (processedAttributes.containsKey("email")) {
                    userNameAttributeName = "email";
                    logBoth("Falling back to 'email'");
                } else if (!processedAttributes.isEmpty()) {
                    userNameAttributeName = processedAttributes.keySet().iterator().next();
                    logBoth("Critical Fallback to first key: " + userNameAttributeName);
                }
            }

            Collection<GrantedAuthority> authorities = new ArrayList<>();
            authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
            
            logBoth("Successfully created OAuth2User for: " + processedAttributes.get(userNameAttributeName));
            return new DefaultOAuth2User(authorities, processedAttributes, userNameAttributeName);
            
        } catch (Throwable e) {
            logBoth("Manual fetch failed with Throwable: " + e.getMessage());
            e.printStackTrace();
            throw new OAuth2AuthenticationException(e.getMessage());
        }
    }
}

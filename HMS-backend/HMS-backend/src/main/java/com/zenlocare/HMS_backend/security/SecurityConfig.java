package com.zenlocare.HMS_backend.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizationRequestRepository;

import java.io.IOException;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final GoogleOAuth2SuccessHandler googleOAuth2SuccessHandler;
    private final DirectorySsoSuccessHandler directorySsoSuccessHandler;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                // Explicitly allow sessions for the OAuth2 handshake, but stay stateless for APIs
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .securityContext(context -> context.securityContextRepository(new HttpSessionSecurityContextRepository()))
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints — no token required
                        .requestMatchers(
                                "/api/auth/**",
                                "/api/public/**",
                                "/actuator/health",
                                "/login/**",
                                "/oauth2/**",
                                "/error")
                        .permitAll()
                        // Super Admin only
                        .requestMatchers("/api/super-admin/**").hasRole("SUPER_ADMIN")
                        // Admin and above
                        .requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        // All authenticated users
                        .anyRequest().authenticated())
                .oauth2Login(oauth2 -> oauth2
                        .authorizationEndpoint(auth -> auth.authorizationRequestRepository(new HttpSessionOAuth2AuthorizationRequestRepository()))
                        .successHandler(delegatingOAuth2SuccessHandler()))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Routes OAuth2 login success to the correct handler based on the registration ID.
     * - "google"    → GoogleOAuth2SuccessHandler
     * - "directory" → DirectorySsoSuccessHandler
     */
    @Bean
    public AuthenticationSuccessHandler delegatingOAuth2SuccessHandler() {
        return (HttpServletRequest request, HttpServletResponse response, Authentication authentication) -> {
            if (authentication instanceof OAuth2AuthenticationToken token) {
                String registrationId = token.getAuthorizedClientRegistrationId();
                AuthenticationSuccessHandler handler = switch (registrationId) {
                    case "directory" -> directorySsoSuccessHandler;
                    default -> googleOAuth2SuccessHandler; // "google" and any future providers
                };
                handler.onAuthenticationSuccess(request, response, authentication);
            } else {
                googleOAuth2SuccessHandler.onAuthenticationSuccess(request, response, authentication);
            }
        };
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @org.springframework.beans.factory.annotation.Value("${frontend.url}")
    private String frontendUrl;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
                "http://localhost:3000",
                "http://localhost:5173",
                "http://localhost:5174",
                frontendUrl));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}

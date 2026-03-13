# SSO Implementation — Google OAuth2 via Directory Backend

## Problem & Architecture

The desired SSO flow is:

```
Frontend (3001)  →  Asset Backend (8081)  →  Directory Backend (9000)  →  Google  →  back
```

**Step-by-step flow:**
1. User opens **Asset Frontend** (`localhost:3001`), clicks **"SSO Login"** button.
2. Browser navigates to **Asset Backend** `/oauth2/authorization/directory`.
3. Asset Backend redirects browser to **Directory Backend** `/oauth2/authorize` (with `client_id`, `redirect_uri`, `state`).
4. Directory Backend renders a **login page** (email/password or Google sign-in).
5. User authenticates on Directory Backend.
6. Directory Backend issues an **authorization code** and redirects browser back to **Asset Backend** `/login/oauth2/code/directory`.
7. Asset Backend exchanges the auth code for a **Directory JWT** by calling Directory Backend's `/oauth2/token` endpoint (server-to-server).
8. Asset Backend extracts the JWT and **redirects the browser** to Frontend with the JWT as a query parameter: `http://localhost:3001/sso/callback?token=<JWT>`.
9. Frontend stores the JWT in `localStorage` and navigates to `/dashboard`.

> [!IMPORTANT]
> **Design decision:** Instead of using Spring's built-in OAuth2 Authorization Server module (which is heavy and requires a separate dependency), we'll implement a **lightweight custom OAuth2-like flow** on the Directory Backend with just 3 endpoints: `/oauth2/authorize`, `/oauth2/token`, and a login HTML page. This keeps it simple and reuses the existing [AuthService](file:///home/abishek/zenocare/directory/zenohosp/src/main/java/com/zenlocare/zenohosp/service/AuthService.java#27-194)/[JwtUtil](file:///home/abishek/zenocare/directory/zenohosp/src/main/java/com/zenlocare/zenohosp/security/JwtUtil.java#25-113).

> [!WARNING]
> The Google Client Secret you shared is now visible. Consider rotating it after development. For this implementation, it's only used in the Directory Backend's [application.properties](file:///home/abishek/zenocare/directory/zenohosp/src/main/resources/application.properties).

---

## Proposed Changes

### Component 1: Directory Backend (`directory/zenohosp`)

This is the **OAuth2 Authorization Server** side. We add 3 things: an `/oauth2/authorize` endpoint, an `/oauth2/token` endpoint, and a `login.html` page.

---

#### [NEW] [OAuth2Controller.java](file:///home/abishek/zenocare/directory/zenohosp/src/main/java/com/zenlocare/zenohosp/controller/OAuth2Controller.java)

A new controller with two endpoints:

- **`GET /oauth2/authorize`** — Receives `client_id`, `redirect_uri`, `response_type=code`, `state` from Asset Backend. Shows `login.html` (passing these params as hidden fields).
- **`POST /oauth2/token`** — Receives `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `client_secret`. Validates the code, looks up the user, calls `AuthService.buildLoginResponse()` to generate a JWT. Returns JSON `{ "access_token": "<jwt>", "token_type": "Bearer" }`.

Internally, the "authorization code" is a short-lived signed JWT (or a simple UUID stored in an in-memory map with a 60-second TTL) that encodes the authenticated user's email.

---

#### [NEW] [OAuth2AuthorizationService.java](file:///home/abishek/zenocare/directory/zenohosp/src/main/java/com/zenlocare/zenohosp/service/OAuth2AuthorizationService.java)

Service that manages:
- **Client validation** — checks `client_id` and `client_secret` against configured values.
- **Auth code generation** — creates a short-lived code (UUID → stored in `ConcurrentHashMap` with user email + expiry).
- **Auth code exchange** — validates the code, returns the user email, then deletes the code.

---

#### [NEW] [login.html](file:///home/abishek/zenocare/directory/zenohosp/src/main/resources/templates/login.html)

A Thymeleaf-rendered login page with:
- Email + password form fields.
- Hidden fields for `client_id`, `redirect_uri`, `state`.
- Form POST action → `/oauth2/login` (a new endpoint in `OAuth2Controller`).
- On successful login, the server generates an auth code and redirects to `redirect_uri?code=<code>&state=<state>`.

---

#### [MODIFY] [SecurityConfig.java](file:///home/abishek/zenocare/directory/zenohosp/src/main/java/com/zenlocare/zenohosp/config/SecurityConfig.java)

Add `/oauth2/**` to the public (permit-all) endpoints so the authorize/token/login endpoints don't require a JWT.

```diff
 .requestMatchers("/api/auth/**").permitAll()
 .requestMatchers("/api/directory/**").permitAll()
+.requestMatchers("/oauth2/**").permitAll()
```

---

#### [MODIFY] [WebConfig.java](file:///home/abishek/zenocare/directory/zenohosp/src/main/java/com/zenlocare/zenohosp/config/WebConfig.java)

Add CORS mapping for `/oauth2/**` so the Asset Backend can call `/oauth2/token`.

```diff
 registry.addMapping("/api/**")
+registry.addMapping("/oauth2/**")
```

---

#### [MODIFY] [application.properties](file:///home/abishek/zenocare/directory/zenohosp/src/main/resources/application.properties)

Add OAuth2 client credentials and the real Google Client ID:

```diff
-google.client-id=YOUR_GOOGLE_CLIENT_ID
+google.client-id=966447659179-60kfh1q0ls42l0kkugbi1i5ceqd5t4to.apps.googleusercontent.com
+
+# OAuth2 Client Registration (for Asset Manager)
+oauth2.client.asset-manager.client-id=asset-manager-client
+oauth2.client.asset-manager.client-secret=asset-manager-secret-key-2026
+oauth2.client.asset-manager.redirect-uri=http://localhost:8081/login/oauth2/code/directory
```

---

#### [MODIFY] [pom.xml](file:///home/abishek/zenocare/directory/zenohosp/pom.xml)

Add Thymeleaf dependency for rendering the login page:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-thymeleaf</artifactId>
</dependency>
```

---

### Component 2: Asset Backend (`assets/asset-manager`)

This is the **OAuth2 Client** side + **JWT validation** for all API requests.

---

#### [MODIFY] [application.properties](file:///home/abishek/zenocare/assets/asset-manager/src/main/resources/application.properties)

Add full Spring Security OAuth2 Client configuration and the shared JWT secret:

```properties
# ── OAuth2 Client (SSO via Directory) ──
spring.security.oauth2.client.registration.directory.client-id=asset-manager-client
spring.security.oauth2.client.registration.directory.client-secret=asset-manager-secret-key-2026
spring.security.oauth2.client.registration.directory.authorization-grant-type=authorization_code
spring.security.oauth2.client.registration.directory.redirect-uri=http://localhost:8081/login/oauth2/code/directory
spring.security.oauth2.client.registration.directory.scope=openid

spring.security.oauth2.client.provider.directory.authorization-uri=http://localhost:9000/oauth2/authorize
spring.security.oauth2.client.provider.directory.token-uri=http://localhost:9000/oauth2/token
spring.security.oauth2.client.provider.directory.user-info-uri=http://localhost:9000/api/user/me

# ── JWT (same secret as Directory so tokens can be verified) ──
jwt.secret=jhhuhjkhfu8374rwqloiqipaz8cuy39mjnncbvbbzma289eh3u

# ── Frontend redirect ──
app.frontend.url=http://localhost:3001
```

---

#### [MODIFY] [pom.xml](file:///home/abishek/zenocare/assets/asset-manager/pom.xml)

Add JJWT dependencies for JWT validation:

```xml
<!-- JWT -->
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.6</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
```

---

#### [MODIFY] [SecurityConfig.java](file:///home/abishek/zenocare/assets/asset-manager/src/main/java/com/zenohosp/asset_manager/config/SecurityConfig.java)

**Major rewrite.** Replace the current "permit all" config with:
- JWT Bearer token filter for `/api/**` endpoints.
- Custom OAuth2 success handler: after Spring Security exchanges the auth code, intercept the response, extract the JWT from the token response, and redirect to the frontend with `?token=<jwt>`.
- Keep CORS config.

---

#### [NEW] [JwtUtil.java](file:///home/abishek/zenocare/assets/asset-manager/src/main/java/com/zenohosp/asset_manager/security/JwtUtil.java)

JWT validation utility that uses the **same HMAC secret** as Directory Backend. Only needs `parseToken()` and `isValid()` — no token generation needed since Directory issues the tokens.

---

#### [NEW] [JwtFilter.java](file:///home/abishek/zenocare/assets/asset-manager/src/main/java/com/zenohosp/asset_manager/security/JwtFilter.java)

A `OncePerRequestFilter` that extracts the `Authorization: Bearer <token>` header, validates it with `JwtUtil`, and sets the `SecurityContext`.

---

#### [NEW] [OAuth2SsoSuccessHandler.java](file:///home/abishek/zenocare/assets/asset-manager/src/main/java/com/zenohosp/asset_manager/security/OAuth2SsoSuccessHandler.java)

Custom `AuthenticationSuccessHandler` for the OAuth2 login flow. After Spring Security completes the code→token exchange with Directory Backend:
1. Extract the `access_token` from the OAuth2 token response (this is the Directory-issued JWT).
2. Redirect the browser to `http://localhost:3001/sso/callback?token=<jwt>`.

---

#### [NEW] [AuthController.java](file:///home/abishek/zenocare/assets/asset-manager/src/main/java/com/zenohosp/asset_manager/controller/AuthController.java)

A `/api/auth/login` endpoint for local email/password login (calls Directory Backend's `/api/auth/login` via RestTemplate/WebClient and returns the JWT).

Also a `/api/user/me` endpoint that reads the JWT from the SecurityContext and returns user info.

---

### Component 3: Asset Frontend (`assets/asset-frontend`)

---

#### [MODIFY] [App.jsx](file:///home/abishek/zenocare/assets/asset-frontend/src/App.jsx)

Add routes:
- `/login` → `<Login />` component
- `/sso/callback` → new `<SsoCallback />` component

```diff
+import Login from './pages/Login';
+import SsoCallback from './pages/SsoCallback';
 ...
+<Route path="/login" element={<Login />} />
+<Route path="/sso/callback" element={<SsoCallback />} />
```

---

#### [NEW] [SsoCallback.jsx](file:///home/abishek/zenocare/assets/asset-frontend/src/pages/SsoCallback.jsx)

New page that:
1. Reads `?token=<jwt>` from the URL query params.
2. Calls `ssoLogin(token)` from `AuthContext` to store it in `localStorage`.
3. Navigates to `/dashboard`.
4. Shows an error if no token is present.

---

#### [MODIFY] [Login.jsx](file:///home/abishek/zenocare/assets/asset-frontend/src/pages/Login.jsx)

- **Remove** the `handleSsoClick` redirect to `localhost:8081` (direct browser navigate).
- **Change** it to redirect via the Vite proxy: `window.location.href = '/oauth2/authorization/directory'` — this gets proxied to Asset Backend `:8081`.

---

#### [MODIFY] [vite.config.js](file:///home/abishek/zenocare/assets/asset-frontend/vite.config.js)

No changes needed — the existing proxy rules already forward `/oauth2` and `/login/oauth2` to `localhost:8081`.

---

## Verification Plan

### Manual Testing (end-to-end)

1. **Start all three services:**
   - Directory Backend: `cd /home/abishek/zenocare/directory/zenohosp && ./mvnw spring-boot:run` (port 9000)
   - Asset Backend: `cd /home/abishek/zenocare/assets/asset-manager && ./mvnw spring-boot:run` (port 8081)
   - Asset Frontend: `cd /home/abishek/zenocare/assets/asset-frontend && npm run dev` (port 3001)

2. **Test SSO flow:**
   - Open `http://localhost:3001/login` in a browser.
   - Click **"Sign in with ZenoHosp Directory"**.
   - Verify you are redirected to `localhost:9000/oauth2/authorize?...` and see the Directory login page.
   - Enter valid credentials (email + password of a seeded user).
   - Verify you are redirected back through `localhost:8081/login/oauth2/code/directory` and then to `localhost:3001/sso/callback?token=<jwt>`.
   - Verify the JWT is stored in `localStorage` and you land on `/dashboard`.

3. **Test API access with JWT:**
   - After SSO login, verify that clicking on Assets/Transfers/Maintenance pages loads data (API calls carry the `Authorization: Bearer` header).

4. **Test invalid scenarios:**
   - Directly visit `http://localhost:3001/sso/callback` without a token parameter — should show error and redirect to login.
   - Try accessing `/api/assets` without a JWT — should get 401.

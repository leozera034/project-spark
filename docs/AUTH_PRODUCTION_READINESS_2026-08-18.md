# Auth production readiness — 2026-08-18

## Scope

This note records the production-readiness state of authentication for the clean external Supabase foundation (`ypgteuxzgqmkkkpvibhi`). It distinguishes controls already enforced in code from launch blockers that still depend on external Auth/email configuration.

## Verified and hardened

- Store-owner login uses Supabase Auth password login and then resolves the authorization context through `get_my_auth_context`.
- Redirect/return-path sanitization accepts only internal paths and rejects absolute/protocol-relative destinations.
- Password recovery redirects to the current application origin plus the internal reset-password route.
- Store signup now enforces one shared owner-password contract across the browser, TanStack Server Function and the external Edge gateway: 8–72 characters, at least one ASCII letter and at least one number.
- Public store signup is rate-limited in the Edge gateway by global windows, normalized e-mail, requested slug and, when supplied by the hosted edge, a hashed client IP. Raw IP addresses are not persisted as rate-limit keys.
- Courier accounts remain a separate internal flow with deterministic synthetic e-mail addresses and forced initial password rotation.
- The restricted Lovable server runtime does not hold a Supabase service-role/secret key; privileged account provisioning stays inside the external Supabase Edge Function.

## Confirmed launch blockers

### 1. Store-owner e-mail is not actually verified yet

The current public store onboarding provisions the Auth user through `admin.auth.admin.createUser` with `email_confirm: true`, then immediately signs the owner in. This keeps onboarding functional while outbound production e-mail is not configured, but it means the application currently trusts the submitted owner e-mail without proving control of that mailbox.

**Required before commercial launch:** move store-owner onboarding to an e-mail-verification-capable flow and only treat the owner e-mail as verified after the Supabase verification step succeeds. Do not change this flag until reliable outbound e-mail is configured, otherwise new owners can become unable to activate their accounts.

### 2. Custom production SMTP is not configured for the Pediu Aqui brand

Password recovery depends on Supabase Auth outbound e-mail. A production sender/domain dedicated to Pediu Aqui is still required before recovery and verification can be considered production-ready.

The currently connected e-mail infrastructure must not be reused automatically from an unrelated brand solely to unblock this step.

### 3. CAPTCHA is not implemented in the application

No hCaptcha/Turnstile/CAPTCHA integration or token handling is present in the repository. Application-level rate limiting is active, but CAPTCHA remains a separate abuse-control requirement for the public signup/login/recovery surface.

### 4. Hosted Auth URL/redirect allowlist has not been independently verified

The application code produces an internal reset route under the current origin, but the installed Supabase connector does not expose the hosted Auth URL/redirect configuration for inspection or mutation. The production site URL and allowed redirect URLs must be checked when the final public domain is known.

### 5. GitHub Actions is not currently providing a trustworthy automated gate

The first disposable production-foundation E2E PR created a Quality Gate run whose jobs terminated before executing workflow steps, and the latest `main` commit has no recorded combined-status checks. Until Actions runner/account/repository execution is restored, releases need independent verification and cannot rely on GitHub CI status alone.

## Current decision

**Auth production readiness: APROVADA COM RESSALVAS for continued development/testing; NOT READY for unrestricted commercial self-service signup.**

The safe order is:

1. establish a Pediu Aqui production domain/sender;
2. configure custom SMTP and verify delivery;
3. implement real owner e-mail confirmation without breaking provisioning;
4. configure and test production Auth site/redirect URLs;
5. add CAPTCHA to public auth entry points;
6. run signup → confirmation → login → recovery → password reset E2E;
7. restore a reliable GitHub Actions release gate.

# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/). The in-app release notes (`/release-notes`) are the teacher-facing version of this file.

## [Unreleased]
### Added
- Private source repository, engineering README, `.env.example`, `.gitleaks.toml`.
- CI workflow: install from lockfile, typecheck, production build, secret scan, dependency audit.
- `docs/AUDIT.md`: Milestone 0 engineering audit.
### Changed
- `package.json` version aligned with the product version (1.5.3).
- The previous README (teacher setup guide) moved to `docs/USER_GUIDE.md`.

## [1.5.3] — 2026-11-14
### Changed
- Sign-in and sign-up run in the student's browser, so each device uses its own auth rate-limit allowance instead of sharing the server's.

## [1.5.2] — 2026-11-14
### Added
- Sign-in/sign-up queue that retries automatically with jittered backoff and shows a countdown when auth is busy.
- Separate message when the project-wide email limit is reached.

## [1.5.1] and earlier
See `/release-notes` in the app.

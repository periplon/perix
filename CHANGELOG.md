# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive test suite with Jest framework
- GitHub Actions CI/CD pipelines
  - Automated testing on multiple Node.js versions
  - Security scanning with npm audit and CodeQL
  - Automated release workflow
- Test coverage reporting with 80% minimum thresholds
- ESLint configuration for code quality
- Development documentation in README

### Changed
- Updated .gitignore to exclude coverage reports
- Enhanced README with CI/CD badges and testing instructions

## [1.0.0] - 2024-01-14

### Added
- Initial implementation of browser automation Chrome extension
- WebSocket server connection for remote control
- Tab management commands (list, create, close, activate, reload)
- Navigation commands (navigate, go back, go forward)
- Content interaction (click, type, scroll)
- Content extraction (extract text, find elements)
- Screen capture (screenshots, video recording)
- Cookie and localStorage management
- JavaScript execution in page context
- DOM observation and mutation tracking
- CSS injection and removal
- Element highlighting for debugging
- Popup UI for connection status monitoring
- Example WebSocket server implementation
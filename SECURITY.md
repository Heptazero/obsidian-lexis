# Security Policy

## Supported Versions

Lexis is a single-maintainer hobby project. Only the latest release is supported — please update before reporting an issue.

## Reporting a Vulnerability

If you find a security issue (especially anything related to the local bridge server), please **do not open a public Issue**. Instead use GitHub's private reporting:

[Report a vulnerability](https://github.com/Heptazero/obsidian-lexis/security/advisories/new)

I'll do my best to respond within a few days.

## Scope notes

- The optional browser-extension bridge listens **only on a loopback port** you configure in settings, and requires **token auth**. It is started on desktop only and is skipped entirely if the browser extension feature isn't used.
- Lexis stores all vocabulary data as plain Markdown notes inside your own vault; nothing is sent to any external server.

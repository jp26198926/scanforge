---
name: GitHub connector writes
description: Constraints encountered when publishing a workspace through the Replit-managed GitHub connector.
---

Write-heavy GitHub API operations can trigger temporary Cloudflare protection in the connector even when reads continue to work. Single-file writes may succeed briefly, then return HTML 403 responses for later writes.

**Why:** The connector has its own request-rate and abuse protections in addition to GitHub’s API limits, so a technically valid bulk commit can still fail mid-upload.

**How to apply:** Before publishing, inspect the target repository and keep uploads resumable. Prefer a local git push or a supported single-commit path when available; if using Contents API uploads, throttle aggressively and verify the remote tree after every batch. Never claim a complete push unless the branch tree has been checked.
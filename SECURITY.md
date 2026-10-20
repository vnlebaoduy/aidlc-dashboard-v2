# Security policy

## Supported versions

The latest release is supported. Fixes land on `main` and are published as a new
release; there are no long-lived maintenance branches.

## Reporting a vulnerability

Report privately through GitHub:
<https://github.com/vnlebaoduy/aidlc-dashboard-v2/security/advisories/new>

Do not open a public issue for a vulnerability. Please include:

- what an attacker can do, and what they need to start (a page they control, a
  malicious workspace, a file in the record, network access);
- the affected route or component and the version (`/api/meta`);
- the smallest reproduction you have, with private workspace text removed.

You can expect an acknowledgement, an assessment of severity, and a fix or a
documented refusal with the reasoning. Credit is offered in the release notes unless
you prefer to stay anonymous.

## What counts as a vulnerability

- Bypassing the `Host` guard (DNS rebinding) or the cross-site guard on `/select`,
  `/open` and `/api/refresh`.
- Escaping the record jail: reading a file outside the active record through
  `/api/view`, or launching an arbitrary program through `/open` (including via a
  symlink).
- Rendering workspace text as markup, or a Markdown/Mermaid path that makes the
  dashboard fetch a remote resource or execute script.
- Writing to a workspace, or leaking workspace contents to a third party.

## What does not count

- The server having no authentication. It binds loopback by design; `--host` and
  `--allow-host` expose it deliberately. If you need access control, put it behind a
  reverse proxy you trust.
- Information shown on the dashboard to someone who already has local access to the
  machine or the workspace files.
- Denial of service by pointing the server at an enormous workspace on your own
  machine.

## Handling in this repository

The client never uses `dangerouslySetInnerHTML`; Markdown is rendered through an
allowlist, Mermaid runs with strict security and is displayed as an inert image, and
artifact paths are resolved and jailed before any read or launch. Changes touching
those boundaries are reviewed with that threat model in mind.

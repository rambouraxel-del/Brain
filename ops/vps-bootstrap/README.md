# VPS bootstrap mirror (installation only)

These scripts mirror the server setup files from the private `VPS-auto` repository and contain no secrets. They are published in Brain to enable first-time VPS setup from a mobile browser without private Git credentials.

**Only execute after reviewing the scripts.** This is an installation snapshot, not an automatically synchronized administrative tool. Future changes in `VPS-auto` will not silently modify root-owned files on the VPS.

The project intentionally does not install SSH admin keys or change Caddy, DNS, or existing containers.

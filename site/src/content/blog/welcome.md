---
title: "VNE is live — phase 2 ships"
description: "VNE — the network configuration engine — is now an active phase of the velocitee pipeline. OPNsense VMs, VLANs, DHCP, DNS, and firewall, all from one config file."
pubDate: 2026-04-28
author: "Finley Karras"
tags: ["release", "vne", "phase-2"]
---

VNE is live. Phase 2 of the velocitee pipeline now ships in [velocit-ee/core](https://github.com/velocit-ee/core) — read the [getting-started guide](https://docs.velocit.ee/vne/getting-started/) for the full walkthrough.

## What VNE actually does

You hand it the manifest VME wrote, and a `velocitee.yml` describing your
desired network — VLANs, DHCP scopes, DNS forwarders, firewall rules. VNE
takes care of the rest:

- Creates the OPNsense VM on Proxmox.
- Renders a first-boot `config.xml` so the API is reachable before VNE
  even tries to connect.
- Configures VLANs, DHCP scopes, Unbound DNS, and firewall rules — each
  step idempotent and live-probed.
- Runs four verification checks. Refuses to write its handoff manifest
  unless every one passes.

Two backends ship today: `velocitee-native` (pure Python, our reference
implementation) and `opentofu+ansible` (Terraform-managed infra +
Ansible-driven config, with a hard phase gate between the two). Eleven
more backends are reserved as registered stubs — adding any of them is one
Renderer subclass and one registry entry.

## What's next

VSE — the services engine — is up next. We're starting with a "school IT"
preset (Nextcloud + LDAP + monitoring as a starter bundle), because that's
the workload our first deployments need.

[Join the waitlist](/) if you want one email when VSE alpha drops.

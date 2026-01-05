# Shuttle v1.0.0

Shuttle is a CLI tool and library for peer-to-peer file and directory transfer using WebRTC and short-lived IDs. It supports live synchronization, controlled bidirectional changes, and automatic acceptance of updates.

It is designed for fast bootstrapping, temporary collaboration, and secure transfers without relying on a file server.

---

## Concepts

- push: exposes files or directories and generates an ID
- pull: connects using the ID and receives data
- server: signaling only, never transfers payloads
- WebRTC: direct peer-to-peer tunnel

---

## Installation

npm install -g shuttle

Or locally:

npm install

---

## Signaling server

The signaling server is required only to establish the peer connection.

node server.js

By default it runs on http://localhost:3000

---

## Basic usage

### Send files

shuttle push .

Output:

ID: G1946C

### Receive files

shuttle pull G1946C

Files are written to the current directory.

---

## Live mode

Keeps the connection open and streams file changes.

### Push (one-way)

shuttle push . --live

### Pull (receives updates)

shuttle pull G1946C --live

---

## Change proposals

The pull side never modifies the push side directly. All modifications are sent as proposals.

### Allow change proposals

shuttle push . --live --allow-changes

### Auto-accept proposals

shuttle push . --live --allow-changes --auto-accept

With auto-accept enabled, changes proposed by pull are immediately applied on push.

Without auto-accept, proposals are received but ignored.

---

## Flags

push:
- --live keeps synchronization active
- --allow-changes allows proposals from pull
- --auto-accept automatically applies proposals

pull:
- --live continuously proposes local changes

---

## Security guarantees

- The signaling server never sees files
- All data flows directly via WebRTC
- Push is always authoritative
- No changes are applied without explicit permission

---

## Project structure

- server.js signaling server
- shuttle.js WebRTC core
- cli.js CLI interface
- example-push.js simple push example
- example-pull.js simple pull example

---

## Requirements

- Node.js 18 or newer
- UDP connectivity enabled for STUN

---

## Status

Stable and ready for production use

---

## License

ISC

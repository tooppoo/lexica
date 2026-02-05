---
name: coding
description: Implement TypeScript using a strict UI→application→core layering and parse‑don’t‑validate practices.
---

# coding (TypeScript)

## Goal

Implement TypeScript following a strict layered architecture and parse-don't-validate principles.

## Core Rules

- Use parse, don't validate. Prefer parsing primitives into domain types.
- Use `Result` from `src/core/result.ts` for parse outcomes; do not define new Result types.
- Core layer uses only parsed, safe domain types from `src/core/types.ts`.
- Application layer receives primitives, parses to core types, then calls core logic.
- UI layer handles CLI args and terminal I/O only.

## Layer Placement

- Core: `src/core/**`
- Application: `src/application/**`
- UI: `src/ui/**`

## Dependency Direction (strict)

- UI -> Application -> Core
- Forbidden: Core -> Application, Core -> UI, Application -> UI

## Implementation Guidelines

1. Identify the boundary where primitives enter. That boundary must be in Application or UI, not Core.
2. Create/extend parse functions that convert primitives to core types, returning `Result`.
3. Core functions accept only domain types from `src/core/types.ts` and return domain types or `Result`.
4. Application orchestrates parse + core call; no terminal I/O.
5. UI performs CLI parsing, formatting, and printing; no core logic.

## Checkpoints

- No primitives used in core function signatures.
- All parsing uses `Result` from `src/core/result.ts`.
- File locations match layer rules.
- Imports respect the dependency direction.

## Post-Implementation

- After implementation, always run `bun compile:dev`.
- If `bun compile:dev` fails, fix the implementation based on the error output and rerun until it passes.

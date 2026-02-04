# Blitz Orchestrator

Parallel task orchestration harness for document-to-spec-to-task pipelines, with human review at every handoff and live execution telemetry.

## Setup

```bash
bun install
cp .env.local.example .env.local
bun dev
```

Open `http://localhost:3000`.

## Pipeline Flow

1. Upload a project document
2. Generate and review spec
3. Generate and review tasks
4. Run orchestration with parallel agents

## Environment Variables

```bash
# Required (AI SDK via OpenRouter)
OPENROUTER_API_KEY=your_api_key_here
BLITZ_MODEL=anthropic/claude-sonnet-4.5

# Optional tuning
BLITZ_MAX_PARALLEL=3
BLITZ_DATA_DIR=./data
BLITZ_USE_DOCKER=false
BLITZ_DRY_RUN=false
```

## Notes

- Runtime state lives in `data/` (spec, tasks, logs, context).
- The orchestrator never commits by default. If you want commits, wire them in explicitly.
- Tasks are immutable during runs; edits should happen before approval.

## Logging

```bash
tail -f data/logs/system.log
```

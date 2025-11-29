# grove-domain-search

> AI-powered asynchronous domain availability checker that reduces domain hunting from weeks to hours.

## Overview

A tool for aggressively finding domain names for clients. Used in GroveEngine for client onboarding.

**Key features:**
- Parallel AI agents generate and evaluate domain candidates
- RDAP-based availability checking (no API keys needed)  
- Runs asynchronously via Cloudflare Durable Objects
- Produces 25+ vetted, affordable domain options

## Quick Start

```bash
# Install with UV
uv pip install -e .

# Check a single domain
grove-domain-search check example.com

# Check multiple domains
grove-domain-search check domains.txt --json
```

## Architecture

See [SPEC.md](docs/SPEC.md) for full details.

```
Quiz → Durable Object → AI Agents → RDAP Checker → Results → Email
```

## Development

```bash
# Install dev dependencies
uv pip install -e ".[dev]"

# Run tests
pytest

# Format code
ruff format src tests
```

## License

MIT — see [LICENSE](LICENSE)

---

*Part of the Grove ecosystem. Built by [@autumnsgrove](https://github.com/autumnsgrove)*

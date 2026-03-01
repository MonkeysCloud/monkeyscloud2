# MonkeysCloud CI/CD Engine

This directory contains the custom CI/CD pipeline engine for MonkeysCloud.

## Components (Phase 6)

| Component                | Purpose                                                  |
| ------------------------ | -------------------------------------------------------- |
| `PipelineParser.php`     | Reads `.monkeyscloud.yml` from customer repos            |
| `BuildOrchestrator.php`  | Manages build stages (clone, install, test, build image) |
| `BuildRunner.php`        | Executes steps in isolated Docker containers             |
| `DeployOrchestrator.php` | Rolling, blue-green, canary deploy strategies            |
| `ArtifactManager.php`    | Pushes images to registry                                |
| `LogStreamer.php`        | Real-time build log streaming (SSE/WebSocket)            |

## Customer Config

See `.monkeyscloud.yml.template` for the customer-facing pipeline config format.

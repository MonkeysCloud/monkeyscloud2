# MonkeysCloud Mobile App

> Cross-platform mobile app built with **Flutter** + **Riverpod** state management.

## Setup (Phase 4)

```bash
flutter create --org cloud.monkeys --project-name monkeyscloud mobile
```

## Key Screens

| Screen           | Feature                          |
| ---------------- | -------------------------------- |
| Login / Register | Auth + 2FA + OAuth               |
| Projects         | List projects, status badges     |
| Project Detail   | Builds, deploys, quick actions   |
| Git Activity     | Commits, PR list                 |
| PR Detail        | Simplified diff, approve/comment |
| Task Board       | Kanban drag-and-drop             |
| Task Detail      | Edit, comment, time tracking     |
| Notifications    | Push + in-app                    |
| MonkeysAI Chat   | AI assistant                     |
| Build Logs       | Real-time streaming              |

## Architecture

- **State**: Riverpod (type-safe, no BuildContext dependency)
- **HTTP Client**: Dio
- **Navigation**: go_router
- **Local Storage**: shared_preferences + flutter_secure_storage

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:monkeyscloud/providers/auth_provider.dart';
import 'package:monkeyscloud/screens/auth/login_screen.dart';
import 'package:monkeyscloud/screens/auth/register_screen.dart';
import 'package:monkeyscloud/screens/home/home_shell.dart';
import 'package:monkeyscloud/screens/home/overview_screen.dart';
import 'package:monkeyscloud/screens/projects/projects_screen.dart';
import 'package:monkeyscloud/screens/projects/project_detail_screen.dart';
import 'package:monkeyscloud/screens/builds/builds_screen.dart';
import 'package:monkeyscloud/screens/builds/build_detail_screen.dart';
import 'package:monkeyscloud/screens/git/git_screen.dart';
import 'package:monkeyscloud/screens/git/pr_detail_screen.dart';
import 'package:monkeyscloud/screens/tasks/tasks_screen.dart';
import 'package:monkeyscloud/screens/tasks/task_detail_screen.dart';
import 'package:monkeyscloud/screens/ai/ai_chat_screen.dart';
import 'package:monkeyscloud/screens/settings/settings_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final isAuth = authState.isAuthenticated;
      final isAuthRoute = state.matchedLocation.startsWith('/login') ||
                          state.matchedLocation.startsWith('/register');

      if (!isAuth && !isAuthRoute) return '/login';
      if (isAuth && isAuthRoute) return '/';
      return null;
    },
    routes: [
      // Auth routes
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),

      // Main app shell with bottom nav
      ShellRoute(
        builder: (_, state, child) => HomeShell(child: child),
        routes: [
          GoRoute(path: '/', builder: (_, __) => const OverviewScreen()),
          GoRoute(path: '/projects', builder: (_, __) => const ProjectsScreen()),
          GoRoute(
            path: '/projects/:id',
            builder: (_, state) => ProjectDetailScreen(
              projectId: int.parse(state.pathParameters['id']!),
            ),
          ),
          GoRoute(path: '/builds', builder: (_, __) => const BuildsScreen()),
          GoRoute(
            path: '/builds/:id',
            builder: (_, state) => BuildDetailScreen(
              buildId: int.parse(state.pathParameters['id']!),
            ),
          ),
          GoRoute(path: '/git', builder: (_, __) => const GitScreen()),
          GoRoute(
            path: '/git/pr/:id',
            builder: (_, state) => PrDetailScreen(
              prId: int.parse(state.pathParameters['id']!),
            ),
          ),
          GoRoute(path: '/tasks', builder: (_, __) => const TasksScreen()),
          GoRoute(
            path: '/tasks/:id',
            builder: (_, state) => TaskDetailScreen(
              taskId: int.parse(state.pathParameters['id']!),
            ),
          ),
          GoRoute(path: '/ai', builder: (_, __) => const AiChatScreen()),
          GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
        ],
      ),
    ],
  );
});

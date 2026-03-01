import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:monkeyscloud/core/theme.dart';

class HomeShell extends StatelessWidget {
  final Widget child;
  const HomeShell({super.key, required this.child});

  static int _indexOf(String location) {
    if (location.startsWith('/projects')) return 1;
    if (location.startsWith('/builds')) return 2;
    if (location.startsWith('/tasks')) return 3;
    if (location.startsWith('/settings') || location.startsWith('/ai')) return 4;
    return 0; // overview
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final index = _indexOf(location);

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) {
          switch (i) {
            case 0: context.go('/');
            case 1: context.go('/projects');
            case 2: context.go('/builds');
            case 3: context.go('/tasks');
            case 4: context.go('/settings');
          }
        },
        backgroundColor: AppColors.surface900,
        indicatorColor: AppColors.brand600.withOpacity(0.3),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.folder_outlined), selectedIcon: Icon(Icons.folder), label: 'Projects'),
          NavigationDestination(icon: Icon(Icons.play_circle_outline), selectedIcon: Icon(Icons.play_circle), label: 'Builds'),
          NavigationDestination(icon: Icon(Icons.check_circle_outline), selectedIcon: Icon(Icons.check_circle), label: 'Tasks'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings), label: 'More'),
        ],
      ),
    );
  }
}

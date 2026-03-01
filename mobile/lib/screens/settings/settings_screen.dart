import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:monkeyscloud/core/theme.dart';
import 'package:monkeyscloud/providers/auth_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Profile
          Card(child: ListTile(
            leading: CircleAvatar(backgroundColor: AppColors.brand600, child: Text(auth.user?.name.substring(0, 1).toUpperCase() ?? '?', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
            title: Text(auth.user?.name ?? 'User'),
            subtitle: Text(auth.user?.email ?? '', style: TextStyle(color: AppColors.surface400)),
            trailing: const Icon(Icons.chevron_right),
          )),
          const SizedBox(height: 16),

          // Quick links
          _SettingsGroup(title: 'Platform', items: [
            _SettingsItem(icon: Icons.merge, label: 'Git Activity', onTap: () => context.go('/git')),
            _SettingsItem(icon: Icons.auto_awesome, label: 'MonkeysAI Chat', onTap: () => context.go('/ai')),
          ]),

          _SettingsGroup(title: 'Organization', items: [
            _SettingsItem(icon: Icons.people, label: 'Members', onTap: () {}),
            _SettingsItem(icon: Icons.credit_card, label: 'Billing', onTap: () {}),
            _SettingsItem(icon: Icons.notifications, label: 'Notifications', onTap: () {}),
          ]),

          _SettingsGroup(title: 'Account', items: [
            _SettingsItem(icon: Icons.security, label: 'Security', onTap: () {}),
            _SettingsItem(icon: Icons.info_outline, label: 'About', onTap: () {}),
          ]),

          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () => ref.read(authProvider.notifier).logout(),
            icon: const Icon(Icons.logout, color: AppColors.error),
            label: const Text('Log Out', style: TextStyle(color: AppColors.error)),
            style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.error), minimumSize: const Size(double.infinity, 50)),
          ),
          const SizedBox(height: 16),
          Center(child: Text('MonkeysCloud v1.0.0', style: TextStyle(color: AppColors.surface500, fontSize: 12))),
        ],
      ),
    );
  }
}

class _SettingsGroup extends StatelessWidget {
  final String title;
  final List<_SettingsItem> items;
  const _SettingsGroup({required this.title, required this.items});

  @override Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(title, style: TextStyle(color: AppColors.surface400, fontSize: 12, fontWeight: FontWeight.w600)),
      const SizedBox(height: 4),
      Card(child: Column(children: items.map((item) => ListTile(
        leading: Icon(item.icon, color: AppColors.surface300),
        title: Text(item.label),
        trailing: const Icon(Icons.chevron_right, color: AppColors.surface500),
        onTap: item.onTap,
      )).toList())),
      const SizedBox(height: 16),
    ],
  );
}

class _SettingsItem {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _SettingsItem({required this.icon, required this.label, required this.onTap});
}

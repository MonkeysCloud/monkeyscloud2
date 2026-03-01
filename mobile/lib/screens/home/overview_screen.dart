import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:monkeyscloud/core/theme.dart';
import 'package:monkeyscloud/providers/auth_provider.dart';

class OverviewScreen extends ConsumerWidget {
  const OverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Welcome card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppColors.brand700, AppColors.brand500]),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Welcome back, ${auth.user?.name ?? 'Developer'}!',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
                const SizedBox(height: 4),
                const Text('Here\'s your platform overview', style: TextStyle(color: Colors.white70)),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Quick stats
          const Text('Quick Stats', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _StatCard(icon: Icons.folder, label: 'Projects', value: '—', color: AppColors.brand400)),
            const SizedBox(width: 12),
            Expanded(child: _StatCard(icon: Icons.play_circle, label: 'Builds', value: '—', color: AppColors.success)),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _StatCard(icon: Icons.merge, label: 'PRs', value: '—', color: AppColors.info)),
            const SizedBox(width: 12),
            Expanded(child: _StatCard(icon: Icons.check_circle, label: 'Tasks', value: '—', color: AppColors.warning)),
          ]),
          const SizedBox(height: 20),

          const Text('Recent Activity', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          ...List.generate(5, (i) => Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: CircleAvatar(backgroundColor: AppColors.surface800, child: Icon(Icons.history, color: AppColors.surface400)),
              title: Text('Activity item ${i + 1}', style: const TextStyle(fontSize: 14)),
              subtitle: Text('Just now', style: TextStyle(color: AppColors.surface500, fontSize: 12)),
              trailing: const Icon(Icons.chevron_right, color: AppColors.surface500),
            ),
          )),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  const _StatCard({required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          Text(label, style: TextStyle(color: AppColors.surface400, fontSize: 13)),
        ],
      ),
    ),
  );
}

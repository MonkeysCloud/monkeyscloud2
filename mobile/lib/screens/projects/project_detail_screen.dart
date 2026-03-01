import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:monkeyscloud/core/theme.dart';
import 'package:monkeyscloud/providers/data_providers.dart';
import 'package:monkeyscloud/widgets/status_chip.dart';

class ProjectDetailScreen extends ConsumerWidget {
  final int projectId;
  const ProjectDetailScreen({super.key, required this.projectId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final project = ref.watch(projectProvider(projectId));
    final builds = ref.watch(buildsProvider(projectId));

    return Scaffold(
      appBar: AppBar(title: project.when(data: (p) => Text(p.name), loading: () => const Text('...'), error: (_, __) => const Text('Error'))),
      body: project.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (p) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Project info card
            Card(child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  StatusChip(status: p.status),
                  const SizedBox(width: 8),
                  if (p.stack != null) Chip(label: Text(p.stack!)),
                ]),
                const SizedBox(height: 12),
                Text('Repository', style: TextStyle(color: AppColors.surface400, fontSize: 12)),
                Text(p.repoUrl ?? 'Not connected', style: const TextStyle(fontSize: 14)),
              ]),
            )),
            const SizedBox(height: 16),

            // Action buttons
            Row(children: [
              Expanded(child: OutlinedButton.icon(onPressed: () {}, icon: const Icon(Icons.rocket_launch, size: 18), label: const Text('Deploy'))),
              const SizedBox(width: 12),
              Expanded(child: OutlinedButton.icon(onPressed: () {}, icon: const Icon(Icons.settings, size: 18), label: const Text('Settings'))),
            ]),
            const SizedBox(height: 20),

            // Recent builds
            const Text('Recent Builds', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            builds.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Text('Error: $e'),
              data: (list) => Column(
                children: list.take(5).map((b) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    onTap: () => context.push('/builds/${b.id}'),
                    leading: Icon(
                      b.status == 'passed' ? Icons.check_circle : b.status == 'running' ? Icons.play_circle : Icons.cancel,
                      color: b.status == 'passed' ? AppColors.success : b.status == 'running' ? AppColors.info : AppColors.error,
                    ),
                    title: Text('#${b.number} — ${b.branch}', style: const TextStyle(fontSize: 14)),
                    subtitle: Text(b.commitSha.substring(0, 7), style: TextStyle(fontFamily: 'monospace', color: AppColors.surface400, fontSize: 12)),
                    trailing: b.duration != null ? Text('${b.duration}s', style: TextStyle(color: AppColors.surface400)) : null,
                  ),
                )).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

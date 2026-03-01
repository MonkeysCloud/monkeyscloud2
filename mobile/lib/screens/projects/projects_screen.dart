import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:monkeyscloud/core/theme.dart';
import 'package:monkeyscloud/providers/auth_provider.dart';
import 'package:monkeyscloud/providers/data_providers.dart';
import 'package:monkeyscloud/widgets/status_chip.dart';

class ProjectsScreen extends ConsumerWidget {
  const ProjectsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orgId = ref.watch(authProvider).currentOrg?.id ?? 0;
    final projects = ref.watch(projectsProvider(orgId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Projects'),
        actions: [
          IconButton(icon: const Icon(Icons.add), onPressed: () {}),
        ],
      ),
      body: projects.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (list) => list.isEmpty
            ? const Center(child: Text('No projects yet', style: TextStyle(color: AppColors.surface400)))
            : ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: list.length,
                itemBuilder: (_, i) {
                  final p = list[i];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      onTap: () => context.push('/projects/${p.id}'),
                      leading: CircleAvatar(backgroundColor: AppColors.brand600.withOpacity(0.2), child: const Icon(Icons.folder, color: AppColors.brand400)),
                      title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(p.stack ?? 'Auto-detect', style: TextStyle(color: AppColors.surface400, fontSize: 12)),
                      trailing: StatusChip(status: p.status),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

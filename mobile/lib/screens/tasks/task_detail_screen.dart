import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:monkeyscloud/core/theme.dart';
import 'package:monkeyscloud/providers/data_providers.dart';
import 'package:monkeyscloud/widgets/status_chip.dart';

class TaskDetailScreen extends ConsumerWidget {
  final int taskId;
  const TaskDetailScreen({super.key, required this.taskId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final task = ref.watch(taskProvider(taskId));

    return Scaffold(
      appBar: AppBar(title: task.when(data: (t) => Text(t.title, maxLines: 1), loading: () => const Text('...'), error: (_, __) => const Text('Error'))),
      body: task.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (t) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [StatusChip(status: t.status), const SizedBox(width: 8), Chip(label: Text(t.priority)), const SizedBox(width: 8), Chip(label: Text(t.type))]),
                const SizedBox(height: 12),
                if (t.description != null) Text(t.description!, style: TextStyle(color: AppColors.surface300, height: 1.5)),
              ]),
            )),
            const SizedBox(height: 12),

            Card(child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _DetailRow(icon: Icons.person, label: 'Assignee', value: t.assigneeName ?? 'Unassigned'),
                if (t.dueDate != null) _DetailRow(icon: Icons.calendar_today, label: 'Due', value: t.dueDate.toString().substring(0, 10)),
              ]),
            )),
            const SizedBox(height: 16),

            const Text('Comments', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('No comments', style: TextStyle(color: AppColors.surface400)))),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon; final String label, value;
  const _DetailRow({required this.icon, required this.label, required this.value});
  @override Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(children: [
      Icon(icon, size: 18, color: AppColors.surface400),
      const SizedBox(width: 8),
      SizedBox(width: 80, child: Text(label, style: TextStyle(color: AppColors.surface400, fontSize: 13))),
      Text(value, style: const TextStyle(fontSize: 13)),
    ]),
  );
}

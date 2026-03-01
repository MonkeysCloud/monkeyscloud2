import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:monkeyscloud/core/theme.dart';
import 'package:monkeyscloud/providers/data_providers.dart';
import 'package:monkeyscloud/widgets/status_chip.dart';

class BuildDetailScreen extends ConsumerWidget {
  final int buildId;
  const BuildDetailScreen({super.key, required this.buildId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final build = ref.watch(buildProvider(buildId));

    return Scaffold(
      appBar: AppBar(title: build.when(data: (b) => Text('Build #${b.number}'), loading: () => const Text('...'), error: (_, __) => const Text('Error'))),
      body: build.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (b) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Status header
            Card(child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [StatusChip(status: b.status), const SizedBox(width: 8), Text(b.trigger, style: TextStyle(color: AppColors.surface400))]),
                const SizedBox(height: 12),
                _InfoRow(label: 'Branch', value: b.branch),
                _InfoRow(label: 'Commit', value: b.commitSha.substring(0, 7)),
                if (b.duration != null) _InfoRow(label: 'Duration', value: '${b.duration}s'),
              ]),
            )),
            const SizedBox(height: 16),

            // Actions
            Row(children: [
              if (b.status == 'failed') Expanded(child: ElevatedButton.icon(onPressed: () {}, icon: const Icon(Icons.refresh), label: const Text('Retry'))),
              if (b.status == 'running') Expanded(child: OutlinedButton.icon(onPressed: () {}, icon: const Icon(Icons.stop), label: const Text('Cancel'), style: OutlinedButton.styleFrom(foregroundColor: AppColors.error))),
            ]),
            const SizedBox(height: 16),

            // Log viewer placeholder
            const Text('Build Log', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.surface950, borderRadius: BorderRadius.circular(8), border: Border.all(color: AppColors.surface800)),
              child: const Text('Logs will stream here in real-time...', style: TextStyle(fontFamily: 'monospace', fontSize: 12, color: AppColors.surface400)),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label, value;
  const _InfoRow({required this.label, required this.value});
  @override Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Row(children: [
      SizedBox(width: 80, child: Text(label, style: TextStyle(color: AppColors.surface400, fontSize: 13))),
      Text(value, style: const TextStyle(fontFamily: 'monospace', fontSize: 13)),
    ]),
  );
}

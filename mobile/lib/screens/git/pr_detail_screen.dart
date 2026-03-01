import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:monkeyscloud/core/theme.dart';
import 'package:monkeyscloud/providers/data_providers.dart';
import 'package:monkeyscloud/widgets/status_chip.dart';

class PrDetailScreen extends ConsumerWidget {
  final int prId;
  const PrDetailScreen({super.key, required this.prId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pr = ref.watch(pullRequestProvider(prId));

    return Scaffold(
      appBar: AppBar(title: pr.when(data: (p) => Text(p.title, maxLines: 1, overflow: TextOverflow.ellipsis), loading: () => const Text('...'), error: (_, __) => const Text('Error'))),
      body: pr.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (p) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [StatusChip(status: p.status), const Spacer(), Text(p.authorName, style: TextStyle(color: AppColors.surface400))]),
                const SizedBox(height: 12),
                Text('${p.sourceBranch} → ${p.targetBranch}', style: const TextStyle(fontFamily: 'monospace', fontSize: 13)),
                const SizedBox(height: 8),
                Row(children: [
                  Text('+${p.additions}', style: const TextStyle(color: AppColors.success, fontFamily: 'monospace')),
                  const SizedBox(width: 12),
                  Text('-${p.deletions}', style: const TextStyle(color: AppColors.error, fontFamily: 'monospace')),
                ]),
              ]),
            )),
            const SizedBox(height: 16),

            Row(children: [
              Expanded(child: ElevatedButton.icon(onPressed: () {}, icon: const Icon(Icons.check), label: const Text('Approve'))),
              const SizedBox(width: 12),
              Expanded(child: ElevatedButton.icon(onPressed: () {}, icon: const Icon(Icons.merge), label: const Text('Merge'))),
            ]),
            const SizedBox(height: 16),

            const Text('Discussion', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('No comments yet', style: TextStyle(color: AppColors.surface400)))),
          ],
        ),
      ),
    );
  }
}

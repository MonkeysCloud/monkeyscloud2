import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:monkeyscloud/core/theme.dart';

class GitScreen extends ConsumerWidget {
  const GitScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Git Activity')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Open Pull Requests', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          // PRs will load from provider
          Center(child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(children: [
              Icon(Icons.merge, size: 48, color: AppColors.surface600),
              const SizedBox(height: 8),
              const Text('No open PRs', style: TextStyle(color: AppColors.surface400)),
            ]),
          )),
          const SizedBox(height: 20),
          const Text('Recent Commits', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Center(child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(children: [
              Icon(Icons.commit, size: 48, color: AppColors.surface600),
              const SizedBox(height: 8),
              const Text('No recent commits', style: TextStyle(color: AppColors.surface400)),
            ]),
          )),
        ],
      ),
    );
  }
}

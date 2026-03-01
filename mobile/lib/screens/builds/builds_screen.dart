import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:monkeyscloud/core/theme.dart';
import 'package:monkeyscloud/widgets/status_chip.dart';

class BuildsScreen extends ConsumerWidget {
  const BuildsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Placeholder — will load from provider
    return Scaffold(
      appBar: AppBar(title: const Text('Builds')),
      body: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: 0,
        itemBuilder: (_, i) => const SizedBox.shrink(),
      ),
    );
  }
}

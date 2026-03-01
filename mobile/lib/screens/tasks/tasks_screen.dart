import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:monkeyscloud/core/theme.dart';

class TasksScreen extends ConsumerWidget {
  const TasksScreen({super.key});

  static const _columns = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];
  static const _columnColors = [AppColors.surface500, AppColors.info, AppColors.warning, AppColors.brand400, AppColors.success];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tasks'),
        actions: [IconButton(icon: const Icon(Icons.add), onPressed: () {})],
      ),
      body: PageView.builder(
        itemCount: _columns.length,
        controller: PageController(viewportFraction: 0.85),
        itemBuilder: (_, i) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surface900,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                  border: Border.all(color: AppColors.surface800),
                ),
                child: Row(children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: _columnColors[i], shape: BoxShape.circle)),
                  const SizedBox(width: 8),
                  Text(_columns[i], style: const TextStyle(fontWeight: FontWeight.w600)),
                  const Spacer(),
                  Text('0', style: TextStyle(color: AppColors.surface400, fontSize: 13)),
                ]),
              ),
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.surface950,
                    borderRadius: const BorderRadius.vertical(bottom: Radius.circular(12)),
                    border: Border.all(color: AppColors.surface800),
                  ),
                  child: const Center(child: Text('No tasks', style: TextStyle(color: AppColors.surface500, fontSize: 13))),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:monkeyscloud/core/theme.dart';

class StatusChip extends StatelessWidget {
  final String status;
  const StatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final (color, icon) = _resolve(status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            _label(status),
            style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  (Color, IconData) _resolve(String s) => switch (s) {
    'active' || 'live' || 'passed' || 'merged' || 'done' || 'approved' => (AppColors.success, Icons.check_circle),
    'running' || 'building' || 'deploying' || 'in_progress' => (AppColors.info, Icons.play_circle),
    'queued' || 'pending' || 'open' || 'backlog' || 'todo' => (AppColors.warning, Icons.schedule),
    'failed' || 'rejected' || 'cancelled' || 'error' => (AppColors.error, Icons.cancel),
    'inactive' || 'draft' => (AppColors.surface500, Icons.circle_outlined),
    _ => (AppColors.surface400, Icons.help_outline),
  };

  String _label(String s) => s.replaceAll('_', ' ').split(' ').map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '').join(' ');
}

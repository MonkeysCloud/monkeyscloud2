import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:monkeyscloud/core/api_client.dart';
import 'package:monkeyscloud/models/user.dart';

// --- Projects ---
final projectsProvider = FutureProvider.family<List<Project>, int>((ref, orgId) async {
  final api = ref.read(apiClientProvider);
  final res = await api.get('/api/v1/organizations/$orgId/projects');
  return (res.data as List).map((j) => Project.fromJson(j)).toList();
});

final projectProvider = FutureProvider.family<Project, int>((ref, projectId) async {
  final api = ref.read(apiClientProvider);
  final res = await api.get('/api/v1/projects/$projectId');
  return Project.fromJson(res.data);
});

// --- Builds ---
final buildsProvider = FutureProvider.family<List<Build>, int>((ref, projectId) async {
  final api = ref.read(apiClientProvider);
  final res = await api.get('/api/v1/projects/$projectId/builds');
  return (res.data as List).map((j) => Build.fromJson(j)).toList();
});

final buildProvider = FutureProvider.family<Build, int>((ref, buildId) async {
  final api = ref.read(apiClientProvider);
  final res = await api.get('/api/v1/builds/$buildId');
  return Build.fromJson(res.data);
});

// --- Pull Requests ---
final pullRequestsProvider = FutureProvider.family<List<PullRequest>, int>((ref, projectId) async {
  final api = ref.read(apiClientProvider);
  final res = await api.get('/api/v1/projects/$projectId/pull-requests');
  return (res.data as List).map((j) => PullRequest.fromJson(j)).toList();
});

final pullRequestProvider = FutureProvider.family<PullRequest, int>((ref, prId) async {
  final api = ref.read(apiClientProvider);
  final res = await api.get('/api/v1/pull-requests/$prId');
  return PullRequest.fromJson(res.data);
});

// --- Tasks ---
final tasksProvider = FutureProvider.family<List<Task>, int>((ref, projectId) async {
  final api = ref.read(apiClientProvider);
  final res = await api.get('/api/v1/projects/$projectId/tasks');
  return (res.data as List).map((j) => Task.fromJson(j)).toList();
});

final taskProvider = FutureProvider.family<Task, int>((ref, taskId) async {
  final api = ref.read(apiClientProvider);
  final res = await api.get('/api/v1/tasks/$taskId');
  return Task.fromJson(res.data);
});

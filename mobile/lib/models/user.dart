class User {
  final int id;
  final String name;
  final String email;
  final String? avatarUrl;
  final DateTime createdAt;

  User({required this.id, required this.name, required this.email, this.avatarUrl, required this.createdAt});

  factory User.fromJson(Map<String, dynamic> json) => User(
    id: json['id'],
    name: json['name'],
    email: json['email'],
    avatarUrl: json['avatar_url'],
    createdAt: DateTime.parse(json['created_at']),
  );
}

class Organization {
  final int id;
  final String name;
  final String slug;
  final String? logoUrl;

  Organization({required this.id, required this.name, required this.slug, this.logoUrl});

  factory Organization.fromJson(Map<String, dynamic> json) => Organization(
    id: json['id'],
    name: json['name'],
    slug: json['slug'],
    logoUrl: json['logo_url'],
  );
}

class Project {
  final int id;
  final int organizationId;
  final String name;
  final String slug;
  final String? stack;
  final String status;
  final String? repoUrl;
  final DateTime createdAt;

  Project({
    required this.id, required this.organizationId, required this.name,
    required this.slug, this.stack, required this.status, this.repoUrl, required this.createdAt,
  });

  factory Project.fromJson(Map<String, dynamic> json) => Project(
    id: json['id'],
    organizationId: json['organization_id'],
    name: json['name'],
    slug: json['slug'],
    stack: json['stack'],
    status: json['status'],
    repoUrl: json['repo_url'],
    createdAt: DateTime.parse(json['created_at']),
  );
}

class Build {
  final int id;
  final int projectId;
  final int number;
  final String commitSha;
  final String branch;
  final String status;
  final String trigger;
  final int? duration;
  final String? imageUrl;
  final DateTime createdAt;

  Build({
    required this.id, required this.projectId, required this.number,
    required this.commitSha, required this.branch, required this.status,
    required this.trigger, this.duration, this.imageUrl, required this.createdAt,
  });

  factory Build.fromJson(Map<String, dynamic> json) => Build(
    id: json['id'],
    projectId: json['project_id'],
    number: json['number'],
    commitSha: json['commit_sha'],
    branch: json['branch'],
    status: json['status'],
    trigger: json['trigger'],
    duration: json['duration'],
    imageUrl: json['image_url'],
    createdAt: DateTime.parse(json['created_at']),
  );
}

class PullRequest {
  final int id;
  final int projectId;
  final String title;
  final String status;
  final String sourceBranch;
  final String targetBranch;
  final String authorName;
  final int additions;
  final int deletions;
  final DateTime createdAt;

  PullRequest({
    required this.id, required this.projectId, required this.title,
    required this.status, required this.sourceBranch, required this.targetBranch,
    required this.authorName, required this.additions, required this.deletions,
    required this.createdAt,
  });

  factory PullRequest.fromJson(Map<String, dynamic> json) => PullRequest(
    id: json['id'],
    projectId: json['project_id'],
    title: json['title'],
    status: json['status'],
    sourceBranch: json['source_branch'],
    targetBranch: json['target_branch'],
    authorName: json['author_name'],
    additions: json['additions'] ?? 0,
    deletions: json['deletions'] ?? 0,
    createdAt: DateTime.parse(json['created_at']),
  );
}

class Task {
  final int id;
  final int projectId;
  final String title;
  final String? description;
  final String status;
  final String priority;
  final String type;
  final String? assigneeName;
  final DateTime? dueDate;
  final DateTime createdAt;

  Task({
    required this.id, required this.projectId, required this.title,
    this.description, required this.status, required this.priority,
    required this.type, this.assigneeName, this.dueDate, required this.createdAt,
  });

  factory Task.fromJson(Map<String, dynamic> json) => Task(
    id: json['id'],
    projectId: json['project_id'],
    title: json['title'],
    description: json['description'],
    status: json['status'],
    priority: json['priority'],
    type: json['type'],
    assigneeName: json['assignee_name'],
    dueDate: json['due_date'] != null ? DateTime.parse(json['due_date']) : null,
    createdAt: DateTime.parse(json['created_at']),
  );
}

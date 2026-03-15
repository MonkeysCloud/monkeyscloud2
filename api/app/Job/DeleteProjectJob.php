<?php
declare(strict_types=1);

namespace App\Job;

/**
 * Queue job that cascades-deletes every entity related to a project
 * in batches so the database is never overloaded.
 *
 * Consumed via: php ml queue:work --queue=default
 *
 * Note: The queue worker instantiates this class with the payload
 * spread as constructor args: new DeleteProjectJob(projectId: X)
 * So the constructor must match the payload keys exactly.
 */
final class DeleteProjectJob
{
    /** Rows deleted per batch to avoid locking the DB */
    private const BATCH_SIZE = 200;

    public function __construct(private int $projectId)
    {
    }

    public function handle(): void
    {
        if ($this->projectId === 0) {
            error_log('DELETE_PROJECT_JOB: missing projectId');
            return;
        }

        // Build a PDO connection from env vars (the worker process
        // doesn't boot the full DI container)
        $pdo = new \PDO(
            sprintf(
                'pgsql:host=%s;port=%s;dbname=%s',
                getenv('DB_HOST') ?: 'postgres',
                getenv('DB_PORT') ?: '5432',
                getenv('DB_DATABASE') ?: 'monkeyscloud'
            ),
            getenv('DB_USERNAME') ?: getenv('DB_USER') ?: 'monkeyscloud',
            getenv('DB_PASSWORD') ?: getenv('DB_PASS') ?: ''
        );
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

        $projectId = $this->projectId;

        error_log("DELETE_PROJECT_JOB: starting deletion of project #{$projectId}");

        try {
            // -----------------------------------------------------------
            // 0) Delete the git repository on the git-server
            // -----------------------------------------------------------
            $this->deleteGitRepo($pdo, $projectId);

            // -----------------------------------------------------------
            // 1) Collect board IDs owned by this project
            //    (tasks, sprints, labels reference board_id, not project_id)
            // -----------------------------------------------------------
            $boardIds = $this->columnList($pdo, 'boards', 'id', 'project_id', $projectId);

            if ($boardIds) {
                $in = implode(',', $boardIds);

                // 1a) Task-related pivot / child tables
                $this->batchDeleteWhere($pdo, 'task_label_pivots', "task_id IN (SELECT id FROM tasks WHERE board_id IN ({$in}))");
                $this->batchDeleteWhere($pdo, 'task_custom_field_values', "task_id IN (SELECT id FROM tasks WHERE board_id IN ({$in}))");
                $this->batchDeleteWhere($pdo, 'task_comments', "task_id IN (SELECT id FROM tasks WHERE board_id IN ({$in}))");
                $this->batchDeleteWhere($pdo, 'time_entries', "task_id IN (SELECT id FROM tasks WHERE board_id IN ({$in}))");
                $this->batchDeleteWhere($pdo, 'attachments', "task_id IN (SELECT id FROM tasks WHERE board_id IN ({$in}))");

                // 1b) Tasks themselves
                $this->batchDeleteIn($pdo, 'tasks', 'board_id', $boardIds);

                // 1c) Sprints
                $this->batchDeleteIn($pdo, 'sprints', 'board_id', $boardIds);

                // 1d) Task labels (project-scoped via board)
                $this->batchDeleteIn($pdo, 'task_labels', 'board_id', $boardIds);

                // 1e) Board field configs
                $this->batchDeleteIn($pdo, 'board_field_configs', 'board_id', $boardIds);

                // 1f) Boards
                $this->batchDeleteIn($pdo, 'boards', 'id', $boardIds);
            }

            // -----------------------------------------------------------
            // 2) Environment-scoped children
            // -----------------------------------------------------------
            $envIds = $this->columnList($pdo, 'environments', 'id', 'project_id', $projectId);

            if ($envIds) {
                $this->batchDeleteIn($pdo, 'environment_variables', 'environment_id', $envIds);
                $this->batchDeleteIn($pdo, 'deployments', 'environment_id', $envIds);
                $this->batchDeleteIn($pdo, 'ssl_certificates', 'environment_id', $envIds);
            }

            // -----------------------------------------------------------
            // 3) Direct project_id children (order doesn't matter)
            // -----------------------------------------------------------
            $directTables = [
                'environments',
                'builds',
                'build_steps',
                'domains',
                'webhooks',
                'database_instances',
                'database_backups',
                'pull_requests',
                'pr_comments',
                'pr_reviews',
                'pr_activities',
                'commits',
                'branches',
                'repositories',
                'activity_logs',
                'ai_requests',
                'notifications',
            ];

            foreach ($directTables as $table) {
                $this->batchDelete($pdo, $table, 'project_id', $projectId);
            }

            // -----------------------------------------------------------
            // 4) Delete the project record itself
            // -----------------------------------------------------------
            $stmt = $pdo->prepare('DELETE FROM projects WHERE id = :id');
            $stmt->execute(['id' => $projectId]);

            error_log("DELETE_PROJECT_JOB: project #{$projectId} fully deleted");
        } catch (\Throwable $e) {
            error_log("DELETE_PROJECT_JOB ERROR: {$e->getMessage()}");
            throw $e; // re-throw so the queue marks it as failed and retries
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /** Return a flat list of int IDs from a table. */
    private function columnList(\PDO $pdo, string $table, string $col, string $fkCol, int $fkVal): array
    {
        try {
            $stmt = $pdo->prepare("SELECT {$col} FROM {$table} WHERE {$fkCol} = :fk");
            $stmt->execute(['fk' => $fkVal]);
            return array_map('intval', $stmt->fetchAll(\PDO::FETCH_COLUMN));
        } catch (\Throwable) {
            return []; // table might not exist yet
        }
    }

    /** Delete rows in batches by a single FK column = value. */
    private function batchDelete(\PDO $pdo, string $table, string $fkCol, int $fkVal): void
    {
        try {
            while (true) {
                $stmt = $pdo->prepare(
                    "DELETE FROM {$table} WHERE ctid IN (SELECT ctid FROM {$table} WHERE {$fkCol} = :fk LIMIT " . self::BATCH_SIZE . ")"
                );
                $stmt->execute(['fk' => $fkVal]);
                if ($stmt->rowCount() < self::BATCH_SIZE) {
                    break;
                }
                usleep(50_000); // 50 ms pause between batches
            }
        } catch (\Throwable $e) {
            // Table may not exist — log and continue
            error_log("DELETE_PROJECT_JOB: skip {$table} — {$e->getMessage()}");
        }
    }

    /** Delete rows whose FK column is in a given set of IDs. */
    private function batchDeleteIn(\PDO $pdo, string $table, string $fkCol, array $ids): void
    {
        if (empty($ids)) {
            return;
        }
        $in = implode(',', $ids);
        try {
            while (true) {
                $stmt = $pdo->prepare(
                    "DELETE FROM {$table} WHERE ctid IN (SELECT ctid FROM {$table} WHERE {$fkCol} IN ({$in}) LIMIT " . self::BATCH_SIZE . ")"
                );
                $stmt->execute();
                if ($stmt->rowCount() < self::BATCH_SIZE) {
                    break;
                }
                usleep(50_000);
            }
        } catch (\Throwable $e) {
            error_log("DELETE_PROJECT_JOB: skip {$table} — {$e->getMessage()}");
        }
    }

    /** Delete rows matching an arbitrary WHERE clause. */
    private function batchDeleteWhere(\PDO $pdo, string $table, string $where): void
    {
        try {
            while (true) {
                $stmt = $pdo->prepare(
                    "DELETE FROM {$table} WHERE ctid IN (SELECT ctid FROM {$table} WHERE {$where} LIMIT " . self::BATCH_SIZE . ")"
                );
                $stmt->execute();
                if ($stmt->rowCount() < self::BATCH_SIZE) {
                    break;
                }
                usleep(50_000);
            }
        } catch (\Throwable $e) {
            error_log("DELETE_PROJECT_JOB: skip {$table} — {$e->getMessage()}");
        }
    }

    /** Call the git-server DELETE API to remove the repo on disk. */
    private function deleteGitRepo(\PDO $pdo, int $projectId): void
    {
        try {
            // Get the project slug and organization slug
            $stmt = $pdo->prepare(
                'SELECT p.slug AS project_slug, o.slug AS org_slug
                 FROM projects p
                 JOIN organizations o ON o.id = p.organization_id
                 WHERE p.id = :id'
            );
            $stmt->execute(['id' => $projectId]);
            $row = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$row || empty($row['project_slug']) || empty($row['org_slug'])) {
                error_log("DELETE_PROJECT_JOB: cannot resolve org/project slugs for project #{$projectId}");
                return;
            }

            $orgSlug = $row['org_slug'];
            $projectSlug = $row['project_slug'];
            $gitServerUrl = rtrim(
                $_ENV['GIT_SERVER_URL'] ?? getenv('GIT_SERVER_URL') ?: 'http://git-server',
                '/'
            );

            $url = "{$gitServerUrl}/api/repos/{$orgSlug}/{$projectSlug}";
            error_log("DELETE_PROJECT_JOB: deleting git repo at {$url}");

            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_CUSTOMREQUEST  => 'DELETE',
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 30,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_HTTPHEADER     => ['Accept: application/json'],
            ]);
            $body = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr = curl_error($ch);
            curl_close($ch);

            if ($body === false || $httpCode === 0) {
                error_log("DELETE_PROJECT_JOB: git-server unreachable — {$curlErr}");
            } elseif ($httpCode >= 400) {
                error_log("DELETE_PROJECT_JOB: git-server returned HTTP {$httpCode} — {$body}");
            } else {
                error_log("DELETE_PROJECT_JOB: git repo deleted successfully ({$orgSlug}/{$projectSlug})");
            }
        } catch (\Throwable $e) {
            // Non-fatal: continue with DB cleanup even if git repo deletion fails
            error_log("DELETE_PROJECT_JOB: git repo deletion error — {$e->getMessage()}");
        }
    }
}


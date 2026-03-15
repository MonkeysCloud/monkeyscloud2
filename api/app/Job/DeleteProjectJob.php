<?php
declare(strict_types=1);

namespace App\Job;

use MonkeysLegion\Database\Contracts\ConnectionInterface;

/**
 * Queue job that cascades-deletes every entity related to a project
 * in batches so the database is never overloaded.
 *
 * Consumed via: php ml queue:work --queue=default
 */
final class DeleteProjectJob
{
    /** Rows deleted per batch to avoid locking the DB */
    private const BATCH_SIZE = 200;

    public function __construct(private ConnectionInterface $db)
    {
    }

    /**
     * @param array $payload {projectId: int}
     */
    public function handle(array $payload): void
    {
        $projectId = (int) ($payload['projectId'] ?? 0);
        if ($projectId === 0) {
            error_log('DELETE_PROJECT_JOB: missing projectId');
            return;
        }

        $pdo = $this->db->pdo();

        error_log("DELETE_PROJECT_JOB: starting deletion of project #{$projectId}");

        try {
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
}

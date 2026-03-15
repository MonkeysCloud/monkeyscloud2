package repository

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/rs/zerolog/log"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// ScaffoldViaK8sJob creates an ephemeral Kubernetes Job to run the scaffold
// command inside the stack's Docker image. The Job writes output to the shared
// git-repos PVC so the git-server can commit the files afterward.
func (m *Manager) ScaffoldViaK8sJob(org, project, dockerImage, scaffoldCmd, gitignore string) error {
	// Build in-cluster K8s client
	config, err := rest.InClusterConfig()
	if err != nil {
		return fmt.Errorf("k8s in-cluster config: %w", err)
	}
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("k8s clientset: %w", err)
	}

	namespace := os.Getenv("K8S_NAMESPACE")
	if namespace == "" {
		namespace = "monkeyscloud"
	}
	pvcName := os.Getenv("K8S_GIT_PVC")
	if pvcName == "" {
		pvcName = "git-repos-pvc"
	}

	// Output directory on the shared PVC
	outputRelPath := filepath.Join("_tmp", fmt.Sprintf("scaffold-%s-%s", org, project))
	outputAbsPath := filepath.Join(m.basePath, "_tmp", fmt.Sprintf("scaffold-%s-%s", org, project))

	// Clean up any previous scaffold attempt
	os.RemoveAll(outputAbsPath)
	os.MkdirAll(filepath.Join(m.basePath, "_tmp"), 0755)

	jobName := fmt.Sprintf("scaffold-%s-%s-%d", org, project, time.Now().Unix())
	if len(jobName) > 63 {
		jobName = jobName[:63]
	}

	// The scaffold command writes to /output, which is a subPath of the PVC
	fullCmd := fmt.Sprintf("mkdir -p /output && cd /output && %s", scaffoldCmd)

	backoffLimit := int32(0)
	ttlSeconds := int32(300)  // auto-cleanup after 5 min
	activeDeadline := int64(180) // timeout after 3 min

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      jobName,
			Namespace: namespace,
			Labels: map[string]string{
				"app":     "scaffold-job",
				"org":     org,
				"project": project,
			},
		},
		Spec: batchv1.JobSpec{
			BackoffLimit:            &backoffLimit,
			TTLSecondsAfterFinished: &ttlSeconds,
			ActiveDeadlineSeconds:   &activeDeadline,
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{
					RestartPolicy: corev1.RestartPolicyNever,
					Containers: []corev1.Container{
						{
							Name:    "scaffold",
							Image:   dockerImage,
							Command: []string{"sh", "-c", fullCmd},
							VolumeMounts: []corev1.VolumeMount{
								{
									Name:      "git-repos",
									MountPath: "/output",
									SubPath:   outputRelPath,
								},
							},
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("100m"),
									corev1.ResourceMemory: resource.MustParse("256Mi"),
								},
								Limits: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("1"),
									corev1.ResourceMemory: resource.MustParse("1Gi"),
								},
							},
						},
					},
					Volumes: []corev1.Volume{
						{
							Name: "git-repos",
							VolumeSource: corev1.VolumeSource{
								PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
									ClaimName: pvcName,
								},
							},
						},
					},
				},
			},
		},
	}

	log.Info().
		Str("job", jobName).
		Str("image", dockerImage).
		Str("org", org).
		Str("project", project).
		Msg("Creating K8s scaffold Job")

	ctx := context.Background()
	_, err = clientset.BatchV1().Jobs(namespace).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("create k8s job: %w", err)
	}

	// Poll for Job completion
	deadline := time.Now().Add(180 * time.Second)
	for time.Now().Before(deadline) {
		time.Sleep(3 * time.Second)

		j, err := clientset.BatchV1().Jobs(namespace).Get(ctx, jobName, metav1.GetOptions{})
		if err != nil {
			log.Warn().Err(err).Str("job", jobName).Msg("Failed to get Job status")
			continue
		}

		if j.Status.Succeeded > 0 {
			log.Info().Str("job", jobName).Msg("Scaffold Job completed successfully")

			// Write .gitignore if specified
			if gitignore != "" {
				ignPath := filepath.Join(outputAbsPath, ".gitignore")
				if wErr := os.WriteFile(ignPath, []byte(gitignore+"\n"), 0644); wErr != nil {
					log.Warn().Err(wErr).Msg("Failed to write .gitignore")
				}
			}

			// Commit the scaffold output to the bare repo
			repoPath := m.RepoPath(org, project)
			if err := m.commitFromDir(repoPath, outputAbsPath); err != nil {
				log.Error().Err(err).Msg("Failed to commit scaffold output")
				os.RemoveAll(outputAbsPath)
				return fmt.Errorf("commit scaffold: %w", err)
			}

			// Clean up temp output
			os.RemoveAll(outputAbsPath)
			return nil
		}

		if j.Status.Failed > 0 {
			log.Error().Str("job", jobName).Msg("Scaffold Job failed")
			os.RemoveAll(outputAbsPath)
			return fmt.Errorf("scaffold k8s job failed")
		}
	}

	// Timeout — clean up
	log.Error().Str("job", jobName).Msg("Scaffold Job timed out")
	_ = clientset.BatchV1().Jobs(namespace).Delete(ctx, jobName, metav1.DeleteOptions{})
	os.RemoveAll(outputAbsPath)
	return fmt.Errorf("scaffold k8s job timed out after 180s")
}

// commitFromDir takes all files in srcDir and commits them into the bare repo.
func (m *Manager) commitFromDir(bareRepoPath, srcDir string) error {
	tmpDir, err := os.MkdirTemp("", "mc-scaffold-commit-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	// Try cloning the bare repo (may fail if empty)
	cloneCmd := exec.Command("git", "clone", bareRepoPath, tmpDir)
	if _, cloneErr := cloneCmd.CombinedOutput(); cloneErr != nil {
		// Empty repo — init fresh
		initCmd := exec.Command("git", "init", "-b", "main", tmpDir)
		if out, err := initCmd.CombinedOutput(); err != nil {
			return fmt.Errorf("init: %s: %w", string(out), err)
		}
		addRemote := exec.Command("git", "-C", tmpDir, "remote", "add", "origin", bareRepoPath)
		addRemote.Run()
	}

	// Copy scaffold output into the working directory
	if err := copyDirContents(srcDir, tmpDir); err != nil {
		return fmt.Errorf("copy scaffold files: %w", err)
	}

	// Git add, commit, push
	gitEnv := append(os.Environ(),
		"GIT_AUTHOR_NAME=MonkeysCloud",
		"GIT_AUTHOR_EMAIL=platform@monkeys.cloud",
		"GIT_COMMITTER_NAME=MonkeysCloud",
		"GIT_COMMITTER_EMAIL=platform@monkeys.cloud",
	)

	steps := []struct {
		name string
		args []string
	}{
		{"add", []string{"git", "-C", tmpDir, "add", "-A"}},
		{"commit", []string{"git", "-C", tmpDir, "commit", "-m", "Initial scaffold",
			"--author", "MonkeysCloud <platform@monkeys.cloud>"}},
		{"push", []string{"git", "-C", tmpDir, "push", "origin", "HEAD:refs/heads/main", "--force"}},
	}

	for _, s := range steps {
		cmd := exec.Command(s.args[0], s.args[1:]...)
		cmd.Env = gitEnv
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("git %s: %s: %w", s.name, string(out), err)
		}
	}

	// Set HEAD to main in bare repo
	exec.Command("git", "-C", bareRepoPath, "symbolic-ref", "HEAD", "refs/heads/main").Run()

	log.Info().Str("repo", bareRepoPath).Msg("Scaffold files committed from K8s Job output")
	return nil
}

// copyDirContents recursively copies files from src to dst, skipping .git directories.
func copyDirContents(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.Name() == ".git" && info.IsDir() {
			return filepath.SkipDir
		}

		relPath, _ := filepath.Rel(src, path)
		if relPath == "." {
			return nil
		}
		dstPath := filepath.Join(dst, relPath)

		if info.IsDir() {
			return os.MkdirAll(dstPath, 0755)
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(dstPath, data, info.Mode())
	})
}

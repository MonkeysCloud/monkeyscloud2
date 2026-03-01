package grpc

import (
	"context"
	"fmt"

	"github.com/rs/zerolog/log"

	"github.com/monkeyscloud/git-server/internal/hooks"
	"github.com/monkeyscloud/git-server/internal/repository"
	pb "github.com/monkeyscloud/git-server/proto"
)

// GitServiceServer implements the gRPC GitService.
type GitServiceServer struct {
	pb.UnimplementedGitServiceServer
	repoMgr  *repository.Manager
	hookExec *hooks.Executor
}

// NewGitService creates a new gRPC Git service.
func NewGitService(repoMgr *repository.Manager, hookExec *hooks.Executor) *GitServiceServer {
	return &GitServiceServer{repoMgr: repoMgr, hookExec: hookExec}
}

// CreateRepository initializes a new bare repository.
func (s *GitServiceServer) CreateRepository(ctx context.Context, req *pb.CreateRepositoryRequest) (*pb.CreateRepositoryResponse, error) {
	if err := s.repoMgr.InitBare(req.Org, req.Project); err != nil {
		return &pb.CreateRepositoryResponse{Success: false, Message: err.Error()}, nil
	}
	log.Info().Str("org", req.Org).Str("project", req.Project).Msg("Repository created via gRPC")
	return &pb.CreateRepositoryResponse{Success: true, Message: "Repository created"}, nil
}

// DeleteRepository removes a repository.
func (s *GitServiceServer) DeleteRepository(ctx context.Context, req *pb.DeleteRepositoryRequest) (*pb.DeleteRepositoryResponse, error) {
	if err := s.repoMgr.Delete(req.Org, req.Project); err != nil {
		return &pb.DeleteRepositoryResponse{Success: false}, err
	}
	return &pb.DeleteRepositoryResponse{Success: true}, nil
}

// ListBranches returns all branches in a repository.
func (s *GitServiceServer) ListBranches(ctx context.Context, req *pb.ListBranchesRequest) (*pb.ListBranchesResponse, error) {
	branches, err := s.repoMgr.ListBranches(req.Org, req.Project)
	if err != nil {
		return nil, err
	}

	var pbBranches []*pb.BranchInfo
	for _, b := range branches {
		pbBranches = append(pbBranches, &pb.BranchInfo{
			Name:      b.Name,
			CommitSha: b.CommitSHA,
			IsDefault: b.IsDefault,
			UpdatedAt: b.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	return &pb.ListBranchesResponse{Branches: pbBranches}, nil
}

// ListCommits returns commits on a branch.
func (s *GitServiceServer) ListCommits(ctx context.Context, req *pb.ListCommitsRequest) (*pb.ListCommitsResponse, error) {
	limit := int(req.Limit)
	if limit == 0 {
		limit = 50
	}

	commits, err := s.repoMgr.ListCommits(req.Org, req.Project, req.Branch, limit, int(req.Offset))
	if err != nil {
		return nil, err
	}

	var pbCommits []*pb.CommitInfo
	for _, c := range commits {
		pbCommits = append(pbCommits, &pb.CommitInfo{
			Sha:          c.SHA,
			Message:      c.Message,
			AuthorName:   c.AuthorName,
			AuthorEmail:  c.AuthorEmail,
			CommittedAt:  c.CommittedAt.Format("2006-01-02T15:04:05Z"),
			FilesChanged: int32(c.FilesChanged),
			Additions:    int32(c.Additions),
			Deletions:    int32(c.Deletions),
		})
	}

	return &pb.ListCommitsResponse{Commits: pbCommits}, nil
}

// GetDiff returns the diff between two refs.
func (s *GitServiceServer) GetDiff(ctx context.Context, req *pb.GetDiffRequest) (*pb.GetDiffResponse, error) {
	diffOutput, err := s.repoMgr.Diff(req.Org, req.Project, req.Base, req.Head)
	if err != nil {
		return nil, err
	}

	return &pb.GetDiffResponse{Diff: diffOutput}, nil
}

// MergeBranches merges source into target branch.
func (s *GitServiceServer) MergeBranches(ctx context.Context, req *pb.MergeRequest) (*pb.MergeResponse, error) {
	result, err := s.repoMgr.Merge(req.Org, req.Project, req.SourceBranch, req.TargetBranch,
		req.Strategy, req.AuthorName, req.AuthorEmail)
	if err != nil {
		return nil, fmt.Errorf("merge failed: %w", err)
	}

	return &pb.MergeResponse{
		Success:   result.Success,
		MergeSha:  result.MergeSHA,
		Message:   result.Message,
		Conflicts: result.Conflicts,
	}, nil
}

// GetFileTree returns the directory listing at a ref.
func (s *GitServiceServer) GetFileTree(ctx context.Context, req *pb.FileTreeRequest) (*pb.FileTreeResponse, error) {
	entries, err := s.repoMgr.FileTree(req.Org, req.Project, req.Ref, req.Path)
	if err != nil {
		return nil, err
	}

	var pbEntries []*pb.FileEntry
	for _, e := range entries {
		pbEntries = append(pbEntries, &pb.FileEntry{
			Name: e.Name,
			Path: e.Path,
			Type: e.Type,
			Size: e.Size,
			Mode: e.Mode,
		})
	}

	return &pb.FileTreeResponse{Entries: pbEntries}, nil
}

// GetFileContent returns the content of a file at a ref.
func (s *GitServiceServer) GetFileContent(ctx context.Context, req *pb.FileContentRequest) (*pb.FileContentResponse, error) {
	content, err := s.repoMgr.FileContent(req.Org, req.Project, req.Ref, req.Path)
	if err != nil {
		return nil, err
	}

	return &pb.FileContentResponse{
		Content: content,
		Path:    req.Path,
		Size:    int64(len(content)),
	}, nil
}

// CreateBranch, DeleteBranch, GetCommit — stubs for now
func (s *GitServiceServer) CreateBranch(ctx context.Context, req *pb.CreateBranchRequest) (*pb.CreateBranchResponse, error) {
	return &pb.CreateBranchResponse{Success: false}, fmt.Errorf("not implemented")
}

func (s *GitServiceServer) DeleteBranch(ctx context.Context, req *pb.DeleteBranchRequest) (*pb.DeleteBranchResponse, error) {
	return &pb.DeleteBranchResponse{Success: false}, fmt.Errorf("not implemented")
}

func (s *GitServiceServer) GetCommit(ctx context.Context, req *pb.GetCommitRequest) (*pb.CommitDetail, error) {
	return nil, fmt.Errorf("not implemented")
}

import { IssueValidationResult } from './types/issue-validation-result.js';
import github from '@actions/github';

interface Comment {
  id: number;
  body?: string;
}

function getCommentMarker(issueKey: string): string {
  return `<!-- JIRA-ISSUES-VALIDATION-${issueKey} -->`;
}

function getOctokit() {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? '';
  const octokit = github.getOctokit(GITHUB_TOKEN);
  return octokit;
}

async function getPullRequestComments(prNumber: string): Promise<Comment[]> {
  const octokit = getOctokit();
  const { owner, repo } = github.context.repo;
  const response = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
    owner,
    repo,
    issue_number: parseInt(prNumber, 10)
  });
  return response.data satisfies Comment[];
}

async function createComment(prNumber: string, body: string): Promise<void> {
  const octokit = getOctokit();
  const { owner, repo } = github.context.repo;
  const response = await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
    owner,
    repo,
    issue_number: parseInt(prNumber, 10),
    body
  });
  if (response.status !== 201) {
    throw new Error(`Failed to create comment: ${response.status}`);
  }
}

async function updateComment(commentId: number, body: string): Promise<void> {
  const octokit = getOctokit();
  const { owner, repo } = github.context.repo;
  const response = await octokit.request('PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', {
    owner,
    repo,
    comment_id: commentId,
    body
  });
  if (response.status !== 200) {
    throw new Error(`Failed to update comment: ${response.status}`);
  }
}

function composeCommentBody(issueResult: IssueValidationResult): string {
  return `
    ${getCommentMarker(issueResult.issue.key)}
    ### ${issueResult.issue.typeName}: ${issueResult.issue.key} - ${issueResult.status} 
    - **Doporučení**:
        - Název: ${issueResult.recommendations.summary}
        - Popis:
        ${issueResult.recommendations.description}
    - **Návrh změn**:
        - Název: ${issueResult.suggestions.summary}
        - Popis:
        ${issueResult.suggestions.description}
    `;
}

async function syncCommentForPR(prNumber: string, issueResult: IssueValidationResult): Promise<void> {
  const comments = await getPullRequestComments(prNumber);
  const commentBody = await composeCommentBody(issueResult);
  const marker = getCommentMarker(issueResult.issue.key);

  const existingComment = comments.find((comment) => comment?.body?.includes(marker));

  if (existingComment) {
    await updateComment(existingComment.id, commentBody);
  } else {
    await createComment(prNumber, commentBody);
  }
}
export async function syncCommentsForPR(prNumber: string, issuesResults: IssueValidationResult[]): Promise<void> {
  Promise.all(
    issuesResults.map((issueResult) => {
      return syncCommentForPR(prNumber, issueResult);
    })
  );
}

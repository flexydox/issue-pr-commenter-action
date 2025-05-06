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
  const GITHUB_API_TOKEN = process.env.GITHUB_API_TOKEN ?? '';
  const GITHUB_API_BASE_URL = process.env.GITHUB_API_BASE_URL;
  const octokit = github.getOctokit(GITHUB_API_TOKEN, {
    baseUrl: GITHUB_API_BASE_URL
  });
  return octokit;
}

async function getPullRequestComments(prNumber: string): Promise<Comment[]> {
  const octokit = getOctokit();
  const { owner, repo } = github.context.repo;
  const response = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: parseInt(prNumber)
  });
  return response.data satisfies Comment[];
}

async function createComment(prNumber: string, body: string): Promise<void> {
  const octokit = getOctokit();
  const { owner, repo } = github.context.repo;
  const response = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: parseInt(prNumber),
    body
  });
  if (response.status !== 201) {
    throw new Error(`Failed to create comment: ${response.status}`);
  }
}

async function updateComment(prNumber: string, commentId: number, body: string): Promise<void> {
  const octokit = getOctokit();
  const { owner, repo } = github.context.repo;
  const response = await octokit.rest.issues.updateComment({
    owner,
    repo,
    comment_id: commentId,
    body
  });
  if (response.status !== 200) {
    throw new Error(`Failed to update comment: ${response.status}`);
  }
}

function composeCommentBody(prNumber: string, issueResult: IssueValidationResult): string {
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
  const commentBody = await composeCommentBody(prNumber, issueResult);
  const marker = getCommentMarker(issueResult.issue.key);

  const existingComment = comments.find((comment) => comment?.body?.includes(marker));

  if (existingComment) {
    await updateComment(prNumber, existingComment.id, commentBody);
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

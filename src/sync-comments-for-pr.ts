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

function statusToEmoji(status: string): string {
  switch (status) {
    case 'ok':
      return '✅';
    case 'warn':
      return '⚠️';
    case 'error':
      return '❌';
    default:
      return '❓';
  }
}

function composeRecommendationBody(issueResult: IssueValidationResult): string {
  if (!issueResult.recommendations.summary && !issueResult.recommendations.description) {
    return '';
  }
  return `
<details>
<summary>Doporučení</summary>

| Atribut | Doporučení | 
| ------ | ------------- | 
| Název | ${issueResult.recommendations.summary} |
| Popis | ${issueResult.recommendations.description} |
</details>
`;
}

function composeSuggestionBody(issueResult: IssueValidationResult): string {
  if (!issueResult.suggestions.summary && !issueResult.suggestions.description) {
    return '';
  }
  return `
<details>
<summary>Návrh změn</summary>

#### Název:

\`\`\`
${issueResult.suggestions.summary}
\`\`\`

#### Popis:

\`\`\`
${issueResult.suggestions.description}
\`\`\`
</details>
`;
}

function composeCommentBody(issueResult: IssueValidationResult): string {
  return `
${getCommentMarker(issueResult.issue.key)}
### ${statusToEmoji(issueResult.status)} Validace zadání issue ${issueResult.issue.key} (${issueResult.issue.typeName}) ${statusToEmoji(issueResult.status)}
${composeRecommendationBody(issueResult)}
${composeSuggestionBody(issueResult)}
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
  await Promise.all(
    issuesResults.map((issueResult) => {
      return syncCommentForPR(prNumber, issueResult);
    })
  );
}

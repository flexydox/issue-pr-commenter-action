import * as core from '@actions/core';
import { getIssues } from './jira-issue-info.js';
import { validateIssues } from './validate-issues.js';
import { syncCommentsForPR } from './sync-comments-for-pr.js';
/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const issuesString = process.env['INPUT_ISSUES'] ?? '';
    const prNumber = process.env['INPUT_PR_NUMBER'] ?? '';
    if (!prNumber) {
      core.info('PR number is not set, skipping validation.');
      return;
    }

    core.debug(`issues: ${issuesString}`);

    const issues = await getIssues(issuesString);
    const validationResults = await validateIssues(issues);
    core.debug(`validationResults: ${JSON.stringify(validationResults)}`);

    await syncCommentsForPR(prNumber, validationResults);

    core.debug('Issues validated successfully');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error');
    }
  }
}

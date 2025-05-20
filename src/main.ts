import * as core from '@actions/core';
import { getIssues } from './jira-issue-info.js';
import { validateIssues } from './validate-issues.js';
import { syncCommentsForPR } from './sync-comments-for-pr.js';
import { getPRInfo } from './get-pr-info.js';
/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const issuesString = process.env['INPUT_ISSUES'] ?? '';
    const prNumber = process.env['INPUT_PR-NUMBER'] ?? '';
    const prTitleRegex = process.env['INPUT_PR-TITLE-REGEX'] ?? '.*';
    const failWhenNoIssuesStr = process.env['INPUT_FAIL-WHEN-NO-ISSUES']?.toString() ?? 'false';
    const failWhenNoIssues = failWhenNoIssuesStr.toLowerCase() === 'true' || failWhenNoIssuesStr === '1';

    core.debug(`issuesString: ${issuesString}`);
    core.debug(`prNumber: ${prNumber}`);
    core.debug(`prTitleRegex: ${prTitleRegex}`);
    core.debug(`failWhenNoIssues: ${failWhenNoIssues}`);

    if (!prNumber) {
      core.info('PR number is not set, skipping validation.');
      return;
    }

    const prInfo = await getPRInfo(prNumber);
    core.debug(`PR title: ${prInfo.title}`);

    if (!prInfo) {
      core.setFailed('PR not found!');
      return;
    }
    if (prInfo.title && !new RegExp(prTitleRegex).test(prInfo.title)) {
      core.info(`PR title "${prInfo.title}" does not match regex "${prTitleRegex}", skipping validation.`);
      return;
    }

    if (!issuesString) {
      core.info('Issues string is not set, skipping validation.');
      if (failWhenNoIssues) {
        core.setFailed('No issues defined and failWhenNoIssues is set to true');
        return;
      }
      return;
    }

    const issues = await getIssues(issuesString);

    if (!issues || issues.length === 0) {
      core.info('No issues found, skipping validation.');
      if (failWhenNoIssues) {
        core.setFailed('No issues found and failWhenNoIssues is set to true');
      }
      return;
    }
    const validationResults = await validateIssues(issues);
    core.debug(`validationResults: ${JSON.stringify(validationResults)}`);

    await syncCommentsForPR(prNumber, validationResults);

    core.debug('Comments synced successfully');

    const failedIssues = validationResults.filter((result) => {
      if (result.status === 'error') {
        return true;
      }
      return false;
    });

    const failedIssuesMessage = failedIssues
      .map((issue) => {
        return issue.issue.key;
      })
      .join(', ');

    if (failedIssues.length > 0) {
      core.setFailed(`Validation failed for issues: ${failedIssuesMessage}`);
      return;
    }

    core.debug('Issues validated successfully');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error');
    }
  }
}

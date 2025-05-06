import type { IssueInfo } from './issue-info.js';

export interface IssueValidationResult {
  issue: IssueInfo;
  status: 'ok' | 'warn' | 'error';
  recommendations: {
    summary: string;
    description: string;
  };
  suggestions: {
    summary: string;
    description: string;
  };
}

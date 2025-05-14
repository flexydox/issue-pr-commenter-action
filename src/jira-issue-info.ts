import { adfToMarkdown } from './adf-to-markdown.js';
import { IssueInfo } from './types/issue-info.js';

export interface JiraIssue {
  id: string;
  key: string;
  issueTypeCode: string;
  fields: {
    summary: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    description: any;
    components: {
      name: string;
      description: string;
    }[];
    status: {
      name: string;
      statusCategory: {
        key: string;
        name: string;
        colorName: string;
      };
    };
    issuetype: {
      name: string;
      description: string;
      iconUrl: string;
      subtask: boolean;
    };
    parent: {
      key: string;
    };
    labels: string[];
  };
}

const issueTypeMapper: Record<string, string> = {
  Bug: 'bug',
  Story: 'story',
  Task: 'task',
  'Sub-task': 'subtask',
  Subtask: 'subtask',
  Epic: 'epic',
  Úkol: 'task',
  'Dílčí úkol': 'subtask',
  Chyba: 'bug',
  Scénář: 'story'
};

async function fetchJiraIssue(issueNumber: string): Promise<JiraIssue> {
  const ATLASSIAN_API_BASE_URL = process.env.ATLASSIAN_API_BASE_URL;
  const ATLASSIAN_API_USERNAME = process.env.ATLASSIAN_API_USERNAME;
  const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN;

  if (!ATLASSIAN_API_BASE_URL) {
    throw new Error('Missing Atlassian base URL');
  }
  if (!ATLASSIAN_API_USERNAME) {
    throw new Error('Missing Atlassian username');
  }
  if (!ATLASSIAN_API_TOKEN) {
    throw new Error('Missing Atlassian token');
  }

  const queryParams = new URLSearchParams({
    fields: 'summary,description,status,issuetype,status,labels,components,parent'
  });

  const url = `${ATLASSIAN_API_BASE_URL}/rest/api/3/issue/${issueNumber}?${queryParams.toString()}`;
  const response = await fetch(url, {
    method: 'GET',

    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${ATLASSIAN_API_USERNAME}:${ATLASSIAN_API_TOKEN}`)}`
    }
  });
  if (!response.ok) {
    throw new Error(`Error fetching issue ${issueNumber}: ${response.statusText}\n${url}`);
  }
  const jiraIssue = (await response.json()) as JiraIssue;
  return jiraIssue;
}

async function fetchIssue(issueNumber: string): Promise<IssueInfo> {
  let jiraIssue = await fetchJiraIssue(issueNumber);

  if (jiraIssue?.fields?.parent?.key && jiraIssue?.fields?.issuetype?.subtask) {
    console.log(`Fetching parent issue ${jiraIssue.fields.parent.key} for subtask ${issueNumber}`);
    jiraIssue = await fetchJiraIssue(jiraIssue.fields.parent.key);
  }

  const issueInfo: IssueInfo = {
    key: jiraIssue.key,
    type: issueTypeMapper[jiraIssue.fields.issuetype.name] ?? jiraIssue.fields.issuetype.name,
    typeName: jiraIssue.fields.issuetype.name,
    summary: jiraIssue.fields.summary,
    description: adfToMarkdown(jiraIssue.fields.description),
    status: jiraIssue.fields.status.name,
    statusCategory: {
      key: jiraIssue.fields.status.statusCategory.key,
      name: jiraIssue.fields.status.statusCategory.name,
      colorName: jiraIssue.fields.status.statusCategory.colorName
    },
    labels: jiraIssue.fields.labels,
    components: jiraIssue.fields.components.map((component) => component.name)
  };
  return issueInfo;
}

export async function getIssues(issuesString: string): Promise<IssueInfo[]> {
  const issuesNumbers = issuesString
    .split(',')
    .map((issue) => issue.trim())
    .filter((issue) => issue.trim() !== '');

  if (issuesNumbers.length === 0) {
    return [];
  }
  const issueInfos = await Promise.all(issuesNumbers.map((issueNumber) => fetchIssue(issueNumber)));

  return issueInfos;
}

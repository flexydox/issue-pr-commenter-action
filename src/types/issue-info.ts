export interface IssueInfo {
  key: string;
  type: string;
  typeName: string;
  summary: string;
  description: string;
  status: string;
  statusCategory: {
    key: string;
    name: string;
    colorName: string;
  };
  labels: string[];
  components: string[];
}

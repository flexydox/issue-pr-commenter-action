import { OpenAI } from 'openai';
import { IssueInfo } from './types/issue-info.js';
import { IssueValidationResult } from './types/issue-validation-result.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type IssueType = 'bug' | 'story' | 'task' | 'subtask' | 'epic' | string;

export async function validateIssue(
  type: IssueType,
  summary: string,
  description: string
): Promise<IssueValidationResult> {
  const devPrompt = `
Jsi nástroj na ověřování kvality Jira issue.
Zkontroluj zadání podle kritérií kvality.

Pravidla hodnocení podle typů issue:
- Bug: summary jasně popisuje problém; description obsahuje kroky k reprodukci, očekávané vs. skutečné chování, prostředí.
- Story: summary jasně definuje hodnotu pro uživatele; description poskytuje detailní kontext a akceptační kritéria.
- Task: summary je stručné a jasné; description obsahuje detaily a cíle úkolu.
- Subtask: summary je stručné a jasné; description obsahuje detaily úkolu.
- Epic: summary jasně definuje cíl epiku; description obsahuje detaily a cíle epiku.

Zkontroluj, zda je issue dobře popsáno a zda odpovídá danému typu. Pokud je issue v pořádku, vrať "ok". 
Pokud je issue špatně popsáno, vrať "warn" a doporučení k úpravě a návrh úpravy. Návrh úpravy by měl být konkrétní a
inferovaný z existujícího názvu a description.
Pokud je issue zcela nejasné nebo chybí důležité informace, vrať "error" a doporučení k úpravě a návrh úpravy. 
Pokud summary nebo description prázdné, vrať "error" a doporučení k úpravě a návrh úpravy.

Význam výstupních polí:
- recommendations: Slovní popis úpravy
- suggestions: Konkrétní úprava na základě existujících data a doporučení

Vrať odpověď v JSON formátu:
{
  "status": "ok" | "warn" | "error",
  "recommendations": {
    "summary": "doporučení úpravy nebo prázdný string",
    "description": "doporučení úpravy nebo prázdný string"
  }
  suggestions: {
    "summary": "návrh úpravy nebo prázdný string",
    "description": "návrh úpravy nebo prázdný string"
  }
}
`;

  const userPrompt = `
    - Typ issue: ${type}
    - Summary: ${summary}
    - Description: ${description}
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'developer', content: devPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0
  });

  const result = response.choices[0].message.content ?? '{}';

  return JSON.parse(result) as IssueValidationResult;
}

export async function validateIssues(issues: IssueInfo[]): Promise<IssueValidationResult[]> {
  if (issues.length === 0) {
    return [];
  }
  const results = await Promise.all(
    issues.map(async (issue) => {
      const { type, summary, description } = issue;
      const result = await validateIssue(type, summary, description);
      return {
        ...result,
        issue: issue
      } as IssueValidationResult;
    })
  );
  return results;
}

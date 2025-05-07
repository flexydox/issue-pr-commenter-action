// Type definitions for ADF nodes
type MarkType = 'strong' | 'em' | 'code' | 'link';

interface ADFNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ADFNode[];
  text?: string;
  marks?: { type: MarkType; attrs?: unknown }[];
}

export function adfToMarkdown(node: ADFNode): string {
  if (!node || typeof node !== 'object') return '';

  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(adfToMarkdown).join('\n\n');

    case 'paragraph':
      return (node.content ?? []).map(adfToMarkdown).join('');

    case 'text':
      return applyMarks(node.text ?? '', node.marks);

    case 'heading': {
      const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 1;
      const headingText = (node.content ?? []).map(adfToMarkdown).join('');
      return `${'#'.repeat(level)} ${headingText}`;
    }

    case 'bulletList':
      return (node.content ?? []).map((item) => '- ' + adfToMarkdown(item)).join('\n');

    case 'orderedList':
      return (node.content ?? []).map((item, i) => `${i + 1}. ${adfToMarkdown(item)}`).join('\n');

    case 'listItem':
      return (node.content ?? []).map(adfToMarkdown).join(' ');

    case 'hardBreak':
      return '  \n';

    case 'codeBlock': {
      const lang = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
      const code = (node.content ?? []).map((child) => child.text).join('');
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }

    case 'blockquote': {
      return (node.content ?? []).map((child) => '> ' + adfToMarkdown(child)).join('\n');
    }

    case 'rule':
      return '---';

    case 'link': {
      const href = typeof node.attrs?.href === 'string' ? node.attrs.href : '#';
      const linkText = (node.content ?? []).map(adfToMarkdown).join('') || href;
      return `[${linkText}](${href})`;
    }

    default:
      return ''; // Skip unsupported nodes
  }
}

function applyMarks(text: string, marks?: { type: MarkType; attrs?: unknown }[]): string {
  if (!marks) return text;

  for (const mark of marks) {
    switch (mark.type) {
      case 'code':
        text = '`' + text + '`';
        break;
      case 'strong':
        text = '**' + text + '**';
        break;
      case 'em':
        text = '*' + text + '*';
        break;
      case 'link': {
        const attrs = mark.attrs as Record<string, unknown> | undefined;
        const href = attrs && typeof attrs.href === 'string' ? attrs.href : '#';
        text = `[${text}](${href})`;
        break;
      }
    }
  }

  return text;
}

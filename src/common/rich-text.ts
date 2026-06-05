import sanitizeHtml from 'sanitize-html';

const EMPTY_HTML_RE = /<[^>]*>/g;

export function sanitizeRichText(value?: string | null) {
  if (!value?.trim()) return null;

  const sanitized = sanitizeHtml(value, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'h2',
      'h3',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          href: attribs.href,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    },
  }).trim();

  const textOnly = sanitized
    .replace(/&nbsp;/g, ' ')
    .replace(EMPTY_HTML_RE, '')
    .trim();

  return textOnly ? sanitized : null;
}

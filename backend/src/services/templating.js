/**
 * Tiny templating helpers shared by the Communication module.
 *
 * Variable syntax: {{varName}} — unknown variables are left untouched
 * (so admins typing a literal {{foo}} they didn't define still see {{foo}}
 * in the output rather than an empty string).
 */

function renderTemplate(template, vars) {
  if (template == null) return '';
  // Tolerant matcher:
  //   - {{ varName }} with optional whitespace
  //   - {{varName}} no whitespace
  //   - Also accepts &#123;&#123;varName&#125;&#125; — HTML-encoded braces some
  //     editors emit on copy-paste.
  const re = /(?:\{\{|&#123;&#123;|&#x7B;&#x7B;)\s*(\w+)\s*(?:\}\}|&#125;&#125;|&#x7D;&#x7D;)/g;
  return String(template).replace(re, (match, key) => {
    const value = vars?.[key];
    return value != null ? String(value) : match;
  });
}

/**
 * Strip HTML to a readable plain-text fallback for SendGrid.
 * Not a full HTML parser — handles the tags Quill produces (p, br, h2, h3,
 * ul/ol/li, strong, em, u, a) plus common entities.
 */
function htmlToPlainText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { renderTemplate, htmlToPlainText };

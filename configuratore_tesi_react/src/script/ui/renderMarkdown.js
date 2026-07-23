export function renderMarkdownToElement(element, markdown = "") {
  if (!element) return;
  element.classList.add("markdown-content");
  element.innerHTML = renderMarkdown(markdown);
}

export function renderMarkdown(markdown = "") {
  const text = String(markdown ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  const blocks = text.split(/\n{2,}/);

  return blocks.map((block) => {
    const lines = block.split("\n");
    const firstLine = lines[0] || "";

    const heading = firstLine.match(/^(#{1,3})\s+(.+)$/);
    if (heading && lines.length === 1) {
      const level = heading[1].length + 2;
      return `<h${level}>${renderInline(heading[2])}</h${level}>`;
    }

    if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
      const items = lines
        .map((line) => line.replace(/^\s*[-*]\s+/, ""))
        .map((line) => `<li>${renderInline(line)}</li>`)
        .join("");
      return `<ul>${items}</ul>`;
    }

    if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
      const items = lines
        .map((line) => line.replace(/^\s*\d+\.\s+/, ""))
        .map((line) => `<li>${renderInline(line)}</li>`)
        .join("");
      return `<ol>${items}</ol>`;
    }

    return `<p>${lines.map((line) => renderInline(line)).join("<br>")}</p>`;
  }).join("");
}

function renderInline(value) {
  let html = escapeHtml(value);

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  return html;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

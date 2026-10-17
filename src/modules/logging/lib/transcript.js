/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * @param {{ guildName: string, channelName: string, messages: Array<{authorTag: string, content: string, at: number, hadAttachments?: boolean}> }} opts
 * @returns {string} HTML
 */
export function renderTranscriptHtml({ guildName, channelName, messages }) {
  const rows = messages
    .map((message) => {
      const when = new Date(message.at).toISOString().replace('T', ' ').slice(0, 19);
      const content = escapeHtml(message.content).replaceAll('\n', '<br>');
      const attachmentNote = message.hadAttachments
        ? '<div class="ek">[dosya eki]</div>'
        : '';
      return `<div class="msg"><div class="meta"><span class="author">${escapeHtml(
        message.authorTag,
      )}</span> <span class="time">${when}</span></div><div class="content">${
        content || '<em>[içerik önbellekte yok]</em>'
      }</div>${attachmentNote}</div>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(channelName)} - silinen mesajlar</title>
<style>
  body { background:#1e1f22; color:#dbdee1; font-family: system-ui, sans-serif; margin: 24px; }
  h1 { font-size: 18px; color:#ffffff; }
  .info { color:#949ba4; font-size: 12px; margin-bottom: 16px; }
  .msg { background:#2b2d31; border-radius:10px; padding:10px 12px; margin-bottom:8px; }
  .meta { font-size:12px; color:#949ba4; margin-bottom:4px; }
  .author { color:#5865f2; font-weight:600; }
  .content { white-space: normal; }
  .ek { color:#fee75c; font-size:12px; margin-top:4px; }
</style>
</head>
<body>
<h1>${escapeHtml(guildName)} / #${escapeHtml(channelName)}</h1>
<div class="info">${messages.length} silinen mesaj | oluşturma: ${new Date().toISOString()}</div>
${rows}
</body>
</html>`;
}

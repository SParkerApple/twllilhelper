const fs = require('node:fs/promises');
const path = require('node:path');
const { AttachmentBuilder } = require('discord.js');
const defaultRoot = require('./database').directory;
const LIMIT = 7_000_000;
const values = collection => collection ? [...collection.values()] : [];
const json = value => value?.toJSON ? value.toJSON() : value;
function createArchive({ root = defaultRoot, download = fetch, limit = LIMIT } = {}) {
  function directory(id) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw Error('Invalid ticket ID');
    return path.join(root, 'transcripts', id);
  }
  async function capture(channel, ticket) {
    const dir = directory(channel.id); await fs.mkdir(dir, { recursive: true });
    const files = []; let part = 0, chunks = [], bytes = 0, count = 0, before, latestMessageId;
    async function flush() {
      if (!bytes) return;
      const name = `ticket-${channel.id}-${++part}.txt`;
      await fs.writeFile(path.join(dir, name), Buffer.concat(chunks)); files.push(name); chunks = []; bytes = 0;
    }
    async function write(text) {
      let data = Buffer.from(text);
      while (data.length) { const n = Math.min(limit - bytes, data.length); chunks.push(data.subarray(0, n)); bytes += n; data = data.subarray(n); if (bytes === limit) await flush(); }
    }
    await write(`The Western Line ticket archive\nMessages are newest first, with IDs and timestamps. Concatenate numbered parts in order if needed.\nTicket: ${JSON.stringify(ticket)}\n\n`);
    for (;;) {
      const page = await channel.messages.fetch({ limit: 100, cache: false, ...(before ? { before } : {}) });
      if (!page.size) break;
      if (!latestMessageId) latestMessageId = page.first().id;
      for (const message of page.values()) {
        const attachments = values(message.attachments);
        const record = { ...json(message), id: message.id, author: json(message.author), content: message.content,
          createdAt: message.createdAt, editedAt: message.editedAt, reference: message.reference,
          embeds: (message.embeds || []).map(json), components: (message.components || []).map(json),
          stickers: values(message.stickers).map(json), attachments: attachments.map(json),
          reactions: values(message.reactions?.cache).map(json), poll: json(message.poll) };
        await write(JSON.stringify(record) + '\n\n'); count++;
        for (const attachment of attachments) {
          const url = new URL(attachment.url);
          if (!['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname) || url.protocol !== 'https:') throw Error('Unexpected attachment host');
          const response = await download(url.href, { signal: AbortSignal.timeout(120000), redirect: 'error' });
          if (!response.ok) throw Error(`Attachment ${attachment.id} could not be archived (${response.status})`);
          let data = [], size = 0, segment = 0; const pieces = [];
          const safeName = String(attachment.name || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
          async function savePart() {
            if (!size) return;
            const name = `${message.id}-${attachment.id}-${++segment}-${safeName}${attachment.size != null && attachment.size <= limit ? '' : '.part'}`;
            await fs.writeFile(path.join(dir, name), Buffer.concat(data)); files.push(name); pieces.push(name); data = []; size = 0;
          }
          for await (const raw of response.body) {
            let chunk = Buffer.from(raw);
            while (chunk.length) { const n = Math.min(limit - size, chunk.length); data.push(chunk.subarray(0, n)); size += n; chunk = chunk.subarray(n); if (size === limit) await savePart(); }
          }
          await savePart();
          await write(`ATTACHMENT ${JSON.stringify({ name: attachment.name, id: attachment.id, pieces, instructions: 'Concatenate these binary parts in order to restore the original file.' })}\n`);
        }
      }
      const last = page.last().id;
      if (last === before) throw Error('Discord repeated a transcript page; capture will retry');
      before = last;
      if (page.size < 100) break;
    }
    await flush();
    const manifest = { ticketId: channel.id, capturedAt: new Date().toISOString(), messageCount: count, latestMessageId, files };
    await fs.writeFile(path.join(dir, 'manifest.json.tmp'), JSON.stringify(manifest, null, 2));
    await fs.rename(path.join(dir, 'manifest.json.tmp'), path.join(dir, 'manifest.json'));
    return manifest;
  }
  async function deliver(target, manifest, content, from = 0, progress = async () => {}) {
    for (let index = from; index < manifest.files.length; index++) {
      const file = manifest.files[index];
      if (path.basename(file) !== file) throw Error('Invalid archive filename');
      await target.send({ content: `${content}\nArchive part ${index + 1}/${manifest.files.length}; ${manifest.messageCount} messages.`,
        files: [new AttachmentBuilder(path.join(directory(manifest.ticketId), file), { name: file })], allowedMentions: { parse: [] } });
      await progress(index + 1);
    }
  }
  return { capture, deliver };
}
module.exports = { createArchive };

const c = require('../config.json');
const logKeys = ['audit', 'members', 'roles', 'channels', 'voice', 'moderation', 'messages', 'safeguarding', 'tickets'];
function createLeadNotifications({ client, audit }) {
  return async function notifyLeads(message) {
    if (message.guildId !== c.guildId || message.author?.id !== client.user?.id) return;
    if (!logKeys.some(key => c.channels[key] === message.channelId)) return;
    const source = `The Western Line log · <#${message.channelId}>\n${message.url}`;
    const attachments = [...message.attachments.values()].map(a => `${a.name}: ${a.url}`).join('\n');
    const text = [source, message.content, attachments].filter(Boolean).join('\n\n');
    const embeds = message.embeds.map(e => e.toJSON());
    // Keep attachment links and long text intact across several Discord messages.
    for (const recipientId of new Set(c.serverLeadUserIds || [])) {
      for (let offset = 0, part = 0; offset < text.length; offset += 2000, part++) {
        await audit.enqueue(message.guild, {
          recipientId,
          payload: { content: text.slice(offset, offset + 2000), ...(part === 0 ? { embeds } : {}) },
          idempotencyKey: `lead-log:${message.id}:${recipientId}:${part}`,
        });
      }
    }
  };
}
module.exports = { createLeadNotifications };

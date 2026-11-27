const c = require('../config.json');
const { EmbedBuilder } = require('discord.js');
const { isFullAccess } = require('./access');

async function remindOwnershipMention(message) {
  if (message.guildId !== c.guildId || message.author?.bot || message.webhookId) return;
  const sender = message.member || await message.guild.members.fetch(message.author.id);
  if (isFullAccess(sender)) return;
  let ownershipMentioned = c.ownership.some(id => message.mentions.roles.has(id));
  let ownershipReply = false;
  {
    for (const id of message.mentions.users.keys()) {
      let member;
      try { member = await message.guild.members.fetch(id); }
      catch (error) { if (error.code === 10007) continue; throw error; }
      if (c.ownership.some(roleId => member.roles.cache.has(roleId))) {
        ownershipMentioned = true;
        if (message.reference?.messageId && message.mentions.repliedUser?.id === id) ownershipReply = true;
      }
    }
  }
  if (!ownershipMentioned) return;
  await message.reply({
    content: `Please open a ticket in <#${c.channels.support}> and refrain from pinging ownership.` +
      (ownershipReply ? '\nWhen replying to an ownership message, turn the reply ping **OFF** before sending: click or tap **@ ON** beside the reply bar so it changes to **@ OFF**.' : ''),
    ...(ownershipReply ? { embeds: [new EmbedBuilder().setColor(0x3498db)
      .setTitle('Turn reply pings OFF')
      .setDescription('Switch the @ toggle off before sending your reply. [Discord’s reply guide](https://support.discord.com/hc/en-us/articles/360057382374-Replies-FAQ)')
      .setImage('https://support.discord.com/hc/article_attachments/360097294054')] } : {}),
    allowedMentions: { parse: [], repliedUser: false },
  });
}

module.exports = { remindOwnershipMention };

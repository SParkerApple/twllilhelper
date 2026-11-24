const c = require('../config.json');

async function remindOwnershipMention(message) {
  if (message.guildId !== c.guildId || message.author?.bot || message.webhookId) return;
  let ownershipMentioned = c.ownership.some(id => message.mentions.roles.has(id));
  if (!ownershipMentioned) {
    for (const id of message.mentions.users.keys()) {
      let member;
      try { member = await message.guild.members.fetch(id); }
      catch (error) { if (error.code === 10007) continue; throw error; }
      if (c.ownership.some(roleId => member.roles.cache.has(roleId))) {
        ownershipMentioned = true;
        break;
      }
    }
  }
  if (!ownershipMentioned) return;
  await message.reply({
    content: `Please open a ticket in <#${c.channels.support}> and refrain from pinging ownership.`,
    allowedMentions: { parse: [], repliedUser: false },
  });
}

module.exports = { remindOwnershipMention };

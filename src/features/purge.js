'use strict';
const { PermissionFlagsBits: P } = require('discord.js');
const { staffLevel } = require('../access');
const TWO_WEEKS = 14 * 86400000;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function deleteMessages(channel, amount, { now = Date.now, pause = delay, deadlineMs = 10 * 60000 } = {}) {
  if (!Number.isInteger(amount) || amount < 1 || amount > 900) throw new Error('Choose between 1 and 900 messages.');
  const selected = [], seen = new Set();
  let before;
  // Freeze the target set first. Messages sent after this request are never swept in.
  while (selected.length < amount) {
    const page = await channel.messages.fetch({ limit: Math.min(100, amount - selected.length), ...(before ? { before } : {}) });
    if (!page.size) break;
    const ordered = [...page.values()].sort((a, b) => BigInt(a.id) > BigInt(b.id) ? -1 : 1);
    for (const message of ordered) if (!seen.has(message.id)) { seen.add(message.id); selected.push(message); }
    const next = ordered.at(-1).id;
    if (next === before) break;
    before = next;
  }
  const result = { requested: amount, found: selected.length, deleted: 0, failed: 0, alreadyGone: 0, stoppedEarly: false };
  const deadline = now() + deadlineMs;
  async function single(message) {
    try { await channel.messages.delete(message.id); result.deleted++; }
    catch (error) {
      if (error.code === 10008) result.alreadyGone++;
      else { result.failed++; if ([50001, 50013, 10003].includes(error.code)) throw error; }
    }
    await pause(350);
  }
  try {
    for (let offset = 0; offset < selected.length; offset += 100) {
      if (now() >= deadline) { result.stoppedEarly = true; break; }
      const batch = selected.slice(offset, offset + 100);
      const young = batch.filter(message => now() - message.createdTimestamp < TWO_WEEKS - 60000);
      const old = batch.filter(message => !young.includes(message));
      if (young.length > 1) {
        try { result.deleted += (await channel.bulkDelete(young.map(message => message.id), false)).size; }
        catch (error) {
          if ([50001, 50013, 10003].includes(error.code)) throw error;
          // Age boundaries or a rejected bulk operation can still be handled safely one by one.
          for (const message of young) { if (now() >= deadline) { result.stoppedEarly = true; break; } await single(message); }
        }
      } else if (young.length === 1) await single(young[0]);
      for (const message of old) { if (now() >= deadline) { result.stoppedEarly = true; break; } await single(message); }
      if (result.stoppedEarly) break;
    }
  } catch (error) { result.stoppedEarly = true; result.errorCode = error.code || 'unavailable'; }
  result.remaining = result.found - result.deleted - result.alreadyGone;
  return result;
}

function createPurge({ audit }) {
  const active = new Set();
  async function execute(i, amount) {
    const actor = await i.guild.members.fetch(i.user.id);
    if (staffLevel(actor) < 1 && !actor.permissions.has(P.Administrator)) throw new Error('Discord Moderator or Administrator access is required.');
    if (!i.channel?.permissionsFor(actor)?.has(P.ManageMessages)) throw new Error('You need Manage Messages permission in this channel.');
    const me = i.guild.members.me || await i.guild.members.fetchMe();
    if (!i.channel?.messages?.fetch || !i.channel?.bulkDelete) throw new Error('Use this command in a server message channel.');
    if (!i.channel.permissionsFor(me)?.has([P.ViewChannel, P.ReadMessageHistory, P.ManageMessages])) throw new Error('I need View Channel, Read Message History and Manage Messages here.');
    if (active.has(i.channelId)) throw new Error('A purge is already running in this channel.');
    active.add(i.channelId);
    try {
      await i.deferReply({ ephemeral: true });
      const result = await deleteMessages(i.channel, amount);
      await audit.record(i.guild, { action: 'Messages cleared', moderator: i.user, target: i.user, reason: `${result.deleted}/${amount} requested messages deleted in <#${i.channelId}>. ${result.remaining} selected messages left; ${result.alreadyGone} already removed.`, delivery: result.stoppedEarly ? 'Stopped early due to time limit or missing access.' : undefined });
      await i.editReply({ content: `🧹 Deleted **${result.deleted}** message${result.deleted === 1 ? '' : 's'} in this channel.${result.found < amount ? ` Only ${result.found} messages were available.` : ''}${result.alreadyGone ? ` ${result.alreadyGone} had already been removed.` : ''}${result.remaining ? ` ${result.remaining} could not be deleted${result.stoppedEarly ? ' before the operation stopped; check permissions and try again' : ''}.` : ''}`, allowedMentions: { parse: [] } });
      return result;
    } finally { active.delete(i.channelId); }
  }
  return { execute };
}
module.exports = { createPurge, deleteMessages };

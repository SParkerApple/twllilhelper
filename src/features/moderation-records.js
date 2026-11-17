const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits: P, InteractionContextType } = require('discord.js');
const { randomUUID, createHash } = require('node:crypto');
const { isFullAccess, staffLevel } = require('../access');

const safe = (value, length = 1024) => String(value || 'Not provided').slice(0, length);
const stamp = () => new Date().toISOString();
function parseDuration(value) {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(m|h|d|w)\s*$/i.exec(value || '');
  if (!match) throw new Error('Use a duration such as 30m, 2h, 7d or 1w.');
  const duration = Number(match[1]) * { m: 60000, h: 3600000, d: 86400000, w: 604800000 }[match[2].toLowerCase()];
  if (!Number.isFinite(duration) || duration < 60000 || duration > 365 * 86400000) throw new Error('Temporary bans must last between 1 minute and 365 days.');
  return Math.round(duration);
}
function extendCommands(commands) {
  commands.find(c => c.name === 'mod').addSubcommand(s => s.setName('tempban').setDescription('Ban a member temporarily and automatically lift this ban when it expires.')
    .addUserOption(o => o.setName('member').setDescription('Server member to ban').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Examples: 30m, 2h, 7d, 1w; maximum 365 days').setRequired(true).setMaxLength(30))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the temporary ban').setRequired(true).setMaxLength(350)));
  commands.push(new SlashCommandBuilder().setName('case').setDescription('View moderation cases, member history and reason corrections.').setContexts(InteractionContextType.Guild)
    .addSubcommand(s => s.setName('view').setDescription('View a moderation case and log delivery status.')
      .addIntegerOption(o => o.setName('number').setDescription('Case number').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('history').setDescription('View a member’s recent moderation cases.')
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand(s => s.setName('reason').setDescription('Correct a case reason while preserving the previous text.')
      .addIntegerOption(o => o.setName('number').setDescription('Case number').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('reason').setDescription('Corrected reason').setRequired(true).setMaxLength(1000))));
  commands.find(c => c.name === 'case').addSubcommand(s => s.setName('void').setDescription('Void a case without deleting its history; Administrator permission required.').addIntegerOption(o => o.setName('number').setDescription('Case number').setRequired(true).setMinValue(1)));
  return commands;
}

function createModerationRecords({ client, db }) {
  let flushing = false, ticking = false;
  const busy = new Set();
  const cfg = id => db.getGuildConfig(id);
  const state = id => cfg(id).moderation || {};
  const update = (id, fn) => db.editGuildConfig(id, c => ({ ...c, moderation: fn(c.moderation || {}, c) }));
  const reply = (i, content, extra = {}) => i.deferred ? i.editReply({ content, ...extra }) : i.reply({ content, ephemeral: true, ...extra });
  const normalPayload = payload => ({ ...JSON.parse(JSON.stringify(payload)), allowedMentions: { parse: [] } });
  function event(guildId, options) {
    const id = options.idempotencyKey ? createHash('sha256').update(`${guildId}:${options.idempotencyKey}`).digest('hex').slice(0, 32) : randomUUID();
    return { id, recipientId: options.recipientId || null, channelId: options.channelId || cfg(guildId).moderationLogChannelId, payload: normalPayload(options.payload), caseNumber: options.caseNumber || null,
      createdAt: stamp(), status: 'pending', attempts: 0, nextAttemptAt: 0 };
  }
  function caseEmbed(c, heading) {
    const embed = new EmbedBuilder().setColor(c.status === 'failed' ? 0xe74c3c : 0x5865f2).setTitle(safe(heading || `Case #${c.number} · ${c.action}`, 256))
      .addFields({ name: 'Member', value: `<@${c.targetId}> (${safe(c.targetName, 180)} · ${c.targetId})` },
        { name: 'Staff member', value: `<@${c.moderatorId}> (${c.moderatorId})` },
        { name: 'Reason', value: safe(c.reason) })
      .setFooter({ text: `Case #${c.number} · ${c.status || 'recorded'}` }).setTimestamp(new Date(c.createdAt));
    if (c.voidedAt) { embed.setTitle('VOIDED · Case #' + c.number).setDescription('~~' + safe(c.action, 200) + '~~').addFields({ name: 'Voided by', value: '<@' + c.voidedBy + '>' }, { name: 'Voided at', value: c.voidedAt }); }
    if (c.delivery) embed.addFields({ name: 'DM delivery', value: safe(c.delivery) });
    if (c.expiresAt) embed.addFields({ name: 'Temporary ban expires', value: `<t:${Math.floor(c.expiresAt / 1000)}:F>` });
    if (c.duration) embed.addFields({ name: 'Duration', value: safe(c.duration), inline: true });
    if (c.parentCaseNumber) embed.addFields({ name: 'Related case', value: `#${c.parentCaseNumber}`, inline: true });
    return embed;
  }
  function allocate(m, details) {
    const number = Math.max(Number(m.nextCaseNumber) || 1, ...Object.keys(m.cases || {}).map(id => Number(id) + 1).filter(Number.isFinite));
    const c = { number, action: safe(details.action, 200), moderatorId: details.moderator?.id || details.moderatorId || client.user?.id,
      targetId: details.target?.id || details.targetId, targetName: details.target?.tag || details.target?.username || details.targetName || 'User',
      reason: String(details.reason || 'No reason provided'), originalReason: String(details.reason || 'No reason provided'),
      createdAt: details.createdAt || stamp(), status: details.status || (details.historical ? 'historical' : 'recorded'),
      corrections: [], ...(details.sourceKey ? { sourceKey: details.sourceKey } : {}), ...(details.delivery ? { delivery: details.delivery } : {}), ...(details.expiresAt ? { expiresAt: details.expiresAt } : {}),
      ...(details.duration ? { duration: details.duration } : {}), ...(details.parentCaseNumber ? { parentCaseNumber: details.parentCaseNumber } : {}) };
    return { c, next: { ...m, nextCaseNumber: number + 1, cases: { ...(m.cases || {}), [number]: c } } };
  }
  async function enqueue(guild, options) {
    const e = event(guild.id, options);
    await update(guild.id, m => ({ ...m, outbox: { ...(m.outbox || {}), [e.id]: m.outbox?.[e.id] || e } }));
    void flushOutbox().catch(error => console.warn('Moderation outbox delivery failed:', error.code || error.message));
    return e.id;
  }
  async function record(guild, details) {
    let created;
    await update(guild.id, m => {
      const { c, next } = allocate(m, details); created = c;
      if (details.historical || details.deferDispatch) return next;
      const e = event(guild.id, { payload: { embeds: [caseEmbed(c)] }, caseNumber: c.number });
      return { ...next, outbox: { ...(m.outbox || {}), [e.id]: e } };
    });
    if (!details.historical && !details.deferDispatch) void flushOutbox().catch(error => console.warn('Moderation outbox delivery failed:', error.code || error.message));
    if (!details.historical && !details.deferDispatch) await mirrorCase(guild, created).catch(error => console.warn('Punishment mirror queued failed:', error.code || error.message));
    return created;
  }
  async function patchCase(guildId, number, patch) { await update(guildId, m => ({ ...m, cases: { ...m.cases, [number]: { ...m.cases[number], ...patch } } })); }
  async function mirrorCase(guild, c, suffix = 'initial') {
    const channelId = cfg(guild.id).eventLogs?.enabled && cfg(guild.id).eventLogs?.channels?.punishments;
    if (!channelId || channelId === cfg(guild.id).moderationLogChannelId) return;
    return enqueue(guild, {channelId, payload:{embeds:[caseEmbed(c)]}, caseNumber:c.number, idempotencyKey:'punishment:'+c.number+':'+suffix});
  }
  async function queueCase(guild, number, suffix) {
    const c = state(guild.id).cases[number];
    await mirrorCase(guild, c, suffix).catch(error => console.warn('Punishment mirror failed:', error.code || error.message));
    return enqueue(guild, { payload: { embeds: [caseEmbed(c, suffix ? `Case #${number} · ${suffix}` : undefined)] }, caseNumber: number, idempotencyKey: `case:${number}:${suffix || 'initial'}` });
  }
  async function flushOutbox() {
    if (flushing) return;
    flushing = true;
    try {
      for (const guild of client.guilds.cache.values()) {
        let count = 0;
        for (const initial of Object.values(state(guild.id).outbox || {})) {
          if (['sent','undeliverable'].includes(initial.status) || initial.nextAttemptAt > Date.now() || count >= 20) continue;
          const current = state(guild.id).outbox?.[initial.id];
          if (!current || current.status === 'sent') continue;
          count++;
          try {
            const channelId = current.channelId || cfg(guild.id).moderationLogChannelId;
            const channel = current.recipientId ? await client.users.fetch(current.recipientId) : channelId && await guild.channels.fetch(channelId);
            if (!channel?.send) throw new Error('Log channel is not configured or unavailable.');
            const posted = await channel.send({ ...current.payload, allowedMentions: { parse: [] }, nonce: createHash('sha256').update(current.id).digest('hex').slice(0, 24), enforceNonce: true });
            await update(guild.id, m => ({ ...m, outbox: { ...m.outbox, [current.id]: { ...m.outbox[current.id], status: 'sent', sentAt: stamp(), messageId: posted.id, messageUrl: posted.url, lastError: null } } }));
          } catch (error) {
            const attempts = (current.attempts || 0) + 1;
            await update(guild.id, m => ({ ...m, outbox: { ...m.outbox, [current.id]: { ...m.outbox[current.id], status: current.recipientId && [50007,10013].includes(error.code) ? 'undeliverable' : 'pending', attempts,
              lastError: safe(error.code || error.message, 250), nextAttemptAt: Date.now() + Math.min(3600000, 15000 * 2 ** Math.min(attempts - 1, 8)) } } }));
            console.warn(`Moderation log queued for retry in guild ${guild.id}:`, error.code || error.message);
          }
        }
      }
    } finally { flushing = false; }
  }
  const banMarker = (guildId, number) => `[GT-TEMPBAN:${guildId}:${number}]`;
  async function fetchBan(guild, userId) { try { return await guild.bans.fetch(userId); } catch (error) { if (error.code === 10026) return null; throw error; } }
  async function patchTempban(guildId, userId, patch) { await update(guildId, m => ({ ...m, tempbans: { ...(m.tempbans || {}), [userId]: { ...m.tempbans?.[userId], ...patch } } })); }
  async function cancelTempban(guild, userId, reason = 'A permanent ban replaced the temporary ban') {
    const schedule = state(guild.id).tempbans?.[userId];
    if (!schedule || !['preparing', 'active', 'uncertain'].includes(schedule.status)) return;
    await patchTempban(guild.id, userId, { status: 'cancelled', finishedAt: stamp(), outcome: reason });
    await patchCase(guild.id, schedule.caseNumber, { status: 'cancelled', scheduleOutcome: reason });
  }
  async function manualUnban(guild, userId) { return cancelTempban(guild, userId, 'Staff manually removed the ban'); }
  async function withBanLock(guild, userId, operation) {
    const key = `${guild.id}:${userId}`;
    if (busy.has(key)) throw new Error('Another ban or unban action is processing for this member. Try again shortly.');
    busy.add(key);
    try { return await operation(); }
    finally { busy.delete(key); }
  }
  async function finishTempban(guild, userId, schedule, action, reason) {
    let created;
    await update(guild.id, m => {
      if (m.tempbans?.[userId]?.caseNumber !== schedule.caseNumber || !['active', 'preparing', 'uncertain'].includes(m.tempbans[userId].status)) return m;
      const { c, next } = allocate(m, { action, reason, moderator: client.user, targetId: userId, targetName: schedule.targetName, parentCaseNumber: schedule.caseNumber }); created = c;
      const e = event(guild.id, { payload: { embeds: [caseEmbed(c)] }, caseNumber: c.number });
      return { ...next, cases: { ...next.cases, [schedule.caseNumber]: { ...next.cases[schedule.caseNumber], status: 'ended', scheduleOutcome: reason } },
        tempbans: { ...m.tempbans, [userId]: { ...m.tempbans[userId], status: 'ended', finishedAt: stamp(), outcome: reason, completionCaseNumber: c.number } }, outbox: { ...(m.outbox || {}), [e.id]: e } };
    });
    return created;
  }
  async function temporaryBan(i) {
    const actor = await i.guild.members.fetch(i.user.id);
    if (!isFullAccess(actor) && staffLevel(actor) < 3) throw new Error('Discord Admin or higher is required to issue temporary bans.');
    const user = i.options.getUser('member', true), durationText = i.options.getString('duration', true), duration = parseDuration(durationText), reason = i.options.getString('reason', true).trim();
    if (!reason) throw new Error('Enter a reason for the ban.');
    if (user.id === i.user.id || user.id === i.guild.ownerId || user.bot) throw new Error('Choose another human server member; the server owner cannot be banned.');
    const target = await i.guild.members.fetch(user.id).catch(error => { if (error.code === 10007) return null; throw error; });
    if (!target) throw new Error('Choose a current server member for a temporary ban.');
    const me = i.guild.members.me || await i.guild.members.fetchMe();
    if (!me.permissions.has(P.BanMembers) || me.roles.highest.comparePositionTo(target.roles.highest) <= 0) throw new Error('The bot needs Ban Members and a role above this member.');
    if (!isFullAccess(actor) && actor.roles.highest.comparePositionTo(target.roles.highest) <= 0) throw new Error('Your highest role must be above this member.');
    const lock = `${i.guildId}:${user.id}`;
    if (busy.has(lock)) throw new Error('Another temporary-ban action is processing for this member.');
    busy.add(lock);
    try {
      await i.deferReply({ ephemeral: true });
      if (await fetchBan(i.guild, user.id)) throw new Error('This user is already banned. Their existing ban was not changed.');
      const active = state(i.guildId).tempbans?.[user.id];
      if (active && ['preparing', 'active', 'uncertain'].includes(active.status)) throw new Error('This user already has an active temporary-ban record.');
      const expiresAt = Date.now() + duration;
      const c = await record(i.guild, { action: 'Temporary ban', moderator: i.user, target: user, reason, expiresAt, duration: durationText, status: 'preparing', deferDispatch: true });
      const marker = banMarker(i.guildId, c.number);
      await patchTempban(i.guildId, user.id, { caseNumber: c.number, targetName: user.tag, moderatorId: i.user.id, reason, marker, expiresAt, createdAt: stamp(), status: 'preparing', nextCheckAt: 0 });
      try { await i.guild.members.ban(user.id, { reason: `${marker} ${reason}`.slice(0, 512) }); }
      catch (banError) {
        let checked;
        try { checked = await fetchBan(i.guild, user.id); }
        catch {
          await patchTempban(i.guildId, user.id, { status: 'uncertain', lastError: safe(banError.code || banError.message, 250), nextCheckAt: Date.now() + 60000 });
          await patchCase(i.guildId, c.number, { status: 'uncertain' });
          await queueCase(i.guild, c.number, 'Temporary ban outcome uncertain — automatic reconciliation pending');
          return reply(i, `Case #${c.number}: Discord did not confirm the outcome. The bot will check the ban and preserve its expiry automatically. Do not issue a replacement temporary ban yet.`);
        }
        if (!checked?.reason?.startsWith(marker)) {
          await patchTempban(i.guildId, user.id, { status: 'failed', finishedAt: stamp(), lastError: safe(banError.code || banError.message, 250) });
          await patchCase(i.guildId, c.number, { status: 'failed' });
          await queueCase(i.guild, c.number, 'Temporary ban failed');
          throw new Error(`Temporary ban failed (case #${c.number}). ${safe(banError.code || banError.message, 150)}`);
        }
      }
      await patchTempban(i.guildId, user.id, { status: 'active', appliedAt: stamp() });
      await patchCase(i.guildId, c.number, { status: 'active' });
      await queueCase(i.guild, c.number);
      await reply(i, `**${user.tag}** is temporarily banned until <t:${Math.floor(expiresAt / 1000)}:F>. **Case #${c.number}**.\nThe bot will automatically unban this specific temporary ban, including after a restart.`);
    } finally { busy.delete(lock); }
  }
  async function handle(i) {
    if (!i.isChatInputCommand()) return false;
    if (i.commandName === 'tempban' || (i.commandName === 'mod' && i.options.getSubcommand() === 'tempban')) { await temporaryBan(i); return true; }
    if (i.commandName !== 'case') return false;
    const actor = await i.guild.members.fetch(i.user.id);
    if (!actor.permissions.has(P.Administrator) && !isFullAccess(actor) && staffLevel(actor) < 1) throw new Error('Discord Moderator or higher is required to access moderation cases.');
    const command = i.options.getSubcommand();
    if (command === 'history') {
      const user = i.options.getUser('user', true);
      const cases = Object.values(state(i.guildId).cases || {}).filter(c => c.targetId === user.id).sort((a, b) => b.number - a.number);
      const description = cases.slice(0, 15).map(c => c.voidedAt ? `~~#${c.number} · ${c.action} · ${safe(c.reason, 140)}~~ **VOIDED**` : `**#${c.number} · ${c.action}** · ${c.status}\n${safe(c.reason, 140)}`).join('\n\n') || 'No cases are stored for this member.';
      await reply(i, '', { embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(safe(`Moderation history · ${user.tag}`, 256)).setDescription(description).setFooter({ text: `${cases.length} total cases · ${cases.filter(c => !c.voidedAt).length} non-voided · latest 15 shown` })] }); return true;
    }
    const number = i.options.getInteger('number', true), c = state(i.guildId).cases?.[number];
    if (!c) throw new Error('That moderation case does not exist.');
    if (command === 'void') {
      if (!actor.permissions.has(P.Administrator)) throw new Error('The Discord Administrator permission is required to void a case.');
      if (c.voidedAt) { await reply(i, 'This case is already voided.'); return true; }
      await i.deferReply({ ephemeral: true });
      await patchCase(i.guildId, number, { voidedAt: stamp(), voidedBy: i.user.id });
      await queueCase(i.guild, number, 'VOIDED');
      await reply(i, 'Case #' + number + ' voided. Its original history is preserved. This does not undo an existing punishment.'); return true;
    }
    if (command === 'reason') {
      if (!isFullAccess(actor) && c.moderatorId !== i.user.id) throw new Error('Only the original moderator or a designated server lead can correct this reason.');
      const reason = i.options.getString('reason', true).trim();
      if (!reason) throw new Error('Enter a corrected reason.');
      await i.deferReply({ ephemeral: true });
      await update(i.guildId, m => ({ ...m, cases: { ...m.cases, [number]: { ...m.cases[number], reason,
        corrections: [...(m.cases[number].corrections || []), { previous: m.cases[number].reason, replacement: reason, moderatorId: i.user.id, createdAt: stamp() }] } } }));
      const embed = caseEmbed(state(i.guildId).cases[number], `Case #${number} · Reason corrected`).addFields({ name: 'Previous reason', value: safe(c.reason) }, { name: 'Corrected by', value: `<@${i.user.id}> (${i.user.id})` });
      await enqueue(i.guild, { payload: { embeds: [embed] }, caseNumber: number });
      await reply(i, `Case #${number} reason updated. The original reason and correction history are preserved.`); return true;
    }
    const logs = Object.values(state(i.guildId).outbox || {}).filter(e => e.caseNumber === number), pending = logs.filter(e => e.status !== 'sent');
    const embed = caseEmbed(c).addFields({ name: 'Log delivery', value: pending.length ? `${pending.length} notification(s) queued for automatic retry` : logs.length ? 'Delivered' : 'Historical record; no notification sent' });
    const last = logs.filter(e => e.status === 'sent').at(-1);
    if (last?.messageUrl) embed.addFields({ name: 'Latest log', value: last.messageUrl });
    if (c.corrections?.length) embed.addFields({ name: 'Original reason', value: safe(c.originalReason) }, { name: 'Corrections', value: c.corrections.slice(-4).map(edit => `<@${edit.moderatorId}> · ${edit.createdAt}\n${safe(edit.replacement, 150)}`).join('\n\n').slice(0, 1024) });
    await reply(i, '', { embeds: [embed] }); return true;
  }
  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      for (const guild of client.guilds.cache.values()) for (const [userId, schedule] of Object.entries(state(guild.id).tempbans || {})) {
        if (!['preparing', 'uncertain', 'active'].includes(schedule.status) || schedule.nextCheckAt > Date.now()) continue;
        if (schedule.status === 'active' && schedule.expiresAt > Date.now()) continue;
        const lock = `${guild.id}:${userId}`;
        if (busy.has(lock)) continue;
        busy.add(lock);
        try {
          const ban = await fetchBan(guild, userId);
          if (!ban) {
            if (schedule.status !== 'active' && Date.now() - Date.parse(schedule.createdAt) < 120000) continue;
            await finishTempban(guild, userId, schedule, 'Temporary ban ended', 'The recorded temporary ban is no longer present. No additional ban or unban was issued.');
            continue;
          }
          if (!ban.reason?.startsWith(schedule.marker)) {
            await finishTempban(guild, userId, schedule, 'Temporary ban expiry cancelled', 'The current ban does not match this temporary-ban case. It was left unchanged for staff review.');
            continue;
          }
          if (schedule.status !== 'active') {
            await patchTempban(guild.id, userId, { status: 'active', appliedAt: schedule.appliedAt || stamp() });
            await patchCase(guild.id, schedule.caseNumber, { status: 'active' });
            await queueCase(guild, schedule.caseNumber);
          }
          if (schedule.expiresAt <= Date.now()) {
            try { await guild.members.unban(userId, `Temporary ban case #${schedule.caseNumber} expired`); }
            catch (error) { if (error.code !== 10026) throw error; }
            await finishTempban(guild, userId, schedule, 'Temporary ban expired — unbanned', `The temporary ban from case #${schedule.caseNumber} reached its expiry and was lifted automatically.`);
          }
        } catch (error) {
          await patchTempban(guild.id, userId, { lastError: safe(error.code || error.message, 250), nextCheckAt: Date.now() + 60000 });
          console.warn(`Temporary ban case #${schedule.caseNumber} will retry:`, error.code || error.message);
        } finally { busy.delete(lock); }
      }
      await flushOutbox();
    } finally { ticking = false; }
  }
  return { record, patchCase, queueCase, enqueue, handle, tick, manualUnban, cancelTempban, withBanLock, parseDuration };
}
module.exports = { createModerationRecords, extendCommands, parseDuration };

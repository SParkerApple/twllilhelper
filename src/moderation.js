const {PermissionFlagsBits,EmbedBuilder}=require('discord.js');
const access=require('./access');
module.exports=({client,db,moderationRecords,purge})=>{
const {getGuildConfig,editGuildConfig,addWarning,listWarnings}=db;
async function sendPrivate(interaction, content) {
  const payload = { content, ephemeral: true };
  if (interaction.deferred) return interaction.editReply(payload);
  if (interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

function hasPermission(interaction, permission) {
  if (access.isFullAccess(interaction.member)) return true;
  return interaction.memberPermissions?.has(permission) ?? false;
}

async function requirePermission(interaction, permission, label = 'use this command') {
  if (hasPermission(interaction, permission)) return true;
  await sendPrivate(interaction, `You need the **${label}** permission to do that.`);
  return false;
}

async function ensureBotPermission(interaction, permission, description) {
  const botMember = interaction.guild.members.me;
  if (botMember?.permissions.has(permission)) return true;
  await sendPrivate(interaction, `I need the **${description}** permission to do that.`);
  return false;
}

async function fetchMember(guild, userId) {
  try {
    return await guild.members.fetch(userId);
  } catch (error) {
    if (error?.code === 10007) return null;
    throw error;
  }
}

async function checkTargetHierarchy(interaction, targetMember) {
  const guild = interaction.guild;
  if (targetMember.id === guild.ownerId) throw new Error('The server owner cannot be moderated by the bot.');
  if (targetMember.id === interaction.user.id) throw new Error('You cannot moderate yourself with this command.');

  const botMember = guild.members.me;
  if (!botMember || botMember.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) {
    throw new Error('My highest role must be above the member’s highest role. Move my bot role higher in Server Settings → Roles.');
  }

  if (!access.isFullAccess(interaction.member) && interaction.user.id !== guild.ownerId) {
    const actorMember = await guild.members.fetch(interaction.user.id);
    if (actorMember.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) {
      throw new Error('Your highest role must be above the member’s highest role.');
    }
  }
}

async function logModeration(guild, details) {
  return moderationRecords.record(guild, details);
}

function getTextChannel(interaction, optionName = 'channel') {
  const channel = interaction.options.getChannel(optionName, true);
  if (!channel.isTextBased() || !channel.guild) throw new Error('Choose a text channel in this server.');
  return channel;
}

function roleFromOption(interaction, optionName) {
  return interaction.options.getRole(optionName)?.id || null;
}

async function handleModeration(interaction) {
  const action = interaction.commandName === 'mod' ? interaction.options.getSubcommand() : interaction.commandName === 'modlog' ? 'log' : interaction.commandName;
  if (action === 'clear') return purge.execute(interaction, interaction.options.getInteger('amount', true));
  if (action === 'banlog') {
    const actor = await interaction.guild.members.fetch(interaction.user.id);
    if (!access.isFullAccess(actor) && access.staffLevel(actor) < 3) throw new Error('Discord Admin or higher is required to log a Discord ban.');
    const selected = interaction.options.getUser('user');
    const suppliedId = interaction.options.getString('user_id')?.trim();
    if (!selected && !suppliedId) throw new Error('Select a user to fill their ID automatically, or supply user_id if they cannot be selected.');
    if (suppliedId && !/^\d{17,20}$/.test(suppliedId)) throw new Error('Enter a valid Discord user ID.');
    if (selected && suppliedId && selected.id !== suppliedId) throw new Error('The selected user and supplied user ID do not match.');
    const proof = interaction.options.getAttachment('proof', true);
    if (!proof.contentType?.startsWith('image/') || !/\.(png|jpe?g|webp|gif)$/i.test(proof.name || '')) throw new Error('Upload a PNG, JPG, WebP or GIF screenshot for proof.');
    if (proof.size > 8 * 1024 * 1024) throw new Error('Use a proof screenshot smaller than 8 MB.');
    const destination = getGuildConfig(interaction.guildId).discordBanLogChannelId;
    if (!destination) throw new Error('The Discord bans log channel must be configured first.');
    await interaction.deferReply({ ephemeral: true });
    const channel = await interaction.guild.channels.fetch(destination);
    if (!channel?.send) throw new Error('The configured Discord bans channel is unavailable.');
    const userId = selected?.id || suppliedId;
    const user = selected || await client.users.fetch(userId).catch(() => null);
    const reason = interaction.options.getString('reason', true);
    const duration = interaction.options.getString('duration') || 'Permanent';
    const filename = `ban-proof.${proof.name.split('.').pop().toLowerCase()}`;
    const embed = new EmbedBuilder().setColor(0xe74c3c).setTitle('Discord ban record')
      .addFields({ name: 'User', value: user ? `${user.tag} (<@${userId}>)` : `<@${userId}>` },
        { name: 'User ID', value: userId }, { name: 'Action', value: 'Ban', inline: true },
        { name: 'Duration', value: duration, inline: true }, { name: 'Reason', value: reason },
        { name: 'Logged by', value: `${interaction.user.tag} (${interaction.user.id})` })
      .setImage(`attachment://${filename}`).setFooter({ text: 'Manual ban record • This command does not ban or schedule an unban.' }).setTimestamp();
    const posted = await channel.send({ embeds: [embed], files: [{ attachment: proof.url, name: filename }], allowedMentions: { parse: [] } });
    await logModeration(interaction.guild, { action: 'Ban record added', moderator: interaction.user, target: user || { id: userId, username: 'User' }, reason: `${reason}\nDuration: ${duration}\nEvidence and full record: ${posted.url}` });
    return sendPrivate(interaction, `Ban record saved with the user ID and screenshot: ${posted.url}\nThis command records the ban; use /ban to issue one.`);
  }
  const permissions = {
    ban: [PermissionFlagsBits.BanMembers, 'Ban Members'],
    unban: [PermissionFlagsBits.BanMembers, 'Ban Members'],
    kick: [PermissionFlagsBits.KickMembers, 'Kick Members'],
    timeout: [PermissionFlagsBits.ModerateMembers, 'Moderate Members'],
    untimeout: [PermissionFlagsBits.ModerateMembers, 'Moderate Members'],
    warn: [PermissionFlagsBits.ModerateMembers, 'Moderate Members'],
    warnings: [PermissionFlagsBits.ModerateMembers, 'Moderate Members'],
    clear: [PermissionFlagsBits.ManageMessages, 'Manage Messages'],
    slowmode: [PermissionFlagsBits.ManageChannels, 'Manage Channels'],
    lock: [PermissionFlagsBits.ManageChannels, 'Manage Channels'],
    unlock: [PermissionFlagsBits.ManageChannels, 'Manage Channels'],
    log: [PermissionFlagsBits.ManageGuild, 'Manage Server'],
  };
  const [permission, label] = permissions[action];
  if (!access.policy(interaction.guildId) && !(await requirePermission(interaction, permission, label))) return;
  await interaction.deferReply({ ephemeral: true });

  if (action === 'log') {
    const channel = getTextChannel(interaction);
    await editGuildConfig(interaction.guildId, (old) => ({ ...old, moderationLogChannelId: channel.id }));
    return sendPrivate(interaction, `Moderation actions will be logged in ${channel}.`);
  }

  if (action === 'unban') {
    if (!(await ensureBotPermission(interaction, PermissionFlagsBits.BanMembers, 'Ban Members'))) return;
    const userId = interaction.options.getString('user_id', true).trim();
    if (!/^\d{17,20}$/.test(userId)) throw new Error('Enter a valid Discord user ID (17–20 digits).');
    const user = await moderationRecords.withBanLock(interaction.guild, userId, async () => {
      const result = await interaction.guild.members.unban(userId, interaction.options.getString('reason') || 'No reason provided');
      await moderationRecords.manualUnban(interaction.guild, userId);
      return result;
    });
    await logModeration(interaction.guild, { action: 'Unban', moderator: interaction.user, target: user, reason: interaction.options.getString('reason') || 'No reason provided' });
    return sendPrivate(interaction, `✅ **${user.tag}** has been unbanned.`);
  }

  if (action === 'slowmode') {
    if (!(await ensureBotPermission(interaction, PermissionFlagsBits.ManageChannels, 'Manage Channels'))) return;
    if (!interaction.channel?.isTextBased() || !('setRateLimitPerUser' in interaction.channel)) {
      throw new Error('Slowmode can only be changed in a server text channel.');
    }
    const seconds = interaction.options.getInteger('seconds', true);
    await interaction.channel.setRateLimitPerUser(seconds, `Changed by ${interaction.user.tag}`);
    await logModeration(interaction.guild, { action: 'Slowmode changed', moderator: interaction.user, target: interaction.user, reason: `${seconds} seconds in ${interaction.channel}.` });
    return sendPrivate(interaction, seconds === 0 ? 'Slowmode is now off.' : `Slowmode is now **${seconds} seconds**.`);
  }

  if (action === 'lock' || action === 'unlock') {
    if (!(await ensureBotPermission(interaction, PermissionFlagsBits.ManageChannels, 'Manage Channels'))) return;
    const channel = interaction.channel;
    if (!channel?.isTextBased() || !channel.permissionOverwrites) throw new Error('Use this command in a server text channel.');
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: action === 'lock' ? false : null,
    }, { reason: `${action} requested by ${interaction.user.tag}` });
    await logModeration(interaction.guild, { action: action === 'lock' ? 'Channel locked' : 'Channel unlocked', moderator: interaction.user, target: interaction.user, reason: `Channel: ${channel}` });
    return sendPrivate(interaction, action === 'lock' ? '🔒 This channel is locked for @everyone.' : '🔓 This channel is unlocked for @everyone.');
  }

  const user = interaction.options.getUser(action === 'warn' ? 'user' : 'member', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const target = await fetchMember(interaction.guild, user.id);

  if (target) await checkTargetHierarchy(interaction, target);
  else if (user.id === interaction.user.id) throw new Error('You cannot moderate yourself with this command.');
  if (user.id === interaction.guild.ownerId) throw new Error('The server owner cannot be moderated by the bot.');

  if (action === 'ban') {
    if (!(await ensureBotPermission(interaction, PermissionFlagsBits.BanMembers, 'Ban Members'))) return;
    await moderationRecords.withBanLock(interaction.guild, user.id, async () => {
      await interaction.guild.members.ban(user.id, { reason });
      await moderationRecords.cancelTempban(interaction.guild, user.id, 'Replaced by a permanent ban');
    });
    await logModeration(interaction.guild, { action: 'Ban', moderator: interaction.user, target: user, reason });
    return sendPrivate(interaction, `🔨 **${user.tag}** has been banned. Reason: ${reason}`);
  }

  if (!target) throw new Error('That member is no longer in this server.');

  if (action === 'kick') {
    if (!(await ensureBotPermission(interaction, PermissionFlagsBits.KickMembers, 'Kick Members'))) return;
    await target.kick(reason);
    await logModeration(interaction.guild, { action: 'Kick', moderator: interaction.user, target: user, reason });
    return sendPrivate(interaction, `👢 **${user.tag}** has been kicked. Reason: ${reason}`);
  }

  if (action === 'timeout') {
    if (!(await ensureBotPermission(interaction, PermissionFlagsBits.ModerateMembers, 'Moderate Members'))) return;
    const minutes = interaction.options.getInteger('minutes', true);
    await target.timeout(minutes * 60_000, reason);
    await logModeration(interaction.guild, { action: `Timeout (${minutes} minutes)`, moderator: interaction.user, target: user, reason });
    return sendPrivate(interaction, `⏳ **${user.tag}** is timed out for **${minutes} minute${minutes === 1 ? '' : 's'}**. Reason: ${reason}`);
  }

  if (action === 'untimeout') {
    if (!(await ensureBotPermission(interaction, PermissionFlagsBits.ModerateMembers, 'Moderate Members'))) return;
    await target.timeout(null, reason);
    await logModeration(interaction.guild, { action: 'Timeout removed', moderator: interaction.user, target: user, reason });
    return sendPrivate(interaction, `✅ **${user.tag}** is no longer timed out.`);
  }

  if (action === 'warn') {
    const warnings = await addWarning(interaction.guildId, user.id, {
      reason,
      moderatorId: interaction.user.id,
      createdAt: new Date().toISOString(),
    });
    const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle(`Warning #${warnings.length} · ${interaction.guild.name}`)
      .setDescription('A formal server warning has been recorded.')
      .addFields({ name: 'Member warned', value: `${user.tag} (${user.id})` },
        { name: 'Reason', value: reason }, { name: 'Warned by', value: `${interaction.user.tag} (${interaction.user.id})` }).setTimestamp();
    const recipients = [...new Set([user.id, ...(getGuildConfig(interaction.guildId).commandAccess?.warningNotifyUserIds || [])])];
    const deliveries = await Promise.all(recipients.map(async id => {
      try { const recipient = await client.users.fetch(id); await recipient.send({ embeds: [embed], allowedMentions: { parse: [] } }); return { id, ok: true }; }
      catch (error) { console.warn(`Warning DM delivery failed for ${id}:`, error.code || error.message); return { id, ok: false }; }
    }));
    const delivery = deliveries.map(result => `<@${result.id}>: ${result.ok ? 'sent' : 'could not deliver'}`).join('\n');
    await logModeration(interaction.guild, { action: `Warning #${warnings.length}`, moderator: interaction.user, target: user, reason, delivery });
    const failed = deliveries.filter(result => !result.ok);
    return sendPrivate(interaction, `⚠️ Saved warning **#${warnings.length}** for **${user.tag}**. Reason: ${reason}\n${failed.length ? `Could not DM ${failed.map(result => `<@${result.id}>`).join(', ')} (DMs may be closed).` : 'Warning DM sent to the member.'}`);
  }

  if (action === 'warnings') {
    const warnings = listWarnings(interaction.guildId, user.id);
    if (warnings.length === 0) return sendPrivate(interaction, `**${user.tag}** has no saved warnings.`);
    const description = warnings.slice(-10).map((warning, index, recent) => {
      const number = warnings.length - recent.length + index + 1;
      const date = new Date(warning.createdAt).toLocaleDateString('en-GB');
      return `**#${number}** · ${date} · <@${warning.moderatorId}>\n${warning.reason}`;
    }).join('\n\n');
    const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle(`Warnings for ${user.tag}`).setDescription(description).setFooter({ text: `${warnings.length} warning(s) total · showing the latest 10` });
    return interaction.editReply({ embeds: [embed] });
  }
}


return {handleModeration,checkTargetHierarchy};
};
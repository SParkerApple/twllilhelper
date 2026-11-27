const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const c = require('../config.json');
function payload() {
  return { embeds: [new EmbedBuilder().setColor(0x3498db).setTitle('Welcome to The Western Line')
    .setDescription("Welcome to our London-inspired FiveM roleplay community. Take a shift with the emergency services or build your own civilian story.\n\n**1. Get access**\nRead <#1566162986014478437>, then press Verify in <#1570764088101965834>. Check Discord announcements for sessions and department information.\n\n**2. Join in FiveM**\nInstall FiveM on a PC with GTA V and open FiveM. Press **Join FiveM Server** below, or press **F8** in FiveM and enter:\n```connect cfx.re/join/vqqgxbx```\n\n**3. Choose your role**\nWe use FiveM for gameplay, Discord for community roles and support, and a CAD for linked roleplay records and operations.\nChoose Metropolitan Police Service (MET), London Ambulance Service (LAS), London Fire Brigade (LFB), or Civilian when you load in. Service players select a callsign and go on duty before spawning; civilians go straight to spawn selection. Follow your department’s guidance and training requirements.\n\n**4. Link your CAD account**\nRun these commands in this order:\n**In-game:** `/link` to begin connecting to the CAD.\n**In Discord:** `/linkme` and follow the prompts.\n**Then in Discord:** `/sync` to sync your account.\n\n**5. Use the website**\nPress **Visit Our Website** for server information and the member portal. Sign in to the portal with Discord to see your server roles and member tools.\n\n**Need help?**\nOpen a ticket in <#1570764465304117248>. Use `/bugreport` for in-game bugs and `/suggestion` for ideas. Please use tickets rather than pinging ownership.")],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Join FiveM Server').setURL('https://cfx.re/join/vqqgxbx'),
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Visit Our Website').setURL('https://thewesternlinerp.github.io/TWLWeb/western-line-portal/docs/'))],
    allowedMentions: { parse: [] } };
}
async function publish(guild, db) {
  const channel = await guild.channels.fetch(c.channels.gettingStarted);
  const id = db.getGuildConfig(guild.id).gettingStartedPanelId;
  let message = id ? await channel.messages.fetch(id).catch(e => { if (e.code === 10008) return null; throw e; }) : null;
  if (!message) {
    const recent = await channel.messages.fetch({ limit: 100 });
    message = recent.find(m => m.author.id === guild.client.user.id && m.embeds.some(e => e.title === 'Welcome to The Western Line'));
  }
  if (message) await message.edit(payload()); else message = await channel.send(payload());
  await db.editGuildConfig(guild.id, g => ({ ...g, gettingStartedPanelId: message.id }));
  return message;
}
module.exports = { payload, publish };

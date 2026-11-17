const {SlashCommandBuilder:S,InteractionContextType}=require('discord.js');
const c=require('../config.json');
const {commands}=require('./base-commands');
const text=(s,n,d,required=true,max=1000)=>s.addStringOption(o=>o.setName(n).setDescription(d).setRequired(required).setMaxLength(max));
for(const [name,a]of Object.entries(c.announcements)){const cmd=new S().setName(name).setDescription('Post to '+a.label+'.');text(cmd,'message','Announcement text',true,4000);text(cmd,'title','Optional heading',false,256);commands.push(cmd);}
commands.push(new S().setName('suggestion').setDescription('Suggest an improvement for The Western Line.'));
commands.push(new S().setName('bugreport').setDescription('Report an in-game bug to the Developers.'));
const types=[{name:'General / in-game support',value:'support'},{name:'Player report',value:'report'},{name:'Punishment appeal',value:'appeal'},{name:'Developer / technical help',value:'developer'}];
const ticket=new S().setName('ticket').setDescription('FiveM support tickets.');
ticket.addSubcommand(s=>s.setName('open').setDescription('Open a private ticket.').addStringOption(o=>o.setName('type').setDescription('What do you need help with?').setRequired(true).addChoices(...types)));
ticket.addSubcommand(s=>s.setName('panel').setDescription('Publish or refresh the support panel.'));
ticket.addSubcommand(s=>text(s.setName('transfer').setDescription('Transfer this ticket along the Chain of Command.').addStringOption(o=>o.setName('destination').setDescription('Destination team').setRequired(true).addChoices(...Object.keys(c.categories).map(x=>({name:x,value:x})))),'reason','Why the ticket is being transferred'));
for(const action of ['claim','transcript','reopen'])ticket.addSubcommand(s=>s.setName(action).setDescription(action+' this ticket.'));
ticket.addSubcommand(s=>text(s.setName('close').setDescription('Save a transcript and close this ticket.'),'reason','Resolution or reason'));
for(const action of ['add','remove'])ticket.addSubcommand(s=>text(s.setName(action).setDescription(action+' a participant.').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)),'reason','Reason'));
commands.push(ticket,new S().setName('verify').setDescription('Publish or refresh the verification panel.'),new S().setName('status').setDescription('Show bot connection and uptime.'),new S().setName('safeguard').setDescription('Review observable account risk indicators.').addSubcommand(s=>s.setName('scan').setDescription('Scan current members for recent accounts.')));
commands.push(text(new S().setName('say').setDescription('Send a staff message without mentions.'),'message','Message',true,2000));
module.exports={commands:commands.map(x=>x.setContexts(InteractionContextType.Guild)),types};

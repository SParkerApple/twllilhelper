require('dotenv').config();
const {REST,Routes}=require('discord.js');const c=require('../config.json');
async function register(token=process.env.DISCORD_TOKEN){if(!token)throw Error('DISCORD_TOKEN is required');const body=require('./commands').commands.map(c=>c.toJSON());await new REST({version:'10'}).setToken(token).put(Routes.applicationGuildCommands(c.clientId,c.guildId),{body});console.log(`Registered ${body.length} guild commands.`);}
module.exports={register};if(require.main===module)register().catch(e=>{console.error(e.message);process.exitCode=1;});

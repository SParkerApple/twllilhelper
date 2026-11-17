const c=require('../config.json');
async function assignJoinRoles(member){
  if(member.guild.id!==c.guildId||member.user.bot)return;
  // Single-role additions preserve roles assigned concurrently by other bots/staff.
  const failures=[];
  for(const id of c.joinRoleIds||[]){
    try{const role=await member.guild.roles.fetch(id);if(!role||role.managed||!role.editable)throw Error('Role missing or above bot');await member.roles.add(id,'Automatic FiveM starter role on joining');}
    catch(e){failures.push(`${id}: ${e.code||e.message}`);}
  }
  if(failures.length)throw Error('Starter role assignment failed: '+failures.join('; '));
}
module.exports={assignJoinRoles};

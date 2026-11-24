const c=require('../config.json');
async function assignVerificationRoles(member){
  if(member.guild.id!==c.guildId||member.user.bot)return;
  // Single-role additions preserve roles assigned concurrently by other bots/staff.
  const failures=[];
  const rankedMET=(c.metConstableAndAboveRoleIds||[]).some(id=>member.roles.cache.has(id));
  for(const id of c.verificationRoleIds||[]){
    if(id==='1566155180725244096'&&rankedMET)continue;
    try{const role=await member.guild.roles.fetch(id);if(!role||role.managed||!role.editable)throw Error('Role missing or above bot');await member.roles.add(id,'FiveM starter role on verification');}
    catch(e){failures.push(`${id}: ${e.code||e.message}`);}
  }
  if(failures.length)throw Error('Starter role assignment failed: '+failures.join('; '));
}
module.exports={assignVerificationRoles};

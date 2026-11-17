const c=require('../config.json');
const has=(member,ids)=>ids.some(id=>member?.roles?.cache?.has(id));
const isFullAccess=m=>has(m,c.management);
const staffLevel=m=>has(m,c.management)?100:has(m,['1566156669463822377'])?3:has(m,c.support)?1:0;
const policy=()=>({staffRoleLevels:Object.fromEntries([...c.management.map(id=>[id,100]),...c.support.map(id=>[id,id==='1566156669463822377'?3:1])])});
const bypass=m=>has(m,[...c.ownership,...c.developers]);
function routeRoles(route){return route==='support'?[...c.support,...c.management,...c.developers]:route==='management'?[...c.management,...c.developers]:route==='ownership'?[...c.ownership,...c.developers]:[...c.developers,...c.ownership];}
const canWorkTicket=(m,t)=>has(m,routeRoles(t.route));
function canTransfer(m,from,to){if(!Object.hasOwn(c.categories,to)||from===to)return false;if(bypass(m))return true;if(!canWorkTicket(m,{route:from}))return false;return (from==='support'&&to==='management')||(from==='management'&&to==='ownership');}
function canAnnounce(m,name){return Boolean(c.announcements[name]&&has(m,c.announcements[name].roles));}
module.exports={has,isFullAccess,staffLevel,policy,bypass,routeRoles,canWorkTicket,canTransfer,canAnnounce};

const fs=require('node:fs/promises'),path=require('node:path');
const directory=path.resolve(process.env.DATA_DIR||path.join(__dirname,'../data'));
let state={guilds:{},warnings:{}},queue=Promise.resolve(),failure=null;
let failureHandler=e=>{console.error('Persistence failed:',e.message);process.exit(1);};
async function loadDatabase(){await fs.mkdir(directory,{recursive:true});try{state=JSON.parse(await fs.readFile(path.join(directory,'settings.json'),'utf8'));if(!state.guilds||!state.warnings)throw Error('Invalid database format');}catch(e){if(e.code!=='ENOENT')throw e;}}
function assertDatabaseReady(){if(failure)throw failure;}
function saveDatabase(){assertDatabaseReady();const snapshot=JSON.stringify(state,null,2);queue=queue.then(async()=>{const file=path.join(directory,'settings.json');await fs.writeFile(file+'.tmp',snapshot);await fs.rename(file+'.tmp',file);});queue.catch(e=>{if(!failure){failure=e;failureHandler(e);}});return queue;}
const getGuildConfig=id=>{assertDatabaseReady();return state.guilds[id]||{};};
const editGuildConfig=(id,fn)=>{assertDatabaseReady();state.guilds[id]=fn(getGuildConfig(id));return saveDatabase();};
const listWarnings=(g,u)=>state.warnings[`${g}:${u}`]||[];
async function addWarning(g,u,w){assertDatabaseReady();state.warnings[`${g}:${u}`]=[...listWarnings(g,u),w];await saveDatabase();return listWarnings(g,u);}
const guildWarningRecords=g=>Object.entries(state.warnings).filter(([k])=>k.startsWith(g+':')).flatMap(([k,ws])=>ws.map((w,i)=>({...w,userId:k.slice(g.length+1),warningNumber:i+1})));
module.exports={directory,loadDatabase,getGuildConfig,editGuildConfig,saveDatabase,assertDatabaseReady,listWarnings,addWarning,guildWarningRecords,closeDatabase:()=>queue,setDatabaseFailureHandler:fn=>{failureHandler=fn;}};

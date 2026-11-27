const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {Collection}=require('discord.js');
const {createArchive}=require('../src/ticket-archive');
test('archive pages through all messages and preserves embeds, replies and binary attachment parts',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'twl-archive-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const binary=Buffer.alloc(2300,42),calls=[];
 const messages=Array.from({length:205},(_,n)=>({id:String(1000-n),author:{id:'person',username:'Member'},content:'Message '+n,createdAt:new Date(0),reference:{messageId:'reply'},embeds:[{toJSON:()=>({description:'Embed text'})}],components:[],attachments:new Collection(n===0?[['file',{id:'file',name:'evidence.bin',url:'https://cdn.discordapp.com/attachments/test/evidence.bin'}]]:[])}));
 const channel={id:'ticket',messages:{fetch:async options=>{calls.push(options);const start=options.before?messages.findIndex(m=>m.id===options.before)+1:0;return new Collection(messages.slice(start,start+100).map(m=>[m.id,m]));}}};
 const archive=createArchive({root,limit:1000,download:async()=>({ok:true,body:[binary]})});const manifest=await archive.capture(channel,{ownerId:'owner'});
 assert.equal(manifest.messageCount,205);assert.equal(calls.length,3);assert.equal(manifest.latestMessageId,'1000');
 const dir=path.join(root,'transcripts','ticket');const text=Buffer.concat(await Promise.all(manifest.files.filter(n=>n.endsWith('.txt')).map(n=>fs.readFile(path.join(dir,n))))).toString();
 assert.match(text,/Message 204/);assert.match(text,/Embed text/);assert.match(text,/"messageId":"reply"/);
 const pieces=manifest.files.filter(n=>n.endsWith('.part'));assert.equal(pieces.length,3);assert.deepEqual(Buffer.concat(await Promise.all(pieces.map(n=>fs.readFile(path.join(dir,n))))),binary);
 for(const name of manifest.files)assert.ok((await fs.stat(path.join(dir,name))).size<=1000);
 let sent=0;await archive.deliver({send:async()=>{sent++;}},manifest,'Transcript',2);assert.equal(sent,manifest.files.length-2);
});
test('failed attachment capture does not produce a completed manifest',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'twl-archive-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const archive=createArchive({root,download:async()=>({ok:false,status:503})});const m={id:'1',content:'message',attachments:new Collection([['a',{id:'a',url:'https://cdn.discordapp.com/a',name:'a'}]])};
 await assert.rejects(archive.capture({id:'ticket',messages:{fetch:async()=>new Collection([['1',m]])}},{}),/503/);
 await assert.rejects(fs.access(path.join(root,'transcripts/ticket/manifest.json')));
});
test('failed setup task does not block other tasks and retries only failures',async()=>{
 let fail=true;const calls=[];const retry=require('../src/setup-recovery').createSetupRecovery({tickets:async()=>{calls.push('tickets');if(fail)throw Error('Missing channel');},panel:async()=>calls.push('panel')},()=>{});
 await retry();fail=false;await retry();await retry();assert.deepEqual(calls,['tickets','panel','tickets']);
});
test('getting started panel includes supplied links and the CAD command sequence',()=>{
 const p=require('../src/getting-started').payload();const links=p.components[0].toJSON().components;assert.equal(links[0].url,'https://cfx.re/join/vqqgxbx');assert.equal(links[1].url,'https://thewesternlinerp.github.io/TWLWeb/western-line-portal/docs/');const text=p.embeds[0].toJSON().description;
 assert.ok(text.indexOf('`/link`')<text.indexOf('`/linkme`'));assert.ok(text.indexOf('`/linkme`')<text.indexOf('`/sync`'));assert.ok(text.length<=4096);
});

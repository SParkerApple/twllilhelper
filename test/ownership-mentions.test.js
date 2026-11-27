const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../config.json');
const { remindOwnershipMention } = require('../src/ownership-mentions');
function fixture(roleIds = []) {
  const replies = [];
  const message = {
    guildId: c.guildId, author: { id: 'sender', bot: false }, member: { roles: { cache: new Map() } },
    mentions: { roles: new Map(), users: new Map([['person', {}]]) },
    guild: { members: { fetch: async () => ({ roles: { cache: new Map(roleIds.map(id => [id, {}])) } }) } },
    reply: async payload => replies.push(payload),
  };
  return { message, replies };
}
test('mentions of either ownership rank produce one ticket reminder without pinging anyone', async () => {
  for (const role of c.ownership) {
    const f = fixture([role]);
    f.message.mentions.users.set('another', {});
    await remindOwnershipMention(f.message);
    assert.equal(f.replies.length, 1);
    assert.match(f.replies[0].content, /<#1570764465304117248>/);
    assert.deepEqual(f.replies[0].allowedMentions, { parse: [], repliedUser: false });
  }
});
test('direct ownership role mentions are covered', async () => {
  for (const role of c.ownership) {
    const f = fixture(); f.message.mentions.users.clear(); f.message.mentions.roles.set(role, {});
    await remindOwnershipMention(f.message); assert.equal(f.replies.length, 1);
  }
});
test('ordinary mentions, bot/webhook messages and other servers are ignored', async () => {
  for (const patch of [{}, { author: { bot: true } }, { webhookId: 'webhook' }, { guildId: 'other' }]) {
    const f = fixture(Object.keys(patch).length ? c.ownership : [c.management[0]]);
    Object.assign(f.message, patch); await remindOwnershipMention(f.message); assert.equal(f.replies.length, 0);
  }
});
test('a departed mentioned user does not prevent checking the next member', async () => {
  const f = fixture(c.ownership); f.message.mentions.users.set('second', {});
  const fetch = f.message.guild.members.fetch;
  f.message.guild.members.fetch = id => id === 'person' ? Promise.reject({ code: 10007 }) : fetch(id);
  await remindOwnershipMention(f.message); assert.equal(f.replies.length, 1);
});

test('Management, Co-Owner and Owner senders are exempt from direct and reply reminders',async()=>{for(const role of c.management){const f=fixture(c.ownership);f.message.member.roles.cache.set(role,{});f.message.reference={messageId:'original'};f.message.mentions.repliedUser={id:'person'};await remindOwnershipMention(f.message);assert.equal(f.replies.length,0);}});
test('reply pings to ownership include the illustrated toggle instructions',async()=>{const f=fixture(c.ownership);f.message.reference={messageId:'original'};f.message.mentions.repliedUser={id:'person'};await remindOwnershipMention(f.message);assert.match(f.replies[0].content,/@ OFF/);assert.ok(f.replies[0].embeds[0].toJSON().image.url);assert.equal(f.replies[0].allowedMentions.repliedUser,false);});
test('replies with ping already off do not trigger a reminder',async()=>{const f=fixture(c.ownership);f.message.reference={messageId:'original'};f.message.mentions.repliedUser={id:'person'};f.message.mentions.users.clear();await remindOwnershipMention(f.message);assert.equal(f.replies.length,0);});
test('replying to a non-owner while mentioning ownership does not show misleading reply instructions',async()=>{const f=fixture(c.ownership);f.message.reference={messageId:'original'};f.message.mentions.repliedUser={id:'non-owner'};await remindOwnershipMention(f.message);assert.equal(f.replies.length,1);assert.equal(f.replies[0].embeds,undefined);});

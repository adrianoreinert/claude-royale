// Renomeia categorias/canais para inglês (mundial) e reposta welcome/regras/anúncio.
// Uso: DISCORD_TOKEN='...' node discord/update-english.mjs
import { readFileSync } from 'node:fs';

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) { console.error('faltou DISCORD_TOKEN'); process.exit(1); }
const API = 'https://discord.com/api/v10';
const H = { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(API + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 429) { const j = await res.json(); await sleep((j.retry_after ?? 1) * 1000 + 250); continue; }
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }
  throw new Error('rate limit em ' + path);
}

const guild = (await api('GET', '/users/@me/guilds')).find((g) => /claude royale/i.test(g.name));
const GID = guild.id;
const chans = await api('GET', `/guilds/${GID}/channels`);
const byName = (n) => chans.find((c) => c.name === n || c.name === n.toLowerCase());

// Renomeações (nome antigo -> novo)
const renames = [
  ['INFORMAÇÕES', 'INFORMATION'],
  ['JOGO', 'GAME'],
  ['DESENVOLVIMENTO', 'DEVELOPMENT'],
  ['clips-vitorias', 'clips-and-wins'],
];
for (const [oldN, newN] of renames) {
  const c = byName(oldN);
  if (c) { await api('PATCH', `/channels/${c.id}`, { name: newN }); console.log(`~ ${oldN} -> ${newN}`); await sleep(400); }
}

// Tópicos em inglês
const topics = {
  'welcome-rules': 'Welcome and server rules',
  'announcements': 'Claude Royale news and updates',
  'general': 'General chat about the game',
  'find-a-match': 'Set up 1v1 matches (use a private room code)',
  'clips-and-wins': 'Share your best plays',
  'bug-reports': 'Found a bug? tell us here',
  'suggestions': 'Ideas for cards, modes and improvements',
  'dev-updates': 'Behind the scenes of development',
};
for (const [name, topic] of Object.entries(topics)) {
  const c = byName(name);
  if (c) { await api('PATCH', `/channels/${c.id}`, { topic }); await sleep(300); }
}
console.log('topicos atualizados');

// Substitui as mensagens: apaga as do bot e reposta em inglês
const me = await api('GET', '/users/@me');
async function replace(channelName, contents) {
  const c = byName(channelName);
  if (!c) return;
  const msgs = await api('GET', `/channels/${c.id}/messages?limit=50`);
  for (const m of msgs.filter((m) => m.author.id === me.id)) {
    await api('DELETE', `/channels/${c.id}/messages/${m.id}`); await sleep(350);
  }
  for (const content of contents) { await api('POST', `/channels/${c.id}/messages`, { content }); await sleep(400); }
  console.log(`# ${channelName}: repostado (${contents.length})`);
}

await replace('welcome-rules', [readFileSync('discord/welcome.md', 'utf8'), readFileSync('discord/rules.md', 'utf8')]);
await replace('announcements', ['🎉 **Claude Royale is live!** Play now at https://clauderoyale.net — grab a friend for a 1v1. 👑']);

console.log('\\nServidor agora em inglês (mundial).');

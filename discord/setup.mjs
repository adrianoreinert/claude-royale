// Cria categorias, canais e posta welcome + regras no servidor Claude Royale.
// Uso: DISCORD_TOKEN='...' node discord/setup.mjs
import { readFileSync } from 'node:fs';

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) { console.error('faltou DISCORD_TOKEN'); process.exit(1); }
const API = 'https://discord.com/api/v10';
const H = { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(API + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 429) {
      const j = await res.json();
      const wait = (j.retry_after ?? 1) * 1000 + 250;
      console.log(`  rate-limited, aguardando ${Math.round(wait)}ms`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }
  throw new Error('rate limit persistente em ' + path);
}

// 1) Descobre o servidor do bot
const guilds = await api('GET', '/users/@me/guilds');
if (!guilds.length) { console.error('bot nao esta em nenhum servidor — autorize o convite primeiro'); process.exit(1); }
const guild = guilds.find((g) => /claude royale/i.test(g.name)) ?? guilds[0];
console.log(`Servidor: ${guild.name} (${guild.id})`);

const GID = guild.id;
const existing = await api('GET', `/guilds/${GID}/channels`);
const findByName = (n) => existing.find((c) => c.name === n);

async function ensureChannel({ name, type, parent_id, topic }) {
  const hit = findByName(name);
  if (hit) { console.log(`  = ${name} (ja existe)`); return hit; }
  const ch = await api('POST', `/guilds/${GID}/channels`, { name, type, parent_id, topic });
  console.log(`  + ${name}`);
  existing.push(ch);
  await sleep(400);
  return ch;
}

// 2) Categorias
const catInfo = await ensureChannel({ name: 'INFORMAÇÕES', type: 4 });
const catGame = await ensureChannel({ name: 'JOGO', type: 4 });
const catDev = await ensureChannel({ name: 'DESENVOLVIMENTO', type: 4 });

// 3) Canais de texto
const chWelcome = await ensureChannel({ name: 'welcome-rules', type: 0, parent_id: catInfo.id, topic: 'Boas-vindas e regras do servidor' });
const chAnnounce = await ensureChannel({ name: 'announcements', type: 0, parent_id: catInfo.id, topic: 'Novidades e atualizacoes do Claude Royale' });
await ensureChannel({ name: 'general', type: 0, parent_id: catGame.id, topic: 'Papo geral sobre o jogo' });
await ensureChannel({ name: 'find-a-match', type: 0, parent_id: catGame.id, topic: 'Marque partidas 1v1 (use codigo de sala privada)' });
await ensureChannel({ name: 'clips-vitorias', type: 0, parent_id: catGame.id, topic: 'Poste suas melhores jogadas' });
await ensureChannel({ name: 'bug-reports', type: 0, parent_id: catDev.id, topic: 'Achou um bug? conte aqui' });
await ensureChannel({ name: 'suggestions', type: 0, parent_id: catDev.id, topic: 'Ideias de cartas, modos e melhorias' });
await ensureChannel({ name: 'dev-updates', type: 0, parent_id: catDev.id, topic: 'Bastidores do desenvolvimento' });

// 4) Mensagens
async function postOnce(channel, content, marker) {
  const msgs = await api('GET', `/channels/${channel.id}/messages?limit=20`);
  if (msgs.some((m) => m.content.includes(marker))) { console.log(`  = mensagem em #${channel.name} ja postada`); return; }
  await api('POST', `/channels/${channel.id}/messages`, { content });
  console.log(`  + mensagem em #${channel.name}`);
  await sleep(400);
}

const welcome = readFileSync('discord/welcome.md', 'utf8');
const rules = readFileSync('discord/rules.md', 'utf8');
await postOnce(chWelcome, welcome, 'Bem-vindo ao Claude Royale');
await postOnce(chWelcome, rules, 'Regras do servidor');
await postOnce(chAnnounce, '🎉 **Claude Royale está no ar!** Jogue agora em https://clauderoyale.net — e chame um amigo para o 1v1. 👑', 'Claude Royale está no ar');

console.log('\\nPronto! Servidor montado.');

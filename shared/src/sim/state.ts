import {
  COUNTDOWN_SECONDS, DEPLOY_MAX_X_LEFT, DEPLOY_MIN_X_RIGHT, DEPLOY_SECONDS,
  ELIXIR_MAX, ELIXIR_START, GRID_H, GRID_W, HAND_SIZE, KING_TOWER, LEFT_KING_POS,
  LEFT_PRINCESS_POS, PRINCESS_TOWER, UNIT_RADIUS, mirrorX,
} from '../constants';
import { DEFAULT_DECK, getCard, levelMultiplier } from '../cards';
import type { CardDef } from '../engine/model';
import type { PlayerSim, Side, SimEntity, SimState, TowerKind } from '../types';

export function createInitialState(): SimState {
  const state: SimState = {
    tick: 0,
    time: 0,
    phase: 'waiting',
    timeRemaining: COUNTDOWN_SECONDS,
    suddenDeath: false,
    tiebreaker: false,
    players: {
      left: createPlayer('left'),
      right: createPlayer('right'),
    },
    entities: {},
    nextEntityId: 1,
    events: [],
  };
  spawnTowers(state, 'left');
  spawnTowers(state, 'right');
  return state;
}

function createPlayer(side: Side): PlayerSim {
  const deck = shuffle([...DEFAULT_DECK]);
  return {
    side,
    elixir: ELIXIR_START,
    crowns: 0,
    hand: deck.slice(0, HAND_SIZE),
    queue: deck.slice(HAND_SIZE),
  };
}

/** Substitui o deck de um jogador (antes da batalha começar). */
export function setPlayerDeck(
  state: SimState,
  side: Side,
  deckIds: string[],
  cardLevels?: Record<string, number>,
): void {
  const deck = shuffle([...deckIds]);
  const player = state.players[side];
  player.hand = deck.slice(0, HAND_SIZE);
  player.queue = deck.slice(HAND_SIZE);
  player.cardLevels = cardLevels;
}

function spawnTowers(state: SimState, side: Side): void {
  const flip = (x: number) => (side === 'left' ? x : mirrorX(x));
  addTower(state, side, 'king', flip(LEFT_KING_POS.x), LEFT_KING_POS.y);
  for (const pos of LEFT_PRINCESS_POS) {
    addTower(state, side, 'princess', flip(pos.x), pos.y);
  }
}

function addTower(state: SimState, side: Side, tower: TowerKind, x: number, y: number): void {
  const stats = tower === 'king' ? KING_TOWER : PRINCESS_TOWER;
  const entity: SimEntity = {
    id: `e${state.nextEntityId++}`,
    kind: 'tower',
    side, tower, x, y,
    hp: stats.hp,
    maxHp: stats.hp,
    dormant: tower === 'king',
    attackCooldown: 0,
    action: 'idle',
    facing: side === 'left' ? 1 : -1,
  };
  state.entities[entity.id] = entity;
}

export interface PlayCardResult {
  ok: boolean;
  error?: string;
}

/** Custo efetivo de uma carta na mão (Espelho = última carta + 1). */
export function effectiveCost(player: PlayerSim, cardId: string): number | null {
  const card = getCard(cardId);
  if (!card) return null;
  if (card.type !== 'mirror') return card.cost;
  const last = player.lastPlayed ? getCard(player.lastPlayed) : undefined;
  if (!last || last.type === 'mirror') return null;
  return Math.min(ELIXIR_MAX, last.cost + 1);
}

/** Joga uma carta da mão em (x, y). Valida fase, custo, mão e zona de deploy. */
export function playCard(state: SimState, side: Side, cardId: string, x: number, y: number): PlayCardResult {
  if (state.phase !== 'battle') return { ok: false, error: 'batalha não está em andamento' };

  const player = state.players[side];
  const card = getCard(cardId);
  if (!card || card.hidden) return { ok: false, error: 'carta desconhecida' };
  if (!player.hand.includes(cardId)) return { ok: false, error: 'carta fora da mão' };

  const cost = effectiveCost(player, cardId);
  if (cost === null) return { ok: false, error: 'espelho sem carta anterior' };
  if (player.elixir < cost) return { ok: false, error: 'elixir insuficiente' };

  // Espelho executa a última carta jogada.
  const effective = card.type === 'mirror' ? getCard(player.lastPlayed!)! : card;

  const gx = clamp(x, 0.5, GRID_W - 0.5);
  const gy = clamp(y, 0.5, GRID_H - 0.5);

  if (effective.type === 'troop' || effective.type === 'building' || effective.type === 'champion') {
    const inOwnSide = side === 'left' ? gx <= DEPLOY_MAX_X_LEFT : gx >= DEPLOY_MIN_X_RIGHT;
    if (!inOwnSide) return { ok: false, error: 'fora da zona de deploy' };
    if (effective.type === 'champion') {
      const alreadyOnField = Object.values(state.entities).some(
        (e) => e.side === side && e.cardId === effective.id && e.hp > 0,
      );
      if (alreadyOnField) return { ok: false, error: 'campeão já está em campo' };
    }
    if (effective.type === 'building') {
      placeBuilding(state, side, effective, gx, gy);
    } else {
      // Evolução: cada `cyclesRequired` usos carregam a forma evoluída.
      const evolution = effective.components.evolution;
      let evolved = false;
      if (evolution) {
        player.playCounts ??= {};
        const charge = player.playCounts[effective.id] ?? 0;
        if (charge >= evolution.cyclesRequired) {
          evolved = true;
          player.playCounts[effective.id] = 0;
        } else {
          player.playCounts[effective.id] = charge + 1;
        }
      }
      spawnUnits(state, side, effective.id, gx, gy, undefined, evolved);
    }
  } else if (effective.components.spell) {
    castSpell(state, side, effective, gx, gy);
  }

  player.elixir -= cost;
  if (card.type !== 'mirror') player.lastPlayed = cardId;
  cycleHand(player, cardId);
  return { ok: true };
}

function cycleHand(player: PlayerSim, cardId: string): void {
  const idx = player.hand.indexOf(cardId);
  const next = player.queue.shift();
  if (next !== undefined) {
    player.hand[idx] = next;
    player.queue.push(cardId);
  }
}

/** Invoca as unidades de uma carta em torno de (x, y). Usado também por spawners e morte. */
export function spawnUnits(
  state: SimState,
  side: Side,
  cardId: string,
  x: number,
  y: number,
  countOverride?: number,
  evolved = false,
): void {
  const card = getCard(cardId);
  const c = card?.components;
  if (!card || !c?.health || !c.movement || !c.targeting) return;
  const count = countOverride ?? card.deployCount ?? 1;
  const level = state.players[side].cardLevels?.[cardId] ?? 1;
  const hpMultiplier =
    (evolved ? (c.evolution?.multipliers?.hp ?? 1) : 1) * levelMultiplier(level);
  const bonusShield = evolved ? (c.evolution?.bonusShield ?? 0) : 0;
  // Dispersão de geração: espalha unidades múltiplas em torno do ponto.
  const offsets = [
    { x: 0, y: 0 }, { x: 0, y: -0.8 }, { x: 0, y: 0.8 },
    { x: -0.8, y: 0 }, { x: 0.8, y: 0 }, { x: -0.8, y: -0.8 },
    { x: 0.8, y: 0.8 }, { x: -0.8, y: 0.8 }, { x: 0.8, y: -0.8 },
    { x: 0, y: -1.6 }, { x: 0, y: 1.6 }, { x: -1.6, y: 0 },
  ];
  for (let i = 0; i < count; i++) {
    const off = offsets[i % offsets.length];
    const entity: SimEntity = {
      id: `e${state.nextEntityId++}`,
      kind: 'unit',
      side,
      cardId,
      x: clamp(x + off.x, 0.5, GRID_W - 0.5),
      y: clamp(y + off.y, 0.5, GRID_H - 0.5),
      hp: Math.round(c.health.hp * hpMultiplier),
      maxHp: Math.round(c.health.hp * hpMultiplier),
      shield: (c.health.shield ?? 0) + bonusShield || undefined,
      attackCooldown: 0,
      action: 'idle',
      facing: side === 'left' ? 1 : -1,
      flying: c.movement.flying === true,
      spawnCooldown: c.spawner?.interval,
      walked: 0,
      abilityCooldown: c.ability ? 0 : undefined,
      evolved: evolved || undefined,
      level: level > 1 ? level : undefined,
      deployingUntil: state.time + DEPLOY_SECONDS,
    };
    state.entities[entity.id] = entity;
  }
  applyDeployEffect(state, side, card, x, y);
  state.events.push({ type: 'spawn', x, y, cardId, side });
}

function placeBuilding(state: SimState, side: Side, card: CardDef, x: number, y: number): void {
  const c = card.components;
  if (!c.health || !c.lifetime) return;
  const level = state.players[side].cardLevels?.[card.id] ?? 1;
  const hp = Math.round(c.health.hp * levelMultiplier(level));
  const entity: SimEntity = {
    id: `e${state.nextEntityId++}`,
    kind: 'building',
    side,
    cardId: card.id,
    x, y,
    hp,
    maxHp: hp,
    shield: c.health.shield,
    attackCooldown: 0,
    action: 'idle',
    facing: side === 'left' ? 1 : -1,
    lifetime: c.lifetime.seconds,
    spawnCooldown: c.spawner?.interval,
    elixirCooldown: c.resource?.elixirInterval,
    level: level > 1 ? level : undefined,
  };
  state.entities[entity.id] = entity;
  applyDeployEffect(state, side, card, x, y);
  state.events.push({ type: 'spawn', x, y, cardId: card.id, side });
}

/** Gatilho onDeploy: dano de implantação em área. */
function applyDeployEffect(state: SimState, side: Side, card: CardDef, x: number, y: number): void {
  const effect = card.components.deployEffect;
  if (!effect) return;
  state.events.push({ type: 'areaDamage', x, y, radius: effect.radius });
  for (const entity of Object.values(state.entities)) {
    if (entity.side === side || entity.hp <= 0 || entity.kind === 'zone') continue;
    const d = Math.hypot(entity.x - x, entity.y - y);
    if (d <= effect.radius + UNIT_RADIUS) {
      applyDamage(state, entity, effect.damage);
    }
  }
}

/** Aplica dano respeitando escudo. Retorna o dano efetivamente causado. */
export function applyDamage(state: SimState, target: SimEntity, amount: number): number {
  let remaining = amount;
  if (target.shield !== undefined && target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }
  target.hp -= remaining;
  state.events.push({ type: 'hit', x: target.x, y: target.y, ranged: true, amount });
  return amount;
}

/**
 * Ativa a habilidade do campeão vivo do jogador (gatilho onAbility).
 * Valida elixir, recarga e presença em campo.
 */
export function useAbility(state: SimState, side: Side): PlayCardResult {
  if (state.phase !== 'battle') return { ok: false, error: 'batalha não está em andamento' };
  const champion = Object.values(state.entities).find((e) => {
    if (e.side !== side || e.kind !== 'unit' || e.hp <= 0 || !e.cardId) return false;
    return getCard(e.cardId)?.type === 'champion';
  });
  if (!champion) return { ok: false, error: 'nenhum campeão em campo' };

  const ability = getCard(champion.cardId!)!.components.ability!;
  if ((champion.abilityCooldown ?? 0) > 0) return { ok: false, error: 'habilidade em recarga' };
  const player = state.players[side];
  if (player.elixir < ability.cost) return { ok: false, error: 'elixir insuficiente' };

  player.elixir -= ability.cost;
  champion.abilityCooldown = ability.cooldownSeconds;

  const effect = ability.effect;
  if (effect.shieldGain) champion.shield = (champion.shield ?? 0) + effect.shieldGain;
  if (effect.rageSelfSeconds) champion.ragedUntil = state.time + effect.rageSelfSeconds;
  if (effect.healSelf) champion.hp = Math.min(champion.maxHp, champion.hp + effect.healSelf);
  if (effect.damage && effect.radius) {
    for (const entity of Object.values(state.entities)) {
      if (entity.side === side || entity.hp <= 0 || entity.kind === 'zone') continue;
      const d = Math.hypot(entity.x - champion.x, entity.y - champion.y);
      if (d <= effect.radius + UNIT_RADIUS) applyDamage(state, entity, effect.damage);
    }
    state.events.push({ type: 'areaDamage', x: champion.x, y: champion.y, radius: effect.radius });
  }
  state.events.push({ type: 'ability', x: champion.x, y: champion.y, cardId: champion.cardId!, side });
  return { ok: true };
}

function castSpell(state: SimState, side: Side, card: CardDef, x: number, y: number): void {
  const spell = card.components.spell!;
  const { radius } = spell;
  const spellMultiplier = levelMultiplier(state.players[side].cardLevels?.[card.id]);

  const inRadius = Object.values(state.entities).filter(
    (e) => e.kind !== 'zone' && Math.hypot(e.x - x, e.y - y) <= radius + 0.4,
  );
  const enemies = inRadius.filter((e) => e.side !== side);

  // Relâmpago: só os N inimigos de maior vida.
  const damageTargets = spell.multiTargetCount
    ? [...enemies].sort((a, b) => b.hp - a.hp).slice(0, spell.multiTargetCount)
    : enemies;

  for (const entity of damageTargets) {
    if (spell.damage && spell.damage > 0) {
      applyDamage(state, entity, Math.round(spell.damage * spellMultiplier));
    }
    if (spell.stunSeconds) entity.stunnedUntil = state.time + spell.stunSeconds;
  }
  if (spell.freezeSeconds) {
    for (const entity of enemies) entity.frozenUntil = state.time + spell.freezeSeconds;
  }
  if (spell.rageSeconds) {
    for (const entity of inRadius) {
      if (entity.side === side && entity.kind === 'unit') {
        entity.ragedUntil = state.time + spell.rageSeconds;
      }
    }
  }
  if (spell.spawn) {
    spawnUnits(state, side, spell.spawn.cardId, x, y, spell.spawn.count);
  }
  if (spell.zone) {
    const zone: SimEntity = {
      id: `e${state.nextEntityId++}`,
      kind: 'zone',
      side,
      cardId: card.id,
      x, y,
      hp: 1,
      maxHp: 1,
      attackCooldown: 0,
      action: 'idle',
      facing: 1,
      lifetime: spell.zone.durationSeconds,
      pulseCooldown: spell.zone.pulseInterval,
    };
    state.entities[zone.id] = zone;
  }

  // O feitiço "voa" a partir da torre do rei de quem lançou.
  const king = Object.values(state.entities).find(
    (e) => e.side === side && e.tower === 'king',
  );
  state.events.push({
    type: 'spell', x, y, radius, cardId: card.id,
    fromX: king?.x ?? x, fromY: king?.y ?? y,
  });
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

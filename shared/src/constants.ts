// Grid lógico da arena em paisagem: 32 tiles de largura x 18 de altura.
// Lado esquerdo = jogador "left", lado direito = jogador "right".
export const GRID_W = 32;
export const GRID_H = 18;

// Rio vertical no centro da arena, atravessável apenas pelas pontes.
export const RIVER_MIN_X = 15;
export const RIVER_MAX_X = 17;
export const RIVER_CENTER_X = 16;
export const BRIDGE_YS = [4.5, 13.5] as const;
export const BRIDGE_HALF_HEIGHT = 1.3;

// Zona de deploy: só no próprio lado, antes do rio.
export const DEPLOY_MAX_X_LEFT = RIVER_MIN_X - 0.5;
export const DEPLOY_MIN_X_RIGHT = RIVER_MAX_X + 0.5;

export const TICK_RATE = 20;
export const TICK_DT = 1 / TICK_RATE;

export const ELIXIR_MAX = 10;
export const ELIXIR_START = 5;
export const ELIXIR_PER_SECOND = 1 / 2.8;
export const SUDDEN_DEATH_ELIXIR_MULTIPLIER = 2;
/** Como no Clash Royale: elixir em dobro no último minuto do tempo normal. */
export const DOUBLE_ELIXIR_LAST_SECONDS = 60;

export const COUNTDOWN_SECONDS = 7;
export const BATTLE_SECONDS = 180;
export const SUDDEN_DEATH_SECONDS = 60;
/**
 * Desempate final (após a morte súbita ainda empatada): as duas torres do rei
 * perdem vida ao mesmo tempo até uma cair. ~150/s esvazia um rei cheio (2600) em
 * ~17s — rápido o bastante para superar qualquer cura e garantir um vencedor.
 */
export const TIEBREAKER_DRAIN_PER_SECOND = 150;

export const HAND_SIZE = 4;

/** Tempo de implantação: a tropa "nasce" e só age depois disso */
export const DEPLOY_SECONDS = 1;
/** Velocidade dos projéteis (tiles/s) — o dano acontece no impacto */
export const PROJECTILE_SPEED = 10;

export const UNIT_RADIUS = 0.45;
export const TOWER_RADIUS = 1.3;

export const KING_TOWER = { hp: 2600, damage: 110, hitSpeed: 1.0, range: 6 };
export const PRINCESS_TOWER = { hp: 1400, damage: 90, hitSpeed: 0.9, range: 5.5 };

// Posições das torres do lado esquerdo; o direito é espelhado em GRID_W.
export const LEFT_KING_POS = { x: 2.5, y: 9 };
export const LEFT_PRINCESS_POS = [
  { x: 6, y: 4.5 },
  { x: 6, y: 13.5 },
] as const;

export function mirrorX(x: number): number {
  return GRID_W - x;
}

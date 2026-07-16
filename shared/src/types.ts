export type Side = 'left' | 'right';
export type EntityKind = 'unit' | 'tower' | 'building' | 'zone';
export type TowerKind = 'king' | 'princess';
export type EntityAction = 'idle' | 'walk' | 'attack';
export type Phase = 'waiting' | 'countdown' | 'battle' | 'ended';
export type EntityStatus = '' | 'stunned' | 'frozen' | 'raged' | 'charging';

export interface SimEntity {
  id: string;
  kind: EntityKind;
  side: Side;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Escudo restante: consumido antes da vida */
  shield?: number;
  /** id da carta para unidades, construções e zonas */
  cardId?: string;
  tower?: TowerKind;
  /** Torre do rei começa adormecida: só ataca após tomar dano ou perder uma princesa */
  dormant?: boolean;
  /** Cooldown de ataque restante em segundos */
  attackCooldown: number;
  targetId?: string;
  action: EntityAction;
  /** 1 = olhando para a direita, -1 = esquerda */
  facing: 1 | -1;
  flying?: boolean;
  /** Instantes (state.time) até quando cada status vale */
  stunnedUntil?: number;
  frozenUntil?: number;
  ragedUntil?: number;
  /** Construções: segundos de vida restantes */
  lifetime?: number;
  /** Spawners: segundos até a próxima leva */
  spawnCooldown?: number;
  /** Coletor: segundos até o próximo elixir */
  elixirCooldown?: number;
  /** Zonas (veneno): segundos até o próximo pulso */
  pulseCooldown?: number;
  /** Carga (Príncipe) */
  walked?: number;
  charging?: boolean;
  /** Campeões: recarga da habilidade ativa */
  abilityCooldown?: number;
  /** Forma evoluída da carta */
  evolved?: boolean;
  /** Nível da carta no momento do deploy (1–3) */
  level?: number;
  /** Tempo de implantação: até este instante a unidade não age */
  deployingUntil?: number;
}

/** Dano em trânsito: aplicado quando o projétil chega ao alvo. */
export interface PendingHit {
  /** Instante (state.time) em que o projétil atinge */
  at: number;
  /** Alvo direto (ausente para dano em área na posição) */
  targetId?: string;
  x: number;
  y: number;
  damage: number;
  splashRadius?: number;
  targetsAir?: boolean;
  /** Lado do ATACANTE */
  side: Side;
  attackerId?: string;
  lifestealPct?: number;
  healOnKill?: number;
}

export interface PlayerSim {
  side: Side;
  elixir: number;
  crowns: number;
  hand: string[];
  /** Fila de cartas fora da mão; a primeira é a "próxima" */
  queue: string[];
  /** Última carta jogada (para o Espelho) */
  lastPlayed?: string;
  /** Contadores de uso por carta (carga das evoluções) */
  playCounts?: Record<string, number>;
  /** Níveis das cartas do deck (1–3), validados pelo servidor */
  cardLevels?: Record<string, number>;
}

export type SimEvent =
  | { type: 'spawn'; x: number; y: number; cardId: string; side: Side }
  | { type: 'death'; x: number; y: number; kind: EntityKind }
  | { type: 'spell'; x: number; y: number; radius: number; cardId: string; fromX: number; fromY: number }
  | { type: 'towerHit'; x: number; y: number }
  | { type: 'projectile'; fromX: number; fromY: number; toX: number; toY: number; kind: 'arrow' | 'bolt' }
  | { type: 'hit'; x: number; y: number; ranged: boolean; amount: number }
  | { type: 'areaDamage'; x: number; y: number; radius: number }
  | { type: 'ability'; x: number; y: number; cardId: string; side: Side };

export interface SimState {
  tick: number;
  /** Tempo acumulado de simulação em segundos (para statuses) */
  time: number;
  phase: Phase;
  timeRemaining: number;
  suddenDeath: boolean;
  /** Desempate final: as torres do rei drenam vida até uma cair. */
  tiebreaker: boolean;
  players: Record<Side, PlayerSim>;
  entities: Record<string, SimEntity>;
  nextEntityId: number;
  winner?: Side | 'draw';
  /** Eventos gerados no tick atual (limpos a cada passo) */
  events: SimEvent[];
  /** Projéteis em voo com dano agendado */
  pendingHits?: PendingHit[];
}

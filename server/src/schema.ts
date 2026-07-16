import { MapSchema, ArraySchema, Schema, type } from '@colyseus/schema';

export class EntitySchema extends Schema {
  @type('string') id = '';
  @type('string') kind = 'unit';
  @type('string') side = 'left';
  @type('string') cardId = '';
  @type('string') tower = '';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') hp = 0;
  @type('number') maxHp = 0;
  @type('string') action = 'idle';
  @type('number') facing = 1;
  @type('boolean') dormant = false;
  @type('number') shield = 0;
  /** '' | stunned | frozen | raged | charging */
  @type('string') status = '';
  @type('boolean') evolved = false;
  /** Campeões: recarga da habilidade (s) */
  @type('number') abilityCooldown = 0;
}

export class PlayerSchema extends Schema {
  @type('string') side = 'left';
  @type('number') elixir = 0;
  @type('number') crowns = 0;
  @type(['string']) hand = new ArraySchema<string>();
  @type('string') nextCard = '';
  @type('string') name = '';
}

export class BattleState extends Schema {
  @type('string') phase = 'waiting';
  @type('string') roomCode = '';
  @type('number') timeRemaining = 0;
  @type('boolean') suddenDeath = false;
  @type('boolean') tiebreaker = false;
  @type('string') winner = '';
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type({ map: EntitySchema }) entities = new MapSchema<EntitySchema>();
}

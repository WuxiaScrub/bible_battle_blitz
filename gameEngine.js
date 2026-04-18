import { DAMAGE } from "./gameConfig.js";
import { buildRuntimeForCharacter } from "./characterEngine.js";

export function computeDiceTotal(d1, d2) {
  return d1 + d2;
}

/** Base damage for an attack type, before character passives */
export function baseDamageForAttack(attackType) {
  return DAMAGE[attackType] ?? DAMAGE.light;
}

/**
 * Goliath: all attacks count as Heavy for damage.
 */
export function attackerBaseDamage(attackerChar, attackType) {
  if (attackerChar?.id === "goliath") return DAMAGE.heavy;
  return baseDamageForAttack(attackType);
}

export function otherTeam(team) {
  return team === "A" ? "B" : "A";
}

export function assignCharacterToTeam(state, teamId, character) {
  const maxHp = character.hp;
  return {
    teams: {
      ...state.teams,
      [teamId]: {
        ...state.teams[teamId],
        hp: maxHp,
        maxHp,
        character: { ...character },
        runtime: buildRuntimeForCharacter(character),
      },
    },
  };
}

export function seedFromDice(totalA, totalB, rerollGeneration) {
  return `dice-${totalA}-${totalB}-g${rerollGeneration}`;
}

/**
 * Builds effect list for animation layer; returns patches to merge into state.
 */
export function buildDamagePackage({
  state,
  attacker,
  defender,
  attackType,
  wasCorrect,
  usedStone,
  declinedAnointed,
}) {
  const effects = [];
  const atk = state.teams[attacker];
  const def = state.teams[defender];
  let damage = 0;

  if (wasCorrect) {
    effects.push({ type: "SHIELD", team: defender });
    effects.push({ type: "SFX_SHIELD" });
    const atkRuntime = { ...atk.runtime };
    if (atk.character?.id === "david" && usedStone && atkRuntime.stoneCounters > 0) {
      atkRuntime.stoneCounters -= 1;
    }
    if (atk.character?.id === "david") {
      atkRuntime.divineStance = "ready";
    }
    return {
      patch: {
        battlePhase: "idle",
        currentQuestion: null,
        selectedAttackType: null,
        pendingStone: false,
        pendingBlock: null,
        turnActionTaken: true,
        ehudPending: null,
        ehudRoll: null,
        teams: {
          ...state.teams,
          [attacker]: {
            ...atk,
            runtime: atkRuntime,
          },
          [defender]: {
            ...def,
            runtime: applySamsonWrongDefense(def, false),
          },
        },
      },
      effects,
      advanceTurn: false,
    };
  }

  let base = attackerBaseDamage(atk.character, attackType);

  if (atk.character?.id === "david" && usedStone && atk.runtime.stoneCounters > 0) {
    base = Math.floor(base * 1.5);
  }

  if (atk.character?.id === "samson") {
    const bonus = (atk.runtime.hairTokens ?? 0) * 200;
    base += bonus;
  }

  damage = base;

  if (
    def.character?.id === "king_saul" &&
    def.runtime.anointedAvailable &&
    !def.runtime.anointedUsed &&
    !declinedAnointed
  ) {
    return {
      patch: {
        battlePhase: "confirm_block",
        pendingBlock: { attacker, defender, damage, attackType, usedStone },
        pendingStone: !!usedStone,
      },
      effects: [],
      advanceTurn: false,
    };
  }

  return finalizeDamage(
    state,
    attacker,
    defender,
    damage,
    attackType,
    usedStone,
    effects
  );
}

function applySamsonWrongDefense(defTeamState, wrong) {
  const rt = { ...defTeamState.runtime };
  if (defTeamState.character?.id !== "samson") return rt;
  if (wrong && rt.hairTokens > 0) rt.hairTokens -= 1;
  return rt;
}

function finalizeDamage(state, attacker, defender, damage, attackType, usedStone, effects) {
  const atk = state.teams[attacker];
  const def = state.teams[defender];

  let dmg = damage;
  const atkRuntime = { ...atk.runtime };
  if (atk.character?.id === "david" && usedStone && atkRuntime.stoneCounters > 0) {
    atkRuntime.stoneCounters -= 1;
  }
  if (atk.character?.id === "david") {
    atkRuntime.divineStance = "ready";
  }

  let defHp = def.hp - dmg;
  effects.push({ type: "HIT", team: defender });
  effects.push({ type: "DAMAGE_TEXT", team: defender, amount: dmg });
  effects.push({ type: "SFX_HIT" });

  let patchTeams = {
    ...state.teams,
    [attacker]: {
      ...atk,
      runtime: atkRuntime,
    },
    [defender]: {
      ...def,
      hp: Math.max(0, defHp),
      runtime: applySamsonWrongDefense(def, true),
    },
  };

  const extra = maybeEhudFollowup(state, attacker, defender, dmg, patchTeams);
  if (extra.teamDelta) {
    for (const k of Object.keys(extra.teamDelta)) {
      patchTeams[k] = { ...patchTeams[k], ...extra.teamDelta[k] };
    }
  }

  if (extra.effects) effects.push(...extra.effects);

  const winner =
    patchTeams.A.hp <= 0 ? "B" : patchTeams.B.hp <= 0 ? "A" : null;

  return {
    patch: {
      teams: patchTeams,
      battlePhase: extra.ehudPending ? "ehud_roll" : "idle",
      currentQuestion: null,
      selectedAttackType: null,
      pendingStone: false,
      pendingBlock: null,
      turnActionTaken: true,
      ehudPending: extra.ehudPending ?? null,
      ehudRoll: null,
      skipNextFor: extra.skipNextFor ?? state.skipNextFor,
      winner,
    },
    effects,
    advanceTurn: false,
  };
}

function maybeEhudFollowup(state, attacker, defender, damageDealt, teamsDraft) {
  const atk = teamsDraft[attacker];
  if (atk.character?.id !== "ehud" || damageDealt <= 0) {
    return { effects: [], teamDelta: {}, ehudPending: null };
  }

  const effects = [{ type: "SKILL_FLASH", team: attacker }];
  return {
    effects,
    teamDelta: {},
    skipNextFor: state.skipNextFor,
    ehudPending: { attacker, defender },
  };
}

export function confirmAnointedDecline(state) {
  const pb = state.pendingBlock;
  if (!pb) return null;
  return finalizeDamage(
    state,
    pb.attacker,
    pb.defender,
    pb.damage,
    pb.attackType,
    state.pendingStone,
    []
  );
}

export function confirmAnointedUse(state) {
  const pb = state.pendingBlock;
  if (!pb) return null;
  const def = state.teams[pb.defender];
  const effects = [{ type: "SHIELD", team: pb.defender }];
  const runtime = {
    ...def.runtime,
    anointedAvailable: true,
    anointedUsed: true,
  };
  return {
    patch: {
      battlePhase: "idle",
      currentQuestion: null,
      selectedAttackType: null,
      pendingBlock: null,
      pendingStone: false,
      turnActionTaken: true,
      ehudPending: null,
      ehudRoll: null,
      teams: {
        ...state.teams,
        [pb.defender]: {
          ...def,
          runtime,
        },
      },
    },
    effects,
    advanceTurn: false,
  };
}

export function applyJealousy(state, teamId) {
  const self = state.teams[teamId];
  const opp = state.teams[otherTeam(teamId)];
  if (self.character?.id !== "king_saul") return null;
  if (self.runtime.jealousyUsedThisTurn) return null;

  const selfHp = Math.max(0, self.hp - 500);
  const oppHp = Math.max(0, opp.hp - 500);
  const winner =
    selfHp <= 0 ? otherTeam(teamId) : oppHp <= 0 ? teamId : null;

  const effects = [
    { type: "HIT", team: teamId },
    { type: "HIT", team: otherTeam(teamId) },
    { type: "DAMAGE_TEXT", team: teamId, amount: 500 },
    { type: "DAMAGE_TEXT", team: otherTeam(teamId), amount: 500 },
    { type: "SFX_HIT" },
  ];

  return {
    patch: {
      teams: {
        ...state.teams,
        [teamId]: {
          ...self,
          hp: selfHp,
          runtime: { ...self.runtime, jealousyUsedThisTurn: true },
        },
        [otherTeam(teamId)]: { ...opp, hp: oppHp },
      },
      winner,
      battlePhase: "choose_attack",
      ehudPending: null,
      ehudRoll: null,
    },
    effects,
    advanceTurn: false,
  };
}

export function applyTaunt(state, teamId) {
  const self = state.teams[teamId];
  if (self.character?.id !== "goliath") return null;
  if (self.runtime.tauntUsedThisTurn) return null;

  return {
    patch: {
      battlePhase: "taunt_roll",
      tauntRoll: null,
      ehudPending: null,
      ehudRoll: null,
    },
    effects: [{ type: "SKILL_FLASH", team: teamId }],
    advanceTurn: false,
  };
}

export function applyDivineProtection(state, teamId) {
  const self = state.teams[teamId];
  if (self.character?.id !== "david") return null;
  if (self.runtime.divineStance === "exhausted") return null;

  const newHp = Math.min(self.maxHp, self.hp + 200);
  return {
    patch: {
      teams: {
        ...state.teams,
        [teamId]: {
          ...self,
          hp: newHp,
          runtime: { ...self.runtime, divineStance: "exhausted" },
        },
      },
      battlePhase: "idle",
      turnActionTaken: true,
      ehudPending: null,
      ehudRoll: null,
    },
    effects: [{ type: "SKILL_FLASH", team: teamId }],
    advanceTurn: false,
  };
}

export function advanceTurnAfterSkip(state) {
  return { advanceTurn: true };
}

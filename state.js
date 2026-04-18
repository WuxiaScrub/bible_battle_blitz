import { SCENES } from "./gameConfig.js";

export function createInitialState() {
  return {
    scene: SCENES.MAIN_MENU,
    teams: {
      A: {
        name: "Team A",
        hp: 0,
        maxHp: 0,
        character: null,
        runtime: {},
      },
      B: {
        name: "Team B",
        hp: 0,
        maxHp: 0,
        character: null,
        runtime: {},
      },
    },
    currentTurn: "A",
    round: 1,
    currentQuestion: null,
    selectedAttackType: null,
    battlePhase: "idle", // 'idle' | 'choose_attack' | 'question' | 'resolve'
    dice: null,
    characterPool: [],
    /** Team that picks first in char select (= dice loser); also attacks first in battle */
    firstPicker: null,
    diceWinner: null,
    pendingAnim: [],
    winner: null,
    usedQuestionIds: [],
    musicEnabled: true,
    turnIndex: 0,
    skipNextFor: null,
    pendingBlock: null,
    pendingStone: false,
    pendingStoneToggle: false,
    turnActionTaken: false,
    ehudPending: null,
    ehudRoll: null,
    tauntRoll: null,
    diceGeneration: 0,
  };
}

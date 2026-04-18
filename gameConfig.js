/** Shared constants — adjust balance here only. */

export const GAME_TITLE = "Bible Battle Blitz";

export const DAMAGE = {
  light: 300,
  heavy: 600,
};

export const SCENES = Object.freeze({
  MAIN_MENU: "MAIN_MENU",
  DICE_ROLL: "DICE_ROLL",
  CHAR_SELECT: "CHAR_SELECT",
  BATTLE: "BATTLE",
  INSTRUCTIONS: "INSTRUCTIONS",
  GAME_OVER: "GAME_OVER",
});

export const AUDIO = Object.freeze({
  bgm: [
    "./assets/music/bgm_little_epic_journey.mp3",
    "./assets/music/bgm_the_looming_battle.mp3",
  ],
  click: "./assets/sfx/sfx_click.mp3",
  dice: "./assets/sfx/dice-1.wav",
});

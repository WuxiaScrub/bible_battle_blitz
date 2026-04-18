# Sunday School Battle Review Game — Cursor Build Spec

## Overview

This is a browser-based educational battle game for elementary Sunday school students. Two teams select Old Testament characters and compete by answering Bible-based multiple-choice questions. Correct answers determine whether attacks succeed or are defended.

The project is designed for **GitHub Pages deployment** and should run entirely in the browser with no backend.

Game title is "Bible Battle Blitz".

---

## Tech Stack

- **Vanilla JavaScript (ES6 modules preferred)**
- HTML5 + CSS3
- Optional: lightweight utility CSS (keep dependency-free)
- No backend
- No database
- All data stored in local JSON files

---

## GAME SCENES (NEW CORE STRUCTURE)

The game is now organized into distinct UI scenes:

1. MAIN\_MENU
2. DICE\_ROLL
3. CHARACTER\_SELECT
4. BATTLE
5. INSTRUCTIONS
6. GAME\_OVER

Each scene is rendered by a simple `sceneManager.js` (or handled inside `app.js`).

---

## SCENE FLOW

### 1. MAIN MENU

Options:

- ▶ Play
- 📖 Instructions

Behavior:

- Play → goes to DICE\_ROLL
- Instructions → opens INSTRUCTIONS scene

Music:
By default, play /assets/music/bgm_little_epic_journey.mp3, with /assets/music/bgm_the_looming_battle.mp3 as the next soundtrack. Keep looping these 2 sound tracks. Have a button in the upper right to toggle music on/off. This button should persist for all scenes.

Sfx:
If no other sfx specified, play assets/sfx/sfx_click.mp3 whenever mouse is clicked.

---

### 2. INSTRUCTIONS SCENE

Static page explaining:

- Turn-based attack system
- Attack types (Light / Heavy)
- Question answering rules
- Win condition

Includes:

- Back to Main Menu button

---

### 3. DICE ROLL SCENE (NEW)

Purpose: Determine selection priority + attack order.

Flow:

1. Both teams see a central dice UI
2. Each team clicks to roll 2 dice
3. Highest total wins
4. Tie → reroll automatically

SFX:

- Dice roll sound triggered on click (user-provided asset in assets/sfx/dice-1.wav)

Result:

- Losing team chooses characters FIRST
- Winning team chooses second

Transition → CHARACTER\_SELECT

---

### 4. CHARACTER SELECT SCENE (NEW)

#### Step 1: Generate Pool

- Randomly select **4 characters** from characters.json

Display each character card:

- Image
- Name
- HP
- Skill names + descriptions

---

#### Step 2: Selection Order

- Losing dice team picks first
- Other team picks second from remaining 3

---

#### Step 3: After selection

- Assign chosen characters to teams
- Team that picked FIRST gets FIRST ATTACK advantage (to counter balance the fact that the team who picked 2nd might pick a character whose skills counter that of the first).

Transition → BATTLE scene

---

### 5. BATTLE SCENE

Main gameplay screen.

Layout:

- Left: Team A character
- Right: Team B character
- Top: Turn indicator + round number
- Center: Attack buttons
- Bottom: Skill buttons (active skills only)

---

## TURN SYSTEM

Each turn:

1. Active team selects attack type:
   - Light
   - Heavy
2. Question appears
3. Opposing team answers
4. Resolve damage or block
5. Switch turns

---

## ATTACK SYSTEM

| Attack Type | Damage |
| ----------- | ------ |
| Light       | 300    |
| Heavy       | 600    |

Correct answer → NO damage
Wrong answer → DAMAGE applied

---

## GAME STATE MODEL

```js
GameState = {
  scene: "MAIN_MENU" | "DICE_ROLL" | "CHAR_SELECT" | "BATTLE" | "INSTRUCTIONS" | "GAME_OVER",
  teams: {
    A: { name, hp, character },
    B: { name, hp, character }
  },
  currentTurn: "A" | "B",
  round: number,
  currentQuestion: null,
  selectedAttackType: "light"|"heavy"
}
```

---

## DATA FILES (sample)

### characters.json

```json
{
  "id": "moses",
  "name": "Moses",
  "hp": 1000,
  "image": "moses.png",
  "skills": [
    {
      "name": "Staff of Power",
      "type": "active",
      "description": "Negate one Heavy attack per game"
    }
  ]
}
```

### questions.json

```json
{
  "id": "q1",
  "type": "light",
  "question": "Who built the ark?",
  "choices": ["Moses", "Noah", "Abraham", "David"],
  "correctIndex": 1
}
```

---

## MODULE STRUCTURE

```
/index.html
/styles.css
/app.js
/sceneManager.js (NEW)
/gameEngine.js
/state.js
/questionEngine.js
/characterEngine.js
/animationEngine.js
/gameConfig.js
/data/
/assets/
```

---

## MODULE RESPONSIBILITIES

### sceneManager.js (NEW)

- Handles switching between scenes
- Controls DOM mounting/unmounting
- Ensures only one scene active at a time

---

### animationEngine.js

Handles visual effects:

- Character shake (damage)
- Shield overlay (defense success)
- Floating damage numbers
- Skill activation flash

API:

```js
playHitAnimation(teamId)
playShieldAnimation(teamId)
playDamageText(teamId, amount)
playSkillAnimation(teamId)
```

---

## DICE SYSTEM

### Dice Rules:

- Each team rolls 2 dice (1–6 each)
- Total highest wins
- Tie → reroll

### Implementation:

- Random generator: `Math.random()`
- Dice UI in center of screen
- Animate roll before revealing result

---

## CHARACTER SELECTION RULES

- 4 random characters shown
- Each selection removes character from pool
- UI shows:
  - image
  - HP
  - skills (name + description)

---

## WIN CONDITION

```js
if (team.hp <= 0) → GAME_OVER
```

Display:

- Winner team
- Restart button → MAIN\_MENU

---

## ADMIN CONTROLS

- +100 / -100 HP per team
- Reset game
- Skip question (debug)

---

## IMPORTANT DESIGN RULES

- Scenes must be fully isolated
- Game logic must NOT directly manipulate DOM
- Animation system must be event-driven
- Character selection must be deterministic after dice roll

---

## CURSOR BUILD ORDER

1. sceneManager
2. MAIN\_MENU + navigation
3. DICE\_ROLL scene
4. CHARACTER\_SELECT scene
5. BATTLE scene UI
6. questionEngine
7. gameEngine logic
8. animationEngine integration
9. skill system

---

## SIMPLIFICATIONS (v1)

- No backend
- No persistence
- No multiplayer
- No complex AI
- All randomness client-side

---

## END GOAL

A classroom-friendly Bible trivia battle game with:

- clear scene progression
- engaging dice-based start
- simple but fun animations
- easy teacher control
- stable deterministic gameplay


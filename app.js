import { SCENES, AUDIO, GAME_TITLE } from "./gameConfig.js";
import { createInitialState } from "./state.js";
import { createSceneManager } from "./sceneManager.js";
import { createAnimationEngine } from "./animationEngine.js";
import {
  getCharacterImageUrl,
  pickCharacterPool,
  loadAllCharacters,
} from "./characterEngine.js";
import { nextQuestion } from "./questionEngine.js";
import {
  otherTeam,
  assignCharacterToTeam,
  seedFromDice,
  buildDamagePackage,
  confirmAnointedDecline,
  confirmAnointedUse,
  applyJealousy,
  applyTaunt,
  applyDivineProtection,
} from "./gameEngine.js";

/** @type {ReturnType<createInitialState>} */
let state = createInitialState();

const sceneRoot = document.getElementById("scene-root");
const musicBtn = document.getElementById("music-toggle");
const adminBar = document.getElementById("admin-bar");

// Add reset confirmation modal
const resetModal = document.createElement("div");
resetModal.className = "reset-modal";
resetModal.innerHTML = `
  <div class="modal-backdrop"></div>
  <div class="modal-content">
    <h3>Reset Game?</h3>
    <p>This will end the current game and return to the main menu. Are you sure?</p>
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" data-cancel>Cancel</button>
      <button type="button" class="btn btn-danger" data-confirm>Reset Game</button>
    </div>
  </div>
`;
document.body.appendChild(resetModal);

function showResetModal() {
  resetModal.style.display = "flex";
}

function hideResetModal() {
  resetModal.style.display = "none";
}

resetModal.addEventListener("click", (e) => {
  if (e.target === resetModal.querySelector(".modal-backdrop") || e.target.matches("[data-cancel]")) {
    hideResetModal();
  } else if (e.target.matches("[data-confirm]")) {
    state = createInitialState();
    scenes.show(SCENES.MAIN_MENU, buildCtx());
    hideResetModal();
  }
});

const scenes = createSceneManager(sceneRoot);
let anim = createAnimationEngine(sceneRoot);

/* ---- Audio ---- */
const clickAudio = new Audio(AUDIO.click);
clickAudio.volume = 0.45;
let bgmList = [];
let bgmIndex = 0;
let bgmPlaying = false;

function tryPlayBgm() {
  if (!state.musicEnabled || !bgmList.length) return;
  const a = bgmList[bgmIndex];
  a.volume = 0.35;
  a.loop = false;
  a.play().catch(() => {});
}

function advanceBgm() {
  if (!bgmList.length) return;
  bgmIndex = (bgmIndex + 1) % bgmList.length;
  tryPlayBgm();
}

function setupBgm() {
  bgmList = AUDIO.bgm.map((src) => {
    const a = new Audio(src);
    a.addEventListener("ended", advanceBgm);
    return a;
  });
}

function syncMusicButton() {
  musicBtn.textContent = state.musicEnabled ? "🔊 Music" : "🔇 Music";
  musicBtn.setAttribute("aria-pressed", state.musicEnabled ? "true" : "false");
  if (!state.musicEnabled) {
    bgmList.forEach((a) => {
      a.pause();
    });
    bgmPlaying = false;
  } else if (!bgmPlaying) {
    tryPlayBgm();
    bgmPlaying = true;
  }
}


/* ---- State helpers ---- */

function mergeState(patch) {
  state = { ...state, ...patch };
  scenes.refresh(buildCtx());
}

function buildCtx() {
  return { state, actions: uiActions };
}

async function dispatchResult(result) {
  if (!result) return;
  const { patch, effects, advanceTurn } = result;
  if (effects?.length) await anim.runEffects(effects);
  if (patch?.winner) {
    mergeState({ ...patch });
    scenes.show(SCENES.GAME_OVER, buildCtx());
    return;
  }
  mergeState({ ...patch });
  if (advanceTurn) {
    advanceTurnPipeline();
  } else {
    scenes.refresh(buildCtx());
  }
}

function advanceTurnPipeline() {
  const turnPatch = computeNextTurn(state);
  const skillPatch = applySaulJealousyReset(state, turnPatch.currentTurn);
  mergeState({
    ...turnPatch,
    ...(skillPatch.teams ? { teams: skillPatch.teams } : {}),
    battlePhase: state.winner ? state.battlePhase : "choose_attack",
    turnActionTaken: false,
    ehudPending: null,
    ehudRoll: null,
    tauntRoll: null,
    pendingStoneToggle: false,
  });
  scenes.refresh(buildCtx());
}

function computeNextTurn(s) {
  let next = otherTeam(s.currentTurn);
  let skip = s.skipNextFor;
  const patch = { skipNextFor: null };
  if (skip === next) {
    next = otherTeam(next);
  }
  return {
    currentTurn: next,
    turnIndex: s.turnIndex + 1,
    round: s.round + 1,
    ...patch,
  };
}

function applySaulJealousyReset(s, newTurn) {
  const t = s.teams[newTurn];
  if (!t?.character) return {};
  if (t.character.id === "king_saul") {
    return {
      teams: {
        ...s.teams,
        [newTurn]: {
          ...t,
          runtime: { ...t.runtime, jealousyUsedThisTurn: false },
        },
      },
    };
  }
  if (t.character.id === "goliath") {
    return {
      teams: {
        ...s.teams,
        [newTurn]: {
          ...t,
          runtime: { ...t.runtime, tauntUsedThisTurn: false },
        },
      },
    };
  }
  return {};
}

/* ---- Scene: MAIN_MENU ---- */

function renderMainMenu(root) {
  root.innerHTML = `
    <h1 class="scene-title">${GAME_TITLE}</h1>
    <div class="menu-actions">
      <button type="button" data-nav="play">▶ Play</button>
      <button type="button" data-nav="instructions" class="secondary">📖 Instructions</button>
    </div>
  `;
  root.querySelector('[data-nav="play"]').onclick = () => {
    mergeState({ scene: SCENES.DICE_ROLL });
    scenes.show(SCENES.DICE_ROLL, buildCtx());
  };
  root.querySelector('[data-nav="instructions"]').onclick = () => {
    mergeState({ scene: SCENES.INSTRUCTIONS });
    scenes.show(SCENES.INSTRUCTIONS, buildCtx());
  };
}

/* ---- Scene: INSTRUCTIONS ---- */

function renderInstructions(root) {
  root.innerHTML = `
    <h1 class="scene-title">How to Play</h1>
    <div class="prose">
      <p>This is a turn-based Bible trivia battle for two teams.</p>
      <ul>
        <li><strong>Dice:</strong> Both teams roll two dice; higher total picks second. The lower total picks first and attacks first.</li>
        <li><strong>Characters:</strong> Four heroes appear; each team drafts one.</li>
        <li><strong>Attacks:</strong> On your turn choose <em>Light</em> or <em>Heavy</em>. Your opponent sees a Bible question.</li>
        <li><strong>Defense:</strong> If they answer correctly, they block. If wrong, they take damage.</li>
        <li><strong>Skills:</strong> Active skills appear under your hero—use them wisely!</li>
        <li><strong>Win:</strong> Reduce the other team to 0 HP.</li>
      </ul>
      <div class="row-actions">
        <button type="button" class="btn btn-primary" data-back>← Main Menu</button>
      </div>
    </div>
  `;
  root.querySelector("[data-back]").onclick = () => {
    mergeState({ scene: SCENES.MAIN_MENU });
    scenes.show(SCENES.MAIN_MENU, buildCtx());
  };
}

/* ---- Scene: DICE ---- */

function rollDie() {
  return 1 + Math.floor(Math.random() * 6);
}

/** Cell indices 0–8 in a 3×3 grid (top-left → bottom-right). */
const DIE_PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8],
};

/** Renders a standard six-sided die face with pips (not plain digits). */
function dieFaceMarkup(value) {
  if (value === null || value === undefined || value === "?") {
    return `<div class="die die--pending" aria-hidden="true"><span class="die-placeholder">?</span></div>`;
  }
  const n = Number(value);
  const pipIdx = DIE_PIPS[n];
  if (!pipIdx) {
    return `<div class="die die--pending"><span class="die-placeholder">${escapeHtml(String(value))}</span></div>`;
  }
  let cells = "";
  for (let i = 0; i < 9; i++) {
    cells += `<span class="die-pip${pipIdx.includes(i) ? " die-pip--on" : ""}"></span>`;
  }
  return `<div class="die die--face" role="img" aria-label="Die face ${n}">${cells}</div>`;
}

function renderDice(root, ctx) {
  if (!state.dice) {
    mergeState({
      dice: { rollsA: null, rollsB: null, tieGen: 0, status: "await_a" },
    });
  }
  const d = state.dice;

  function totals() {
    const ta =
      d.rollsA && d.rollsA[0] + d.rollsA[1];
    const tb =
      d.rollsB && d.rollsB[0] + d.rollsB[1];
    return { ta, tb };
  }

  function renderInner() {
    const { ta, tb } = totals();
    root.innerHTML = `
      <h1 class="scene-title">Dice Roll</h1>
      <p class="pick-banner">Each team rolls two dice. <strong>Higher total</strong> picks second; <strong>lower total</strong> picks first <em>and attacks first</em>.</p>
      <div class="dice-stage">
        <div class="dice-row">
          <div>
            <div class="team-tag" style="color:var(--team-a);font-weight:800;margin-bottom:.35rem;">Team A</div>
            <div class="die-pair">
              <div data-face-a0>${dieFaceMarkup(d.rollsA ? d.rollsA[0] : "?")}</div>
              <div data-face-a1>${dieFaceMarkup(d.rollsA ? d.rollsA[1] : "?")}</div>
            </div>
            <div style="margin-top:.35rem;font-weight:700;">Total: ${ta ?? "—"}</div>
            <button type="button" class="btn btn-primary" data-roll-a ${d.status !== "await_a" ? "disabled" : ""}>Roll Team A</button>
          </div>
          <div>
            <div class="team-tag" style="color:var(--team-b);font-weight:800;margin-bottom:.35rem;">Team B</div>
            <div class="die-pair">
              <div data-face-b0>${dieFaceMarkup(d.rollsB ? d.rollsB[0] : "?")}</div>
              <div data-face-b1>${dieFaceMarkup(d.rollsB ? d.rollsB[1] : "?")}</div>
            </div>
            <div style="margin-top:.35rem;font-weight:700;">Total: ${tb ?? "—"}</div>
            <button type="button" class="btn btn-primary" data-roll-b ${d.status !== "await_b" ? "disabled" : ""}>Roll Team B</button>
          </div>
        </div>
        ${d.status === "tie" ? `<p class="toast">Tie! Roll again.</p>` : ""}
      </div>
    `;

    const diceAudio = new Audio(AUDIO.dice);

    async function animateRoll(which, faces) {
      const wrappers =
        which === "A"
          ? [root.querySelector("[data-face-a0]"), root.querySelector("[data-face-a1]")]
          : [root.querySelector("[data-face-b0]"), root.querySelector("[data-face-b1]")];
      const diceEls = wrappers.map((w) => w?.firstElementChild).filter(Boolean);
      diceEls.forEach((el) => el.classList.add("rolling"));
      try {
        diceAudio.currentTime = 0;
        await diceAudio.play();
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 550));
      wrappers.forEach((wrap, i) => {
        if (!wrap) return;
        wrap.innerHTML = dieFaceMarkup(faces[i]);
        const inner = wrap.firstElementChild;
        inner?.classList.remove("rolling");
      });
    }

    const btnA = root.querySelector("[data-roll-a]");
    if (btnA) {
      btnA.onclick = async () => {
        const faces = [rollDie(), rollDie()];
        await animateRoll("A", faces);
        const next = {
          ...d,
          rollsA: faces,
          status: "await_b",
        };
        mergeState({ dice: next });
        scenes.show(SCENES.DICE_ROLL, buildCtx());
      };
    }
    const btnB = root.querySelector("[data-roll-b]");
    if (btnB) {
      btnB.onclick = async () => {
        const faces = [rollDie(), rollDie()];
        await animateRoll("B", faces);
        const nb = {
          ...d,
          rollsB: faces,
        };
        const ta = nb.rollsA[0] + nb.rollsA[1];
        const tb = nb.rollsB[0] + nb.rollsB[1];
        if (ta === tb) {
          mergeState({
            dice: {
              rollsA: null,
              rollsB: null,
              tieGen: d.tieGen + 1,
              status: "await_a",
            },
          });
          scenes.show(SCENES.DICE_ROLL, buildCtx());
          return;
        }

        const winner = ta > tb ? "A" : "B";
        const loser = otherTeam(winner);
        mergeState({
          dice: { ...nb, totalA: ta, totalB: tb, winner, loser, status: "done" },
        });
        scenes.show(SCENES.DICE_ROLL, buildCtx());
        await new Promise((r) => setTimeout(r, 2000));
        mergeState({
          diceWinner: winner,
          firstPicker: loser,
          scene: SCENES.CHAR_SELECT,
        });
        goCharSelect();
        return;
      };
    }
  }

  renderInner();
}

async function goCharSelect() {
  const d = state.dice;
  const seed = seedFromDice(d.totalA, d.totalB, d.tieGen);
  const pool = await pickCharacterPool(seed);
  mergeState({ characterPool: pool, pickingTeam: state.firstPicker, picksLeft: 2 });
  scenes.show(SCENES.CHAR_SELECT, buildCtx());
}

/* ---- Scene: CHARACTER_SELECT ---- */

function renderCharSelect(root, ctx) {
  const pool = state.characterPool || [];
  const picker = state.pickingTeam;
  const other = otherTeam(picker);

  root.innerHTML = `
    <h1 class="scene-title">Choose Your Hero</h1>
    <p class="pick-banner">
      ${state.picksLeft === 2
        ? `<strong>Team ${picker}</strong> picks first (lost the dice roll).`
        : `<strong>Team ${picker}</strong> picks second.`}
    </p>
    <div class="card-grid">
      ${pool
        .map((c, i) => {
          const skills = (c.skills || [])
            .map(
              (s) =>
                `<li><strong>${escapeHtml(s.name)}</strong> (${s.type}): ${escapeHtml(s.description)}</li>`
            )
            .join("");
          const imgUrl = getCharacterImageUrl(c.image);
          return `
          <button type="button" class="char-card" data-pick="${escapeHtml(c.id)}">
            <img src="${imgUrl}" alt="" data-img="${escapeHtml(c.id)}" />
            <div class="char-meta">
              <strong class="character-name">${escapeHtml(c.name)}</strong>
              <div class="character-hp">HP: ${c.hp}</div>
              <ul class="skill-list">${skills}</ul>
            </div>
          </button>`;
        })
        .join("")}
    </div>
  `;

  root.querySelectorAll(".char-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-pick");
      const chosen = pool.find((c) => c.id === id);
      const step1 = state.picksLeft === 2;
      const patchAssign = assignCharacterToTeam(state, picker, chosen);
      const nextPool = pool.filter((c) => c.id !== id);
      if (step1) {
        mergeState({
          ...patchAssign,
          characterPool: nextPool,
          pickingTeam: other,
          picksLeft: 1,
        });
      } else {
        mergeState({
          ...patchAssign,
          characterPool: nextPool,
          picksLeft: 0,
          scene: SCENES.BATTLE,
          currentTurn: state.firstPicker,
          battlePhase: "choose_attack",
          round: 1,
          usedQuestionIds: [],
          pendingStoneToggle: false,
          turnActionTaken: false,
          ehudPending: null,
          ehudRoll: null,
        });
        scenes.show(SCENES.BATTLE, buildCtx());
        return;
      }
      scenes.refresh(buildCtx());
    });
  });

  root.querySelectorAll("[data-img]").forEach((img) => {
    img.addEventListener("error", () => {
      const id = img.getAttribute("data-img");
      img.replaceWith(fallbackPortrait(id));
    });
  });
}

/* ---- Scene: BATTLE ---- */

function fallbackPortrait(id) {
  const div = document.createElement("div");
  div.style.minHeight = "160px";
  div.style.display = "grid";
  div.style.placeItems = "center";
  div.style.fontSize = "2.5rem";
  div.style.background = "#334155";
  div.textContent = (id || "?").slice(0, 2).toUpperCase();
  return div;
}

function renderBattle(root, ctx) {
  anim = createAnimationEngine(root);
  const atk = state.currentTurn;
  const def = otherTeam(atk);
  const phase = state.battlePhase || "choose_attack";

  const teamPanel = (teamId) => {
    const t = state.teams[teamId];
    const c = t.character;
    const pct = t.maxHp ? Math.min(100, (t.hp / t.maxHp) * 100) : 0;
    const imgUrl = c ? getCharacterImageUrl(c.image) : "";
    
    // Active skills for the main display
    const skills =
      (c?.skills || [])
        .filter((s) => s.type === "active")
        .map((s) => `<li>${escapeHtml(s.name)}: ${escapeHtml(s.description)}</li>`)
        .join("") || "<li>No active skills</li>";
    
    // All skills for the tooltip
    const allSkills =
      (c?.skills || [])
        .map((s) => `<li><strong>${escapeHtml(s.name)}</strong> (${s.type}): ${escapeHtml(s.description)}</li>`)
        .join("") || "<li>No skills</li>";
    
    const skillsTooltip = c
      ? `<div class="character-tooltip">
           <div class="tooltip-title">${escapeHtml(c.name)}</div>
           <ul class="tooltip-skills">${allSkills}</ul>
         </div>`
      : "";
    
    let roleLabel = "";
    if (phase !== "confirm_block") {
      if (teamId === atk) {
        roleLabel = ` <span class="role-badge attacker">ATTACKING</span>`;
      } else {
        roleLabel = ` <span class="role-badge defender">DEFENDING</span>`;
      }
    } else if (teamId === def && phase === "confirm_block") {
      roleLabel = ` <span class="role-badge defender">DEFENDING</span>`;
    }
    
    const isCurrentTeam = teamId === state.currentTurn;
    const turnDone = !!state.turnActionTaken && t.character?.id !== "king_saul";
    const showActionControls = isCurrentTeam && !turnDone && phase === "choose_attack" && !state.turnActionTaken;
    const showWaitControls = isCurrentTeam && turnDone;
    const davidStone =
      showActionControls && t.character?.id === "david" && (t.runtime.stoneCounters ?? 0) > 0
        ? `<label class="stone-toggle">
            <input type="checkbox" data-stone-toggle ${state.pendingStoneToggle ? "checked" : ""} />
            Use Stone (+50% damage; uses 1 stone)
          </label>`
        : "";

    const davidDiv =
      showActionControls && t.character?.id === "david" && t.runtime.divineStance !== "exhausted"
        ? `<button type="button" class="btn btn-skill" data-divine>Divine Protection — skip attack, +200 HP</button>`
        : "";

    const saulJ =
      isCurrentTeam && t.character?.id === "king_saul" && !t.runtime.jealousyUsedThisTurn
        ? `<button type="button" class="btn btn-skill" data-jealousy>Jealousy — lose 500 HP, deal 500 damage</button>`
        : "";
    const goliathTaunt =
      isCurrentTeam && t.character?.id === "goliath" && !t.runtime.tauntUsedThisTurn
        ? `<button type="button" class="btn btn-skill" data-taunt>Taunt — roll 1 die; 3+ deals 300 to opponent, otherwise you take 300</button>`
        : "";

    const turnPointer = teamId === state.currentTurn && c
      ? `<div class="turn-pointer" aria-hidden="true"></div>`
      : "";
    const hpClass = pct <= 30 ? "low" : pct <= 60 ? "medium" : "high";
    const ehudRollPending = phase === "ehud_roll" && !state.ehudRoll;

    const isGoliathAttacker = showActionControls && t.character?.id === "goliath";
    const attackButtons = showActionControls
      ? `<div class="attack-buttons-stack">
           ${davidStone}
           ${isGoliathAttacker
             ? `<button type="button" class="btn btn-attack btn-light" disabled title="Goliath can only use Heavy">Light (${300})</button>`
             : `<button type="button" class="btn btn-attack btn-light" data-atk="light">Light (${300})</button>`}
           <button type="button" class="btn btn-attack btn-heavy" data-atk="heavy">Heavy (${600})</button>
           ${davidDiv}
         </div>`
      : showWaitControls
      ? `<div class="attack-buttons-stack">
         </div>`
      : `<div class="attack-buttons-stack disabled-group">
           <button type="button" class="btn btn-attack btn-light" disabled>Light (${300})</button>
           <button type="button" class="btn btn-attack btn-heavy" disabled>Heavy (${600})</button>
         </div>`;
    const endTurnButton = isCurrentTeam ? `<button type="button" class="btn btn-end-turn" data-end-turn>End Turn</button>` : '';
    
    return `
      <section class="character-panel" data-team="${teamId}">
        <div class="team-tag">Team ${teamId}${roleLabel}</div>
        <div class="character-card">
          <div class="character-stage character-hover-wrapper" ${c ? `data-char-id="${escapeHtml(c.id)}"` : ""}>
            ${turnPointer}
            ${c ? `<img src="${imgUrl}" alt="${escapeHtml(c.name)}" data-portrait="${teamId}" />` : `<div></div>`}
            ${skillsTooltip}
          </div>
          <div class="hp-bar"><div class="hp-fill ${hpClass}" style="width:${pct}%"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:.35rem;font-size:.9rem;">
            <span class="character-name">${c ? escapeHtml(c.name) : "—"}</span>
            <span><strong>${t.hp}</strong> / ${t.maxHp}</span>
          </div>
          ${attackButtons}
          <div style="margin-top: 0.5rem; display:flex; flex-direction:column; gap:0.25rem;">
            ${endTurnButton}
            ${saulJ}
            ${goliathTaunt}
          </div>
          <div class="skill-row" data-active-wrap="${teamId}"></div>
          <ul class="skill-list" style="margin-top:.5rem;">${skills}</ul>
          ${runtimeTags(t)}
        </div>
      </section>`;
  };

  root.innerHTML = `
    <div class="battle-header">
      <div class="turn-pill">Turn: Team ${atk} · Round ${state.round}</div>
      <div style="font-size:.9rem;color:var(--muted);">Team ${atk} is attacking Team ${def}. ${phase === "question" ? "Team " + def + " must defend." : ""}</div>
    </div>
    <div class="battle-field">
      ${teamPanel("A")}
      <div class="center-panel">
        ${phase === "choose_attack" ? attackCenter(atk) : ""}
        ${phase === "question" ? questionCenter(atk, def) : ""}
        ${phase === "confirm_block" ? blockCenter(def) : ""}
        ${phase === "ehud_roll" ? ehudRollCenter(atk, def) : ""}
        ${phase === "taunt_roll" ? tauntCenter(atk, def) : ""}
      </div>
      ${teamPanel("B")}
    </div>
  `;

  wireBattleUi(root, atk, def, phase);
}

function runtimeTags(t) {
  const r = t.runtime;
  if (!t.character) return "";
  let bits = [];
  if (t.character.id === "david") {
    bits.push(`Stones: ${r.stoneCounters ?? 0}`);
    bits.push(`Divine: ${r.divineStance === "exhausted" ? "cooldown" : "ready"}`);
  }
  if (t.character.id === "samson") {
    bits.push(`Hair tokens: ${r.hairTokens ?? 0}`);
  }
  if (!bits.length) return "";
  return `<div style="margin-top:.35rem;font-size:.85rem;color:var(--muted);">${bits.join(" · ")}</div>`;
}

function attackCenter(atk) {
  // Attack buttons are now shown on the team panels, so this returns empty
  return "";
}

function questionCenter(atk, def) {
  const q = state.currentQuestion;
  if (!q) return `<p>Loading question…</p>`;
  const choices = q.choices
    .map(
      (c, i) =>
        `<button type="button" data-ans="${i}">${i + 1}. ${escapeHtml(c)}</button>`
    )
    .join("");
  return `
    <div class="question-panel">
      <div class="hint">Team <strong>${def}</strong> — answer to defend!</div>
      <h3>${escapeHtml(q.question)}</h3>
      <div class="choices">${choices}</div>
    </div>
  `;
}

function ehudRollCenter(atk, def) {
  const pending = state.ehudPending;
  const roll = state.ehudRoll;
  if (!roll) {
    return `
      <div class="question-panel">
        <div class="hint">Ehud activated! Roll dice to trigger the follow-up.</div>
        <div class="ehud-dice-row">
          <div class="die die--pending"><span class="die-placeholder">?</span></div>
          <div class="die die--pending"><span class="die-placeholder">?</span></div>
        </div>
        <div class="row-actions">
          <button type="button" class="btn btn-primary" data-ehud-roll>Roll Ehud Dice</button>
        </div>
      </div>
    `;
  }

  const diceMarkup = `
    <div class="ehud-dice-row">
      ${dieFaceMarkup(roll.d1)}
      ${dieFaceMarkup(roll.d2)}
    </div>
  `;

  const resultText = roll.sum === 7
    ? `Sum ${roll.sum}: defender will skip their next turn.`
    : roll.sum === 5 || roll.sum === 9
      ? `Sum ${roll.sum}: extra 100 damage dealt to the defender.`
      : roll.sum === 6 || roll.sum === 8
        ? `Sum ${roll.sum}: extra 200 damage dealt to the defender.`
        : `Sum ${roll.sum}: no extra effect this time.`;

  return `
    <div class="question-panel">
      <div class="hint">Ehud follow-up result</div>
      ${diceMarkup}
      <p>${escapeHtml(resultText)}</p>
      <div class="row-actions">
        <button type="button" class="btn btn-primary" data-ehud-end-turn>End Turn</button>
      </div>
    </div>
  `;
}

function tauntCenter(atk, def) {
  const roll = state.tauntRoll;
  if (!roll) {
    return `
      <div class="question-panel">
        <div class="hint">Goliath's Taunt</div>
        <div class="ehud-dice-row">
          <div class="die die--pending"><span class="die-placeholder">?</span></div>
        </div>
        <div class="row-actions">
          <button type="button" class="btn btn-primary" data-taunt-roll>Roll Taunt Die</button>
        </div>
      </div>
    `;
  }

  const dieMarkup = dieFaceMarkup(roll.value);
  const resultText = roll.value >= 3
    ? `Roll ${roll.value}: opponent takes 300 damage.`
    : `Roll ${roll.value}: you take 300 damage.`;

  return `
    <div class="question-panel">
      <div class="hint">Taunt result</div>
      <div class="ehud-dice-row">
        ${dieMarkup}
      </div>
      <p>${escapeHtml(resultText)}</p>
    </div>
  `;
}

function blockCenter(defender) {
  const pb = state.pendingBlock;
  if (!pb) return "";
  return `
    <div class="block-panel">
      <strong>Incoming ${pb.damage} damage!</strong>
      <p>Lord's Anointed — prevent this damage once?</p>
      <div class="attack-row">
        <button type="button" class="btn-primary" data-block-yes>Prevent damage</button>
        <button type="button" data-block-no>Take damage</button>
      </div>
    </div>
  `;
}

async function wireBattleUi(root, atk, def, phase) {
  const stoneCb = root.querySelector("[data-stone-toggle]");
  if (stoneCb) {
    stoneCb.addEventListener("change", () => {
      mergeState({ pendingStoneToggle: stoneCb.checked });
    });
  }

  const jealousy = root.querySelector("[data-jealousy]");
  if (jealousy) {
    jealousy.onclick = async () => {
      const res = applyJealousy(state, atk);
      await dispatchResult(res);
    };
  }

  const taunt = root.querySelector("[data-taunt]");
  if (taunt) {
    taunt.onclick = async () => {
      const res = applyTaunt(state, atk);
      await dispatchResult(res);
    };
  }

  const divine = root.querySelector("[data-divine]");
  if (divine) {
    divine.onclick = async () => {
      const res = applyDivineProtection(state, atk);
      await dispatchResult(res);
    };
  }

  const endTurnButtons = root.querySelectorAll("[data-end-turn]");
  endTurnButtons.forEach((btn) => {
    btn.onclick = async () => {
      await dispatchResult({
        patch: {
          battlePhase: "idle",
          currentQuestion: null,
          selectedAttackType: null,
          pendingStone: false,
          pendingBlock: null,
        },
        effects: [],
        advanceTurn: true,
      });
    };
  });

  const ehudEndTurn = root.querySelector("[data-ehud-end-turn]");
  if (ehudEndTurn) {
    ehudEndTurn.onclick = async () => {
      await dispatchResult({
        patch: {
          battlePhase: "idle",
          currentQuestion: null,
          selectedAttackType: null,
          pendingStone: false,
          pendingBlock: null,
          ehudPending: null,
          ehudRoll: null,
        },
        effects: [],
        advanceTurn: true,
      });
    };
  }

  const tauntRollBtn = root.querySelector("[data-taunt-roll]");
  if (tauntRollBtn) {
    tauntRollBtn.onclick = async () => {
      const roll = rollDie();
      await dispatchResult({
        patch: {
          tauntRoll: { value: roll },
        },
        effects: [
          { type: "TAUNT_ROLL", team: atk, value: roll },
          { type: "SFX_DICE" },
        ],
      });
      await new Promise(r => setTimeout(r, 200));
      const isSuccess = roll >= 3;
      const damage = 300;
      const targetTeam = isSuccess ? def : atk;
      const effects = [
        { type: "HIT", team: targetTeam },
        { type: "DAMAGE_TEXT", team: targetTeam, amount: damage },
        { type: "SFX_HIT" },
      ];
      const patch = {
        teams: (() => {
          const teams = { ...state.teams };
          if (targetTeam === atk) {
            teams[atk] = {
              ...teams[atk],
              hp: Math.max(0, teams[atk].hp - damage),
              runtime: { ...teams[atk].runtime, tauntUsedThisTurn: true },
            };
          } else {
            teams[targetTeam] = {
              ...teams[targetTeam],
              hp: Math.max(0, teams[targetTeam].hp - damage),
            };
            teams[atk] = {
              ...teams[atk],
              runtime: { ...teams[atk].runtime, tauntUsedThisTurn: true },
            };
          }
          return teams;
        })(),
      };
      await dispatchResult({ patch, effects });
      await dispatchResult({
        patch: {
          battlePhase: "choose_attack",
          tauntRoll: null,
        },
        effects: [],
      });
    };
  }

  root.querySelectorAll("[data-atk]").forEach((btn) => {
    btn.onclick = async () => {
      const attackType = btn.getAttribute("data-atk");
      mergeState({
        selectedAttackType: attackType,
        pendingStone: !!state.pendingStoneToggle,
        battlePhase: "question",
      });
      const res = await nextQuestion(
        attackType,
        state.usedQuestionIds,
        Math.random
      );
      if (res.error) {
        mergeState({ battlePhase: "choose_attack", currentQuestion: null });
        alert("No questions available.");
        scenes.refresh(buildCtx());
        return;
      }
      mergeState({
        currentQuestion: res.question,
        usedQuestionIds: [...state.usedQuestionIds, res.question.id],
      });
      scenes.refresh(buildCtx());
    };
  });

  root.querySelectorAll("[data-ans]").forEach((btn) => {
    btn.onclick = async () => {
      const idx = Number(btn.getAttribute("data-ans"));
      const q = state.currentQuestion;
      const ok = idx === q.correctIndex;
      const usedStone =
        !!state.pendingStone &&
        state.teams[atk].character?.id === "david" &&
        (state.teams[atk].runtime.stoneCounters ?? 0) > 0;

      const pack = buildDamagePackage({
        state,
        attacker: atk,
        defender: def,
        attackType: state.selectedAttackType,
        wasCorrect: ok,
        usedStone,
        declinedAnointed: false,
      });

      if (pack.patch.battlePhase === "confirm_block") {
        mergeState({
          battlePhase: "confirm_block",
          pendingBlock: pack.patch.pendingBlock,
          pendingStone: pack.patch.pendingStone,
        });
        scenes.refresh(buildCtx());
        return;
      }

      await dispatchResult(pack);
    };
  });

  const yes = root.querySelector("[data-block-yes]");
  const no = root.querySelector("[data-block-no]");
  if (yes) {
    yes.onclick = async () => {
      await dispatchResult(confirmAnointedUse(state));
    };
  }
  if (no) {
    no.onclick = async () => {
      await dispatchResult(confirmAnointedDecline(state));
    };
  }

  const ehudRollBtn = root.querySelector("[data-ehud-roll]");
  if (ehudRollBtn) {
    ehudRollBtn.onclick = async () => {
      const d1 = rollDie();
      const d2 = rollDie();
      const sum = d1 + d2;
      const pb = state.ehudPending;
      if (!pb) return;
      const defender = pb.defender;
      const attacker = pb.attacker;
      await dispatchResult({
        patch: {
          ehudPending: null,
          ehudRoll: { d1, d2, sum },
          battlePhase: "ehud_roll",
        },
        effects: [
          { type: "EHUD_ROLL", team: attacker, d1, d2, sum },
          { type: "SFX_DICE" },
        ],
      });
      await new Promise(r => setTimeout(r, 200));
      let effectPatch = {};
      const effectEffects = [];
      if (sum === 7) {
        effectPatch.skipNextFor = defender;
      } else {
        let extraDamage = 0;
        if (sum === 5 || sum === 9) extraDamage = 100;
        else if (sum === 6 || sum === 8) extraDamage = 200;
        if (extraDamage > 0) {
          effectEffects.push(
            { type: "HIT", team: defender },
            { type: "DAMAGE_TEXT", team: defender, amount: extraDamage },
            { type: "SFX_HIT" }
          );
        }
      }
      if (Object.keys(effectPatch).length || effectEffects.length) {
        await dispatchResult({ patch: effectPatch, effects: effectEffects });
      }
    };
  }
}

/* ---- Scene: GAME_OVER ---- */

function renderGameOver(root) {
  const w = state.winner;
  const winnerTeam = state.teams[w] || {};
  const winnerChar = winnerTeam.character;
  const winnerImage = winnerChar
    ? getCharacterImageUrl(winnerChar.image)
    : "";
  const winnerName = winnerChar ? escapeHtml(winnerChar.name) : "Unknown Hero";
  root.innerHTML = `
    <h1 class="scene-title">Victory!</h1>
    <p class="pick-banner">Winner: <strong>Team ${w}</strong></p>
    <div class="winner-card">
      ${winnerChar ? `<img class="winner-portrait" src="${winnerImage}" alt="${winnerName}" />` : ""}
      <div class="winner-meta">
        <h2>${winnerName}</h2>
        <p>Team ${w} wins the battle!</p>
      </div>
    </div>
    <div class="game-over-actions">
      <button type="button" class="btn btn-primary" data-back>← Main Menu</button>
    </div>
  `;
  root.querySelector("[data-back]").onclick = () => {
    state = createInitialState();
    scenes.show(SCENES.MAIN_MENU, buildCtx());
  };
}

/* ---- Admin ---- */

const uiActions = {};

adminBar.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-admin]");
  if (!btn) return;
  const key = btn.getAttribute("data-admin");
  if (key === "reset") {
    showResetModal();
    return;
  }
  if (state.scene !== SCENES.BATTLE) return;
  if (key === "hp-ap")
    mergeState({
      teams: {
        ...state.teams,
        A: { ...state.teams.A, hp: state.teams.A.hp + 100 },
      },
    });
  if (key === "hp-am")
    mergeState({
      teams: {
        ...state.teams,
        A: { ...state.teams.A, hp: Math.max(0, state.teams.A.hp - 100) },
      },
    });
  if (key === "hp-bp")
    mergeState({
      teams: {
        ...state.teams,
        B: { ...state.teams.B, hp: state.teams.B.hp + 100 },
      },
    });
  if (key === "hp-bm")
    mergeState({
      teams: {
        ...state.teams,
        B: { ...state.teams.B, hp: Math.max(0, state.teams.B.hp - 100) },
      },
    });
  if (key === "skip-q" && state.battlePhase === "question") {
    const atk = state.currentTurn;
    const def = otherTeam(atk);
    const pack = buildDamagePackage({
      state,
      attacker: atk,
      defender: def,
      attackType: state.selectedAttackType,
      wasCorrect: true,
      usedStone: false,
      declinedAnointed: false,
    });
    dispatchResult(pack);
  }
});

musicBtn.addEventListener("click", () => {
  mergeState({ musicEnabled: !state.musicEnabled });
  syncMusicButton();
});

/* ---- Register & boot ---- */

scenes.register(SCENES.MAIN_MENU, renderMainMenu);
scenes.register(SCENES.INSTRUCTIONS, renderInstructions);
scenes.register(SCENES.DICE_ROLL, renderDice);
scenes.register(SCENES.CHAR_SELECT, renderCharSelect);
scenes.register(SCENES.BATTLE, renderBattle);
scenes.register(SCENES.GAME_OVER, renderGameOver);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[ch];
  });
}

setupBgm();
syncMusicButton();
tryPlayBgm();

loadAllCharacters().catch(() => {});
scenes.show(SCENES.MAIN_MENU, buildCtx());

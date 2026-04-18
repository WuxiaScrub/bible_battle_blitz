/**
 * DOM-driven animations; callers await effects via short timeouts if needed.
 */

export function createAnimationEngine(rootEl) {
  function panel(teamId) {
    return rootEl.querySelector(`[data-team="${teamId}"]`);
  }

  function characterWrap(teamId) {
    return rootEl.querySelector(`[data-team="${teamId}"] .character-card`);
  }

  function floatingLayer(teamId) {
    let layer = rootEl.querySelector(`[data-float-layer="${teamId}"]`);
    if (!layer) {
      const p = panel(teamId);
      if (!p) return null;
      layer = document.createElement("div");
      layer.dataset.floatLayer = teamId;
      layer.className = "float-layer";
      p.querySelector(".character-stage")?.appendChild(layer);
    }
    return layer;
  }

  return {
    playHitAnimation(teamId) {
      const el = characterWrap(teamId);
      if (!el) return;
      el.classList.remove("shake");
      void el.offsetWidth;
      el.classList.add("shake");
      setTimeout(() => el.classList.remove("shake"), 450);
    },

    playShieldAnimation(teamId) {
      const stage = panel(teamId)?.querySelector(".character-stage");
      if (!stage) return;
      const shieldOverlay = document.createElement("img");
      shieldOverlay.src = "./assets/images/shield.png";
      shieldOverlay.className = "shield-overlay";
      shieldOverlay.setAttribute("aria-hidden", "true");
      stage.appendChild(shieldOverlay);
      // Fade out over 3 seconds
      setTimeout(() => shieldOverlay.remove(), 3000);
    },

    playDamageText(teamId, amount) {
      const layer = floatingLayer(teamId);
      if (!layer) return;
      const d = document.createElement("div");
      d.className = "damage-number";
      d.textContent = `-${amount}`;
      layer.appendChild(d);
      requestAnimationFrame(() => d.classList.add("rise"));
      setTimeout(() => d.remove(), 900);
    },

    playSkillAnimation(teamId) {
      const el = characterWrap(teamId);
      if (!el) return;
      el.classList.remove("skill-flash");
      void el.offsetWidth;
      el.classList.add("skill-flash");
      setTimeout(() => el.classList.remove("skill-flash"), 550);
    },

    /**
     * @param {{ type: string; team?: string; amount?: number }[]} effects
     */
    async runEffects(effects) {
      if (!effects?.length) return;
      for (const e of effects) {
        if (e.type === "HIT") this.playHitAnimation(e.team);
        else if (e.type === "SHIELD") this.playShieldAnimation(e.team);
        else if (e.type === "DAMAGE_TEXT")
          this.playDamageText(e.team, e.amount);
        else if (e.type === "SKILL_FLASH") this.playSkillAnimation(e.team);
        else if (e.type === "SFX_HIT") {
          const hitNum = 1 + Math.floor(Math.random() * 6);
          const hitAudio = new Audio(`./assets/sfx/sfx_hit0${hitNum}.mp3`);
          hitAudio.volume = 0.6;
          try {
            await hitAudio.play();
          } catch (_) {}
        } else if (e.type === "SFX_SHIELD") {
          const shieldAudio = new Audio("./assets/sfx/sfx_shield_block.mp3");
          shieldAudio.volume = 0.6;
          try {
            await shieldAudio.play();
          } catch (_) {}
        } else if (e.type === "SFX_DICE") {
          const diceAudio = new Audio("./assets/sfx/dice-1.wav");
          diceAudio.volume = 0.6;
          try {
            await diceAudio.play();
          } catch (_) {}
        }
        await new Promise((r) => setTimeout(r, e.type === "EHUD_ROLL" ? 400 : 180));
      }
    },
  };
}

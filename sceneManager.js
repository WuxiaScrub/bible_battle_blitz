/**
 * Scene registry: exactly one renderer mounted under `rootEl` at a time.
 */

export function createSceneManager(rootEl) {
  let activeName = null;
  const scenes = new Map();

  function mount(name, ctx) {
    const render = scenes.get(name);
    if (!render) return;
    rootEl.replaceChildren();
    activeName = name;
    render(rootEl, ctx);
  }

  return {
    register(name, renderFn) {
      scenes.set(name, renderFn);
    },
    show(name, ctx) {
      mount(name, ctx);
    },
    refresh(ctx) {
      if (activeName) mount(activeName, ctx);
    },
    get active() {
      return activeName;
    },
  };
}

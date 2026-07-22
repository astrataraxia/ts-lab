import { mountHomePage } from "./pages/home/page";
import { mountOrdHelper } from "./pages/ord-helper/controller";
import { mountVisualizer } from "./pages/sound-canvas/controller";

type Route = "home" | "visualizer" | "ord-helper";

export function startRouter(root: HTMLDivElement) {
  let cleanup: (() => void) | undefined;

  function renderRoute() {
    cleanup?.();
    cleanup = undefined;

    if (getCurrentRoute() === "visualizer") {
      cleanup = mountVisualizer(root);
      return;
    }

    if (getCurrentRoute() === "ord-helper") {
      cleanup = mountOrdHelper(root);
      return;
    }

    mountHomePage(root);
  }

  if (!window.location.hash) {
    window.history.replaceState(null, "", "#/home");
  }

  window.addEventListener("hashchange", renderRoute);
  renderRoute();

  return () => {
    cleanup?.();
    window.removeEventListener("hashchange", renderRoute);
  };
}

function getCurrentRoute(): Route {
  if (window.location.hash === "#/visualizer") {
    return "visualizer";
  }

  if (window.location.hash === "#/ord-helper") {
    return "ord-helper";
  }

  return "home";
}

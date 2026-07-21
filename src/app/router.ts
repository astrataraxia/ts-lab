import { mountHomePage } from "./pages/home/page";
import { mountVisualizer } from "./pages/sound-canvas/controller";

type Route = "home" | "visualizer";

export function startRouter(root: HTMLDivElement) {
  let cleanup: (() => void) | undefined;

  function renderRoute() {
    cleanup?.();
    cleanup = undefined;

    if (getCurrentRoute() === "visualizer") {
      cleanup = mountVisualizer(root);
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
  return window.location.hash === "#/visualizer" ? "visualizer" : "home";
}

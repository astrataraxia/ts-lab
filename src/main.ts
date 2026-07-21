import "./styles/global.css";
import { startRouter } from "./app/router";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root element was not found.");
}

startRouter(app);

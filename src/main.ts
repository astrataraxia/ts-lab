import "./styles/global.css";
import { mountHomePage } from "./app/pages/home/page";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root element was not found.");
}

mountHomePage(app);

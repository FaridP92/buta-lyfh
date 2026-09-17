import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/base.css";
import { App } from "./app/App";

const conteneur = document.getElementById("racine");
if (!conteneur) {
  throw new Error("Element #racine introuvable dans index.html");
}

createRoot(conteneur).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@tdesign-react/chat/es/style/index.js";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DietTracker from "./DietTracker.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <DietTracker />
  </StrictMode>
);

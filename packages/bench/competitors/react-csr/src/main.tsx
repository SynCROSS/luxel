import { createRoot } from "react-dom/client";
import { CounterApp } from "./App.tsx";
createRoot(document.getElementById("app")!).render(<CounterApp />);
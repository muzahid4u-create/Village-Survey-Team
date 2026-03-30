import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

async function clearLocalhostServiceWorkers() {
  if (typeof window === "undefined") return;

  const isLocalhost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  if (!isLocalhost || !("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    console.warn("Unable to clear stale localhost service workers", error);
  }
}

void clearLocalhostServiceWorkers();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

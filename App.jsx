import { useState } from "react";
import Home from "./Home.jsx";
import CustomersScreen from "./CustomersScreen.jsx";
import TeamsScreen from "./TeamsScreen.jsx";

/**
 * Top-level screen router. We use plain useState rather than react-router
 * because the app is single-window and three screens deep — a router
 * would just add a dep. Screens receive a `back` callback that returns
 * them to home; Home receives `goTo` to navigate forward.
 */
export default function App() {
  const [screen, setScreen] = useState("home");

  if (screen === "customers") {
    return <CustomersScreen back={() => setScreen("home")} />;
  }
  if (screen === "teams") {
    return <TeamsScreen back={() => setScreen("home")} />;
  }
  return <Home goTo={setScreen} />;
}

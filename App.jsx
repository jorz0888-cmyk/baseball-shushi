import { useState } from "react";
import Home from "./Home.jsx";
import CustomersScreen from "./CustomersScreen.jsx";
import TeamsScreen from "./TeamsScreen.jsx";
import DailyInputScreen from "./DailyInputScreen.jsx";
import WeeklySettlementScreen from "./WeeklySettlementScreen.jsx";

/**
 * Top-level screen router. Plain useState — the app is single-window
 * and ≤5 screens deep so a router lib would just add weight.
 */
export default function App() {
  const [screen, setScreen] = useState("home");

  if (screen === "customers") {
    return <CustomersScreen back={() => setScreen("home")} />;
  }
  if (screen === "teams") {
    return <TeamsScreen back={() => setScreen("home")} />;
  }
  if (screen === "daily") {
    return <DailyInputScreen back={() => setScreen("home")} />;
  }
  if (screen === "settlement") {
    return <WeeklySettlementScreen back={() => setScreen("home")} />;
  }
  return <Home goTo={setScreen} />;
}

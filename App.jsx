import { useState } from "react";
import Home from "./Home.jsx";
import CustomersScreen from "./CustomersScreen.jsx";
import TeamsScreen from "./TeamsScreen.jsx";
import DailyInputScreen from "./DailyInputScreen.jsx";
import WeeklySettlementScreen from "./WeeklySettlementScreen.jsx";
import UpdateBanner from "./UpdateBanner.jsx";

/**
 * Top-level screen router. Plain useState — the app is single-window
 * and ≤5 screens deep so a router lib would just add weight.
 *
 * UpdateBanner is rendered outside the screen switch so the PWA
 * update notice persists across navigation.
 */
export default function App() {
  const [screen, setScreen] = useState("home");

  let content;
  if (screen === "customers") {
    content = <CustomersScreen back={() => setScreen("home")} />;
  } else if (screen === "teams") {
    content = <TeamsScreen back={() => setScreen("home")} />;
  } else if (screen === "daily") {
    content = <DailyInputScreen back={() => setScreen("home")} />;
  } else if (screen === "settlement") {
    content = <WeeklySettlementScreen back={() => setScreen("home")} />;
  } else {
    content = <Home goTo={setScreen} />;
  }

  return (
    <>
      {content}
      <UpdateBanner />
    </>
  );
}

import { useState } from "react";
import Topbar from "@/components/Topbar";
import LivePage from "@/pages/LivePage";
import PlayersPage from "@/pages/PlayersPage";
import RankingsPage from "@/pages/RankingsPage";

export default function AppShell() {
  const [active, setActive] = useState("live");
  const [query, setQuery] = useState("");

  return (
    <div className="min-h-screen text-slate-900 bg-gradient-to-b from-white to-slate-50">
      <Topbar active={active} setActive={setActive} query={query} setQuery={setQuery} />
      {active === "live" && <LivePage query={query} />}
      {active === "players" && <PlayersPage query={query} />}
      {active === "rankings" && <RankingsPage query={query} />}
      <div className="h-10" />
    </div>
  );
}

import { useMemo, useState } from "react";
import { players } from "@/mock/players";
import PlayerDrawer from "@/components/PlayerDrawer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PlayersPage({ query }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const list = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) =>
      [p.name, p.team, p.pos].some((x) => x.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Jogadores</div>
          <div className="text-sm text-slate-500">Busca rápida + perfil em painel</div>
        </div>
        <div className="text-xs text-slate-500">{list.length} resultados</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((p) => (
          <Card key={p.id} className="rounded-3xl border-slate-200 bg-white shadow-sm hover:shadow-md transition">
            <CardContent className="p-4">
              <button
                className="w-full text-left"
                onClick={() => {
                  setSelected(p);
                  setDrawerOpen(true);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.team}</div>
                  </div>
                  <Badge variant="secondary" className="rounded-full border border-slate-200 bg-white">
                    {p.pos}
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Mini label="Gols" value={p.g} />
                  <Mini label="Ass." value={p.a} />
                  <Mini label="% Pass" value={p.passPct} />
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  Passes: {p.pc}/{p.pt} • Desarmes: {p.des} • Min: {p.mins}
                </div>
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      <PlayerDrawer open={drawerOpen} onOpenChange={setDrawerOpen} player={selected} />
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-2 bg-white">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

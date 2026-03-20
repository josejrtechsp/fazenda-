import { useMemo, useState } from "react";
import { liveMatches } from "@/mock/live";
import MatchCard from "@/components/MatchCard";
import PlayerDrawer from "@/components/PlayerDrawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function LivePage({ query }) {
  const [openMatchId, setOpenMatchId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const matches = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return liveMatches;
    return liveMatches.filter((m) =>
      [m.home, m.away, m.competition].some((x) => x.toLowerCase().includes(q))
    );
  }, [query]);

  const openMatch = matches.find((m) => m.id === openMatchId) || matches[0] || null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Ao vivo</div>
          <div className="text-sm text-slate-500">Jogos em andamento • Atualização simulada (mock)</div>
        </div>
        <div className="text-xs text-slate-500">{matches.length} jogos</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">
        <div className="space-y-4">
          {matches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              selected={(openMatch?.id || matches[0]?.id) === m.id}
              onOpen={() => setOpenMatchId(m.id)}
            />
          ))}
        </div>

        {!openMatch ? null : (
          <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div>
                  <div className="text-lg font-semibold">
                    {openMatch.home}{" "}
                    <span className="tabular-nums">{openMatch.scoreHome}</span>
                    <span className="text-slate-300 px-2">×</span>
                    <span className="tabular-nums">{openMatch.scoreAway}</span>{" "}
                    {openMatch.away}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {openMatch.competition} • {openMatch.minute}
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  Cartões: {openMatch.highlights.yellow} amarelos • {openMatch.highlights.red} vermelhos
                </div>
              </div>

              <Tabs defaultValue="players">
                <TabsList className="rounded-full">
                  <TabsTrigger value="players">Jogadores</TabsTrigger>
                  <TabsTrigger value="events">Eventos</TabsTrigger>
                </TabsList>

                <TabsContent value="players" className="mt-4">
                  <div className="rounded-3xl border border-slate-200 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Jogador</TableHead>
                          <TableHead>Min</TableHead>
                          <TableHead>G</TableHead>
                          <TableHead>A</TableHead>
                          <TableHead>Passes</TableHead>
                          <TableHead>Fin</TableHead>
                          <TableHead>Des</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {openMatch.topPlayers.map((p, idx) => (
                          <TableRow
                            key={p.id}
                            className={[
                              "cursor-pointer",
                              idx % 2 === 1 ? "bg-white" : "bg-slate-50/40",
                              "hover:bg-slate-100",
                            ].join(" ")}
                            onClick={() => {
                              setSelectedPlayer(p);
                              setDrawerOpen(true);
                            }}
                          >
                            <TableCell className="font-medium">
                              {p.name}{" "}
                              <span className="text-xs text-slate-500">({p.team})</span>
                            </TableCell>
                            <TableCell className="tabular-nums">{p.min}</TableCell>
                            <TableCell className="tabular-nums">{p.g}</TableCell>
                            <TableCell className="tabular-nums">{p.a}</TableCell>
                            <TableCell className="tabular-nums">{p.pc}/{p.pt}</TableCell>
                            <TableCell className="tabular-nums">{p.fin}</TableCell>
                            <TableCell className="tabular-nums">{p.des}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="events" className="mt-4">
                  <div className="space-y-2">
                    {openMatch.events.map((e, idx) => (
                      <div key={idx} className="rounded-3xl border border-slate-200 p-4 bg-white">
                        <div className="text-xs text-slate-500">
                          {e.t} • {e.type} • {e.who}
                        </div>
                        <div className="text-sm font-medium mt-1">{e.desc}</div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>

      <PlayerDrawer open={drawerOpen} onOpenChange={setDrawerOpen} player={selectedPlayer} />
    </div>
  );
}

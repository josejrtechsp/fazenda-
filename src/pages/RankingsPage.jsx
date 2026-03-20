import { useMemo, useState } from "react";
import { rankingMetrics, rankings } from "@/mock/rankings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export default function RankingsPage({ query }) {
  const [metric, setMetric] = useState(rankingMetrics[0].key);

  const rows = useMemo(() => {
    const list = rankings[metric] || [];
    const q = (query || "").trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => [r.name, r.team].some((x) => x.toLowerCase().includes(q)));
  }, [metric, query]);

  const metricLabel = rankingMetrics.find((m) => m.key === metric)?.label || "Métrica";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Rankings</div>
          <div className="text-sm text-slate-500">Top por métrica (mock)</div>
        </div>

        <DropdownMenu>
          <DropdownMenuContent align="end">
            {({ side }) => (
              <>
                <summary className="list-none">
                  <Button variant="secondary" className="rounded-full border border-slate-200 bg-white">
                    {metricLabel}
                  </Button>
                </summary>
                <div className={["absolute mt-2 w-60 rounded-3xl border border-slate-200 bg-white shadow-lg", side].join(" ")}>
                  {rankingMetrics.map((m) => (
                    <DropdownMenuItem key={m.key} onClick={() => setMetric(m.key)}>
                      {m.label}
                    </DropdownMenuItem>
                  ))}
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="rounded-3xl border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>#</TableHead>
                  <TableHead>Jogador</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">{metricLabel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, idx) => (
                  <TableRow key={r.id} className={["hover:bg-slate-50", idx % 2 ? "bg-white" : "bg-slate-50/40"].join(" ")}>
                    <TableCell className="text-slate-500 tabular-nums">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-slate-500">{r.team}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{r.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

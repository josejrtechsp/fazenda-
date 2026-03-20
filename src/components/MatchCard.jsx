import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MatchCard({ match, onOpen, selected = false }) {
  return (
    <Card
      className={[
        "rounded-3xl border-slate-200 bg-white shadow-sm transition",
        "hover:shadow-md hover:-translate-y-[1px]",
        selected ? "ring-2 ring-slate-900/10" : "",
      ].join(" ")}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Badge className="rounded-full bg-emerald-600 text-white">AO VIVO</Badge>
          <span className="text-xs text-slate-500">{match.competition}</span>
          <span className="ml-auto text-xs text-slate-500">{match.minute}</span>
        </div>

        <button onClick={onOpen} className="w-full text-left">
          <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
            <div className="space-y-1">
              <div className="text-sm font-semibold">{match.home}</div>
              <div className="text-sm font-semibold">{match.away}</div>
            </div>

            <div className="text-right">
              <div className="text-3xl leading-none font-bold tabular-nums">
                {match.scoreHome}<span className="text-slate-300 px-1">×</span>{match.scoreAway}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Cartões: {match.highlights.yellow}A • {match.highlights.red}V
              </div>
            </div>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}

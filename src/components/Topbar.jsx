import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ROUTES } from "@/app/routes";

export default function Topbar({ active, setActive, query, setQuery }) {
  return (
    <div className="sticky top-0 z-20 bg-white/75 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <button
          className="flex items-center gap-2 rounded-2xl px-2 py-1 hover:bg-slate-50 transition"
          onClick={() => setActive("live")}
          aria-label="Ir para Ao vivo"
        >
          <div className="h-9 w-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-semibold">
            S
          </div>
          <div className="leading-tight text-left">
            <div className="text-sm font-semibold">Scout</div>
            <div className="text-xs text-slate-500">Série A &amp; B</div>
          </div>
        </button>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full bg-slate-100 p-1">
            {ROUTES.map((r) => (
              <button
                key={r.key}
                onClick={() => setActive(r.key)}
                className={[
                  "px-3 py-1.5 rounded-full text-sm transition",
                  active === r.key
                    ? "bg-white shadow-sm border border-slate-200 text-slate-900"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60",
                ].join(" ")}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Badge variant="secondary" className="rounded-full border border-slate-200 bg-white">
            MVP
          </Badge>
        </div>

        <div className="ml-auto w-full max-w-sm">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jogador, time..."
            className="rounded-full bg-white"
          />
        </div>
      </div>
    </div>
  );
}

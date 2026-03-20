import { Badge } from "@/components/ui/badge";

export default function PlayerDrawer({ open, onOpenChange, player }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-black/25"
        onClick={() => onOpenChange(false)}
        aria-label="Fechar"
      />
      <div className="absolute right-0 top-0 h-full w-[420px] sm:w-[460px] bg-white border-l border-slate-200 p-5 overflow-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold leading-tight">
              {player ? player.name : "Jogador"}
            </div>
            {player ? (
              <div className="mt-1">
                <Badge variant="secondary" className="rounded-full border border-slate-200 bg-white">
                  {player.team} • {player.pos}
                </Badge>
              </div>
            ) : null}
          </div>

          <button
            className="h-9 w-9 rounded-full border border-slate-200 hover:bg-slate-50 transition flex items-center justify-center"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar painel"
            title="Fechar"
          >
            ✕
          </button>
        </div>

        {!player ? (
          <div className="mt-8 text-sm text-slate-500">Selecione um jogador.</div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Minutos" value={player.min ?? player.mins ?? "-"} />
              <Stat label="Gols" value={player.g ?? 0} />
              <Stat label="Assist." value={player.a ?? 0} />
              <Stat label="Passes" value={`${player.pc ?? 0}/${player.pt ?? 0}`} />
              <Stat label="Finalizações" value={player.fin ?? "-"} />
              <Stat label="Desarmes" value={player.des ?? "-"} />
            </div>

            <div className="text-xs text-slate-500">
              * MVP front com dados mockados (sem back ainda).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-3xl border border-slate-200 p-3 bg-white">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

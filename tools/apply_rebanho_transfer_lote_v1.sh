#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Paths (relative to project root when applied)
FRONT="$ROOT/frontend/src/pages/Herd.jsx"
BACK="$ROOT/backend/app/routers/herd.py"

python3 - <<'PY'
from pathlib import Path
import re

root = Path('.').resolve()
front = root/'frontend'/'src'/'pages'/'Herd.jsx'
back  = root/'backend'/'app'/'routers'/'herd.py'

if not front.exists():
    raise SystemExit(f"ERRO: não achei {front}")
if not back.exists():
    raise SystemExit(f"ERRO: não achei {back}")

# -------- BACK: add /herd/move endpoint (idempotent) --------
bs = back.read_text(encoding='utf-8', errors='ignore')
if 'REBANHO_TRANSFER_LOTE_V1' not in bs:
    insert = r'''

# === REBANHO_TRANSFER_LOTE_V1 ===
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

try:
    from app.models import Event
except Exception:  # pragma: no cover
    Event = None

class HerdMoveReq(BaseModel):
    from_lot_id: int
    to_lot_id: int
    ear_tags: List[str]
    reason: Optional[str] = None
    note: Optional[str] = None

@router.post("/move")
def move_animals(req: HerdMoveReq, session: Session = Depends(get_session)):
    """Move animals between lots (canonical)."""
    from_id = int(req.from_lot_id)
    to_id = int(req.to_lot_id)
    if from_id == to_id:
        return {"ok": False, "error": "from_lot_id igual to_lot_id"}

    ear_tags = [str(x).strip() for x in (req.ear_tags or []) if str(x).strip()]
    if not ear_tags:
        return {"ok": False, "error": "ear_tags vazio"}

    moved = 0
    lot_to = session.get(HerdLot, to_id)
    to_area = getattr(lot_to, "area_name", None) if lot_to else None
    for ear in ear_tags:
        a = session.get(HerdAnimal, ear)
        if not a:
            continue
        # Only move active animals
        if getattr(a, 'status', 'active') not in (None, '', 'active', 'ATIVO', 'ativo'):
            continue
        a.lot_id = to_id
        if to_area is not None and hasattr(a, "area_name"):
            try:
                a.area_name = to_area
            except Exception:
                pass
        moved += 1

    # update lot heads based on count of active animals
    def _recount(lot_id: int) -> int:
        try:
            q = session.exec(select(HerdAnimal).where(HerdAnimal.lot_id == lot_id)).all()
            return sum(1 for x in q if getattr(x, 'status', 'active') in (None, '', 'active', 'ATIVO', 'ativo'))
        except Exception:
            return 0

    for lid in (from_id, to_id):
        lot = session.get(HerdLot, lid)
        if lot:
            lot.heads = _recount(lid)

    # audit event (optional)
    if Event is not None:
        try:
            ev = Event(
                type="transfer",
                status="approved",
                occurred_at=datetime.utcnow(),
                payload={
                    "transfer": {
                        "from_lot": from_id,
                        "to_lot": to_id,
                        "ear_tags": ear_tags,
                        "reason": req.reason,
                        "note": req.note,
                    }
                },
            )
            session.add(ev)
        except Exception:
            pass

    session.commit()
    return {"ok": True, "moved": moved, "from_lot_id": from_id, "to_lot_id": to_id}
'''

    # Ensure we have select imported
    if 'from sqlmodel import Session, select' not in bs and 'select' in insert:
        # try to add select in existing sqlmodel import line
        bs = re.sub(r'from\s+sqlmodel\s+import\s+Session\b', 'from sqlmodel import Session, select', bs, count=1)

    bs = bs.rstrip() + insert
    back.write_text(bs, encoding='utf-8')

# -------- FRONT: add Transfer tab UI (idempotent) --------
fs = front.read_text(encoding='utf-8', errors='ignore')
if 'REBANHO_TRANSFER_LOTE_V1' not in fs:
    # 1) add tab state + transfer state near tab definition
    # find tab state
    m = re.search(r"const\s*\[tab,\s*setTab\]\s*=\s*useState\(\"[a-zA-Z_]+\"\);", fs)
    if not m:
        raise SystemExit('ERRO: não encontrei state tab em Herd.jsx')

    transfer_state = r'''

  // === REBANHO_TRANSFER_LOTE_V1 ===
  const [xferFromLot, setXferFromLot] = useState(null);
  const [xferToLot, setXferToLot] = useState(null);
  const [xferQ, setXferQ] = useState("");
  const [xferReason, setXferReason] = useState("manejo");
  const [xferNote, setXferNote] = useState("");
  const [xferPick, setXferPick] = useState({}); // ear_tag -> bool
  const [xferAnimals, setXferAnimals] = useState([]);
  const [xferBusy, setXferBusy] = useState(false);
  const [xferMsg, setXferMsg] = useState(null);
'''

    insert_pos = m.end()
    fs = fs[:insert_pos] + transfer_state + fs[insert_pos:]

    # 2) add helpers: open transfer, load animals, confirm
    # We'll insert after loadAnimalsForLot function (if exists) or after loadLots.
    anchor = 'async function loadAnimalsForLot'
    idx = fs.find(anchor)
    if idx == -1:
        # fallback: after loadLots
        idx = fs.find('async function loadLots')
    if idx == -1:
        raise SystemExit('ERRO: não achei função loadLots/loadAnimalsForLot')

    # insert just before anchor line
    insert_idx = idx

    helpers = r'''

  function openTransferTab(fromLotId){
    const fromId = Number(fromLotId ?? selectedLotId);
    setXferFromLot(fromId);
    // pick default to first different lot
    const candidate = (lots || []).find(l => Number(l.id) !== Number(fromId));
    setXferToLot(candidate ? Number(candidate.id) : null);
    setXferPick({});
    setXferQ("");
    setXferReason("manejo");
    setXferNote("");
    setXferMsg(null);
    setTab("transfer");
  }

  async function loadXferAnimals(lotId){
    try {
      const data = await api.get(`/herd/animals?lot_id=${encodeURIComponent(lotId)}`);
      setXferAnimals(Array.isArray(data?.animals) ? data.animals : []);
    } catch {
      setXferAnimals([]);
    }
  }

  async function confirmTransfer(){
    if (!xferFromLot || !xferToLot){
      setXferMsg("Selecione origem e destino.");
      return;
    }
    const picks = Object.entries(xferPick || {}).filter(([,v]) => v).map(([k]) => k);
    if (!picks.length){
      setXferMsg("Selecione ao menos 1 animal.");
      return;
    }
    try {
      setXferBusy(true);
      setXferMsg(null);
      const resp = await api.post('/herd/move', {
        from_lot_id: Number(xferFromLot),
        to_lot_id: Number(xferToLot),
        ear_tags: picks,
        reason: xferReason,
        note: xferNote,
      });
      await refreshAll();
      setXferMsg(`Transferência aplicada: ${resp?.moved ?? picks.length} animal(is).`);
      setTab('lots');
      setNotice(`Transferência aplicada: ${resp?.moved ?? picks.length} animal(is).`);
      setTimeout(() => setNotice(null), 6000);
    } catch (e){
      setXferMsg(`Falha ao transferir: ${e?.message || 'erro'}`);
    } finally {
      setXferBusy(false);
    }
  }
'''

    fs = fs[:insert_idx] + helpers + fs[insert_idx:]

    # 3) Hook: when transfer tab active and from lot changes, load animals
    # Insert a useEffect after existing useEffect for selectedLotId if present.
    if 'loadXferAnimals' in fs and "tab !== 'transfer'" not in fs:
        # place near other useEffect blocks: after selectedLotId effect
        ue = "useEffect(() => {\n    if (!lots.length) return;"
        pos = fs.find(ue)
        # just append a new useEffect near end of effects section
        insert_effect = r'''

  useEffect(() => {
    if (tab !== 'transfer') return;
    if (!xferFromLot) return;
    loadXferAnimals(xferFromLot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, xferFromLot]);
'''
        # insert after first useEffect block (after refreshAll effect) as safe
        first_ue_end = fs.find('}, []);')
        if first_ue_end != -1:
            first_ue_end = first_ue_end + len('}, []);')
            fs = fs[:first_ue_end] + insert_effect + fs[first_ue_end:]
        else:
            # append near top
            fs = fs.replace(m.group(0), m.group(0) + insert_effect)

    # 4) Header action: change transfer button to open transfer tab
    # Replace onAction mapping for 'transfer'
    fs = fs.replace("if (k === \"transfer\") return openTransferLot();", "if (k === \"transfer\") return openTransferTab(selectedLotId);")
    fs = fs.replace("{ key: \"transfer\", label: \"Transferir lote\", variant: \"ghost\" },",
                    "{ key: \"transfer\", label: \"Transferir lote\", variant: tab === \"transfer\" ? \"primary\" : \"ghost\" },")

    # Also change primary button in lots view to open transfer tab if exists
    fs = fs.replace("onClick={openTransferLot}", "onClick={() => openTransferTab(selectedLotId)}")

    # 5) Add render block for tab === 'transfer'
    marker = "{tab === \"animal\" ? ("
    idx2 = fs.find(marker)
    if idx2 == -1:
        raise SystemExit('ERRO: não achei bloco tab === "animal" para inserir transferência')

    transfer_block = r'''

        {tab === "transfer" ? (
          <div className="card">
            <div className="card-header-row">
              <div>
                <div style={{ fontWeight: 900 }}>Transferir lote</div>
                <div className="card-subtitle">Selecione os animais e confirme a movimentação (uma tela por vez).</div>
              </div>
              <div className="faz-rowActions" style={{ justifyContent: "flex-end" }}>
                <button className="faz-btn" type="button" onClick={() => setTab('lots')}>Voltar</button>
              </div>
            </div>

            {xferMsg ? (
              <div className="texto-suave" style={{ marginTop: 10 }}><b>Aviso:</b> {xferMsg}</div>
            ) : null}

            <div className="faz-rowActions" style={{ marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 180 }}>
                <div className="form-label">Origem (lote)</div>
                <select className="faz-input" value={xferFromLot ?? ''} onChange={(e) => setXferFromLot(Number(e.target.value))}>
                  {(lots || []).map(l => (
                    <option key={l.id} value={l.id}>{l.name || `Lote ${l.id}`}</option>
                  ))}
                </select>
              </div>

              <div style={{ minWidth: 180 }}>
                <div className="form-label">Destino (lote)</div>
                <select className="faz-input" value={xferToLot ?? ''} onChange={(e) => setXferToLot(Number(e.target.value))}>
                  {(lots || []).filter(l => Number(l.id) !== Number(xferFromLot)).map(l => (
                    <option key={l.id} value={l.id}>{l.name || `Lote ${l.id}`}</option>
                  ))}
                </select>
              </div>

              <div style={{ minWidth: 220, flex: 1 }}>
                <div className="form-label">Buscar brinco</div>
                <input className="faz-input" value={xferQ} onChange={(e) => setXferQ(e.target.value)} placeholder="Ex.: 7820" />
              </div>

              <div style={{ minWidth: 220 }}>
                <div className="form-label">Motivo</div>
                <select className="faz-input" value={xferReason} onChange={(e) => setXferReason(e.target.value)}>
                  <option value="manejo">Manejo</option>
                  <option value="aparta">Apartação</option>
                  <option value="venda">Venda</option>
                  <option value="reproducao">Reprodução</option>
                  <option value="sanidade">Sanidade</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div style={{ minWidth: 260, flex: 1 }}>
                <div className="form-label">Observação (opcional)</div>
                <input className="faz-input" value={xferNote} onChange={(e) => setXferNote(e.target.value)} placeholder="Ex.: apartação para IATF" />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="texto-suave">Selecione os animais:</div>
              <div className="faz-animals" style={{ marginTop: 8 }}>
                {(xferAnimals || [])
                  .filter(a => {
                    const qq = normalizeEarTag(xferQ);
                    if (!qq) return True;
                    return normalizeEarTag(a.ear_tag).includes(qq);
                  })
                  .map(a => (
                    <label key={a.ear_tag} className="faz-animal-row" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!xferPick[a.ear_tag]}
                        onChange={(e) => setXferPick(prev => ({ ...prev, [a.ear_tag]: e.target.checked }))}
                        style={{ marginRight: 10 }}
                      />
                      <div className="ear">{a.ear_tag}</div>
                      <div className="meta">{a.category || '—'} • {a.sex || '—'} • {fmtKg(a.last_weight_kg)} </div>
                    </label>
                  ))}
              </div>

              <div className="faz-actions-row" style={{ marginTop: 12 }}>
                <button className="faz-btn" type="button" onClick={() => {
                  const all = {};
                  (xferAnimals || []).forEach(a => { all[a.ear_tag] = true; });
                  setXferPick(all);
                }}>Selecionar todos</button>

                <button className="faz-btn" type="button" onClick={() => setXferPick({})}>Limpar</button>

                <button className="faz-btn primary" type="button" disabled={xferBusy} onClick={confirmTransfer}>
                  {xferBusy ? 'Transferindo…' : 'Confirmar transferência'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
'''

    # Note: python True should be true in JS. We'll fix afterwards.
    fs = fs[:idx2] + transfer_block + fs[idx2:]
    fs = fs.replace('return True;', 'return true;')

    front.write_text(fs, encoding='utf-8')

print('OK: REBANHO_TRANSFER_LOTE_V1 aplicado (front+back).')
PY

echo "OK: apply_rebanho_transfer_lote_v1 concluído."

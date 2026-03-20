import React from 'react'

export class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: any }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }

  componentDidCatch(error: any) {
    console.error('[RootErrorBoundary]', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children as any
    const msg = String(this.state.error?.message || this.state.error || 'Erro desconhecido')
    return (
      <div style={{ padding: 18 }}>
        <div style={{ border: '1px solid rgba(239,68,68,.35)', background: 'rgba(239,68,68,.06)', borderRadius: 16, padding: 14 }}>
          <div style={{ fontWeight: 950, marginBottom: 6 }}>Erro na interface</div>
          <div style={{ color: 'rgba(17,24,39,.70)', whiteSpace: 'pre-wrap' }}>{msg}</div>
          <div style={{ marginTop: 10, color: 'rgba(17,24,39,.55)', fontSize: 12 }}>
            Abra o Console do navegador (F12) para ver a stack completa.
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => window.location.reload()}
              style={{ border: '1px solid rgba(0,0,0,.10)', background: 'rgba(255,255,255,.9)', borderRadius: 12, padding: '10px 12px', fontWeight: 900, cursor: 'pointer' }}>
              Recarregar
            </button>
          </div>
        </div>
      </div>
    )
  }
}

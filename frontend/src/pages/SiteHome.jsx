import React from "react";
import "../styles/site_home.css";

const highlights = [
  { title: "Menos retrabalho no curral", text: "Registro por brinco com fluxo direto para o vaqueiro, sem planilha paralela." },
  { title: "Decisão com número real", text: "Peso, custo e lote em uma leitura única para agir no mesmo dia." },
  { title: "Time alinhado", text: "Campo e escritório usam a mesma tela e a mesma linguagem operacional." },
];

const steps = [
  "Mapeamos sua rotina atual da fazenda.",
  "Configuramos os fluxos principais do sistema.",
  "Subimos em produção com treinamento prático.",
];

const reasons = [
  {
    title: "Compra com retorno rápido",
    text: "Você reduz erros de anotação, perde menos tempo no manejo e ganha previsibilidade no fechamento mensal.",
  },
  {
    title: "Operação simples para qualquer equipe",
    text: "Adoção facilitada para vaqueiro, gerente e dono: menos tela e mais ação no dia a dia.",
  },
  {
    title: "Base única de confiança",
    text: "Tudo fica no mesmo sistema: pesos, vacinas, reprodução e pendências do rebanho.",
  },
];

const realLifeGallery = [
  {
    title: "Manejo de pasto e lotação",
    subtitle: "Rotina de campo com foco em eficiência de área.",
    src: "https://i.ytimg.com/vi/hmeTuQHUfw4/hqdefault.jpg",
    credit: "Embrapa - vídeo técnico",
    source: "https://www.youtube.com/watch?v=hmeTuQHUfw4",
  },
  {
    title: "Sistema ILPF na prática",
    subtitle: "Integração para produtividade e sustentabilidade.",
    src: "https://i.ytimg.com/vi/c0WnnaoojDI/hqdefault.jpg",
    credit: "Embrapa - vídeo técnico",
    source: "https://www.youtube.com/watch?v=c0WnnaoojDI",
  },
  {
    title: "Gado de corte em manejo diário",
    subtitle: "Operação de rotina com tomada de decisão no campo.",
    src: "https://i.ytimg.com/vi/fsXDmjHz8PE/hqdefault.jpg",
    credit: "Embrapa - vídeo técnico",
    source: "https://www.youtube.com/watch?v=fsXDmjHz8PE",
  },
  {
    title: "Pastagens e desempenho animal",
    subtitle: "Planejamento técnico para ganho de peso.",
    src: "https://i.ytimg.com/vi/ml609OIv2yY/hqdefault.jpg",
    credit: "Embrapa - vídeo técnico",
    source: "https://www.youtube.com/watch?v=ml609OIv2yY",
  },
  {
    title: "Produção bovina em escala",
    subtitle: "Estratégias para estabilidade da produção.",
    src: "https://i.ytimg.com/vi/r-lED4DOjfs/hqdefault.jpg",
    credit: "Embrapa - vídeo técnico",
    source: "https://www.youtube.com/watch?v=r-lED4DOjfs",
  },
  {
    title: "Boas práticas de manejo",
    subtitle: "Padronização da rotina para reduzir perdas.",
    src: "https://i.ytimg.com/vi/5W8m2MWCi8M/hqdefault.jpg",
    credit: "Embrapa - vídeo técnico",
    source: "https://www.youtube.com/watch?v=5W8m2MWCi8M",
  },
  {
    title: "Tecnologia aplicada ao curral",
    subtitle: "Informação de campo para gestão rápida.",
    src: "https://i.ytimg.com/vi/AqUBhgjtVrA/hqdefault.jpg",
    credit: "Embrapa - vídeo técnico",
    source: "https://www.youtube.com/watch?v=AqUBhgjtVrA",
  },
  {
    title: "Operação real da pecuária brasileira",
    subtitle: "Cenários reais para análise da produção.",
    src: "https://i.ytimg.com/vi/DRXX4VGyMdk/hqdefault.jpg",
    credit: "Embrapa - vídeo técnico",
    source: "https://www.youtube.com/watch?v=DRXX4VGyMdk",
  },
];

const trustedSources = [
  {
    title: "Embrapa Gado de Corte",
    subtitle: "Tecnologias, orientações e materiais técnicos para pecuária de corte.",
    credit: "Fonte oficial Embrapa",
    source: "https://www.embrapa.br/gado-de-corte",
  },
  {
    title: "IBGE - Produção Agropecuária (Bovinos)",
    subtitle: "Indicadores e dados estatísticos oficiais sobre rebanho bovino no Brasil.",
    credit: "Fonte oficial IBGE",
    source: "https://www.ibge.gov.br/explica/producao-agropecuaria/bovinos/br",
  },
  {
    title: "MAPA - Notícias e políticas setoriais",
    subtitle: "Publicações oficiais do Ministério da Agricultura sobre pecuária e produção.",
    credit: "Fonte oficial Gov.br/MAPA",
    source: "https://www.gov.br/agricultura/pt-br/assuntos/noticias",
  },
];

const articles = [
  {
    title: "Embrapa Gado de Corte",
    text: "Cursos, tecnologias e orientacoes para produtividade, sanidade, nutricao e reproducao.",
    tag: "Sistema tecnico",
    href: "https://www.embrapa.br/gado-de-corte",
  },
  {
    title: "ILPF na Pecuaria Sudeste",
    text: "Integracao lavoura-pecuaria-floresta para recuperar pastos, reduzir risco e aumentar eficiencia.",
    tag: "Sistema integrado",
    href: "https://www.embrapa.br/pecuaria-sudeste/ilpf",
  },
  {
    title: "Manejo intensivo de pastagens",
    text: "Guia tecnico para divisao de area, lotacao, adubacao, calagem e planejamento economico.",
    tag: "Artigo tecnico",
    href: "https://www.embrapa.br/busca-de-publicacoes/-/publicacao/44537/manejo-intensivo-de-pastagens-para-gado-de-corte",
  },
  {
    title: "Rede ILPF",
    text: "Casos, dados e praticas para sistemas produtivos com pecuaria e sustentabilidade no Brasil.",
    tag: "Rede de conhecimento",
    href: "https://redeilpf.org.br/",
  },
  {
    title: "ILPF e rentabilidade",
    text: "Materia oficial sobre ganhos economicos de sistemas integrados versus modelos exclusivos.",
    tag: "Analise de resultado",
    href: "https://www.gov.br/agricultura/pt-br/assuntos/noticias/2022/integracao-lavoura-pecuaria-floresta-e-mais-lucrativa-que-culturas-exclusivas",
  },
  {
    title: "Integracao lavoura-pecuaria",
    text: "Conteudo Embrapa com foco em renda, rotacao de uso da terra e estabilidade do sistema.",
    tag: "Planejamento",
    href: "https://www.infoteca.cnptia.embrapa.br/handle/doc/1015236",
  },
];

export default function SiteHome({ onOpenSystem }) {
  return (
    <div className="cras-ui-v2 site-home">
      <div className="site-bg site-bg-a" />
      <div className="site-bg site-bg-b" />

      <header className="site-header">
        <div className="site-header-inner">
          <div className="site-brand">
            <div className="app-title-tag">PLATAFORMA DE GESTÃO DA PECUÁRIA</div>
            <h1 className="app-title">
              <span className="app-title-prefix">Sistema</span>{" "}
              <span className="app-title-highlight">FAZENDA IDEAL</span>
            </h1>
          </div>
          <button type="button" className="faz-btn" onClick={onOpenSystem}>
            Entrar no sistema
          </button>
        </div>
      </header>

      <main className="site-main">
        <section className="site-hero faz-panel">
          <div className="site-hero-copy">
            <p className="site-kicker">Plataforma feita para pecuária de corte</p>
            <h2>Mais lucro e menos desperdício na rotina da fazenda.</h2>
            <p className="site-subtitle faz-muted">
              O Sistema Fazenda Ideal organiza a rotina do curral, melhora a leitura do rebanho e transforma dados
              dispersos em decisão diária. Mais controle para quem opera e para quem faz gestão.
            </p>
            <div className="site-actions">
              <button type="button" className="faz-btn primary" onClick={onOpenSystem}>
                Ver sistema agora
              </button>
              <a href="#como-funciona" className="site-link">
                Como funciona
              </a>
            </div>
          </div>
          <div className="site-hero-visual">
            <img
              className="site-photo site-photo-main"
              src="https://images.pexels.com/photos/422218/pexels-photo-422218.jpeg?auto=compress&cs=tinysrgb&w=1200"
              alt="Gado em area de manejo"
              loading="lazy"
            />
            <img
              className="site-photo site-photo-sub"
              src="https://images.pexels.com/photos/974314/pexels-photo-974314.jpeg?auto=compress&cs=tinysrgb&w=1200"
              alt="Trabalhador rural em atividade de campo na fazenda"
              loading="lazy"
            />
          </div>
        </section>

        <section className="site-grid">
          {highlights.map((item) => (
            <article key={item.title} className="site-card faz-card">
              <span className="faz-pill">Modulo</span>
              <h3>{item.title}</h3>
              <p className="faz-muted">{item.text}</p>
            </article>
          ))}
        </section>

        <section className="site-gallery-block faz-card">
          <div className="site-why-head">
            <p className="site-kicker">Galeria de campo real</p>
            <h3>Mais imagens reais da pecuária no Brasil.</h3>
          </div>
          <div className="site-gallery-grid site-gallery-grid--photos">
            {realLifeGallery.map((item) => (
              <article key={item.title} className="site-photo-card">
                <img src={item.src} alt={item.title} loading="lazy" />
                <div className="site-photo-card-body">
                  <h4>{item.title}</h4>
                  <p>{item.subtitle}</p>
                  <a href={item.source} target="_blank" rel="noreferrer">
                    Fonte: {item.credit}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="site-gallery-block faz-card">
          <div className="site-why-head">
            <p className="site-kicker">Fontes técnicas confiáveis</p>
            <h3>Referências oficiais para decisões na pecuária brasileira.</h3>
          </div>
          <div className="site-gallery-grid">
            {trustedSources.map((item) => (
              <article key={item.title} className="site-photo-card site-photo-card--source">
                <div className="site-photo-card-body">
                  <span className="faz-pill">{item.credit}</span>
                  <h4>{item.title}</h4>
                  <p>{item.subtitle}</p>
                  <a href={item.source} target="_blank" rel="noreferrer">
                    Abrir fonte oficial
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="site-articles faz-card">
          <div className="site-why-head">
            <p className="site-kicker">Artigos e sistemas para pecuaria</p>
            <h3>Biblioteca tecnica para decisao no campo.</h3>
          </div>
          <div className="site-articles-grid">
            {articles.map((item) => (
              <article key={item.title} className="site-article-card">
                <span className="faz-pill">{item.tag}</span>
                <h4>{item.title}</h4>
                <p>{item.text}</p>
                <a href={item.href} target="_blank" rel="noreferrer" className="site-link">
                  Ler artigo
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="site-why faz-card">
          <div className="site-why-head">
            <p className="site-kicker">Por que comprar agora</p>
            <h3>Não é só sistema: é ganho operacional no campo.</h3>
          </div>
          <div className="site-why-grid">
            {reasons.map((item) => (
              <article key={item.title} className="site-why-card">
                <h4>{item.title}</h4>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="site-process faz-card">
          <div>
            <p className="site-kicker">Implantação direta</p>
            <h3>Começamos com o que já existe na sua operação.</h3>
          </div>
          <ol>
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

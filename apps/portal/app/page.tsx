const projects = [
  {
    index: '01',
    name: 'VELOTRACE',
    summary: '把骑行记录变成看得见的生涯、轨迹与目标。',
    detail: 'CYCLING · DATA · 2026',
    href: 'https://velotrace.demo.vychod.site',
    status: 'LIVE',
  },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Vychod Demos 首页">VYCHOD <span>/ DEMOS</span></a>
        <p className="availability"><i aria-hidden="true" />SHANGHAI · ONLINE</p>
      </header>

      <section className="hero" id="top" aria-labelledby="page-title">
        <div className="road-grid" aria-hidden="true" />
        <p className="kicker">INDEPENDENT DIGITAL WORKS</p>
        <h1 id="page-title"><span>Useful things,</span><br />made with intent.</h1>
        <div className="hero-foot">
          <p>公开产品、个人工具与持续生长的实验。</p>
          <a href="#projects">查看项目 <span>↓</span></a>
        </div>
      </section>

      <section className="project-section" id="projects" aria-labelledby="projects-title">
        <div className="section-heading">
          <p>SELECTED WORK / 公开项目</p>
          <h2 id="projects-title">Projects</h2>
          <span>{String(projects.length).padStart(2, '0')} / ACTIVE</span>
        </div>
        <nav className="project-list" aria-label="项目列表">
          {projects.map((project) => (
            <a className="project" href={project.href} key={project.name}>
              <span className="project-index">{project.index}</span>
              <div className="project-copy">
                <div className="project-title-line">
                  <h3>{project.name}</h3>
                  <span className="project-status">{project.status}</span>
                </div>
                <p>{project.summary}</p>
              </div>
              <span className="project-detail">{project.detail}</span>
              <span className="project-arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </nav>
      </section>

      <footer>
        <p>ONE REPOSITORY. INDEPENDENT PRODUCTS.</p>
        <p>© {new Date().getFullYear()} VYCHOD</p>
      </footer>
    </main>
  );
}

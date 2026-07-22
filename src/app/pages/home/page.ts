export function mountHomePage(root: HTMLDivElement) {
  root.innerHTML = `
    <main class="home-page">
      <header class="site-header">
        <a class="brand" href="#/home" aria-label="Studio home">STUDIO<span>/01</span></a>

        <nav class="site-nav" aria-label="주요 메뉴">
          <a class="is-current" href="#/home">Home</a>
          <a href="#/visualizer">Explore</a>
          <a href="#/ord-helper">ORD Helper</a>
        </nav>

        <button class="menu-button" type="button" aria-label="메뉴">☰</button>
      </header>

      <section class="home-hero">
        <div class="hero-copy">
          <p class="home-eyebrow">DIGITAL PLAYGROUND · 2026</p>
          <h1>
            <span>작은 실험들이</span>
            <span><em>새로운 장면이</em></span>
            <span>됩니다.</span>
          </h1>
          <p class="hero-description">
            소리, 움직임, 놀이를 모아두는 개인 실험 공간입니다.<br />
          </p>
          <a class="hero-link" href="#/visualizer">Explore the studio <span>↗</span></a>
        </div>

        <div class="hero-graphic" aria-hidden="true">
          <div class="graphic-orbit orbit-one"></div>
          <div class="graphic-orbit orbit-two"></div>
          <div class="graphic-orbit orbit-three"></div>
          <div class="graphic-core"></div>
          <span class="graphic-label label-top">01</span>
          <span class="graphic-label label-bottom">MAKE / PLAY / REPEAT</span>
        </div>
      </section>

      <section class="module-section" aria-labelledby="module-title">
        <div class="section-heading">
          <p class="home-eyebrow">PROJECTS</p>
          <h2 id="module-title">무엇을 해볼까요?</h2>
          <span>01 — 02</span>
        </div>

        <div class="module-grid">
          <a class="module-card module-card-primary" href="#/visualizer">
            <div class="module-card-top">
              <span class="module-number">01</span>
              <span class="module-arrow">↗</span>
            </div>
            <div>
              <p class="module-label">INTERACTIVE AUDIO</p>
              <h3>Sound Canvas</h3>
              <p>소리를 빛과 움직임으로 바꾸는 시각화 실험</p>
            </div>
            <div class="card-lines" aria-hidden="true"></div>
          </a>

          <button class="module-card module-card-secondary" type="button" disabled>
            <div class="module-card-top">
              <span class="module-number">02</span>
              <span class="module-status">COMING SOON</span>
            </div>
            <div>
            <p class="module-label">ORD ADVISOR</p>
              <h3>ORD Helper</h3>
              <p>TMO.GG와 연동해 원랜디 조합을 추천하는 보조 도구</p>
            </div>
            <div class="card-grid" aria-hidden="true"></div>
          </button>
        </div>
      </section>

      <footer class="home-footer">
        <span>STUDIO/01</span>
        <span>BUILDING SMALL THINGS WITH CARE</span>
        <span>© 2026</span>
      </footer>
    </main>
  `;
}

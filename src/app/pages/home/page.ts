export function mountHomePage(root: HTMLDivElement) {
  root.innerHTML = `
    <main class="home-page">
      <header class="site-header">
        <a class="brand" href="#/home" aria-label="Studio home">STUDIO<span>/01</span></a>

        <nav class="site-nav" aria-label="주요 메뉴">
          <a class="is-current" href="#/home">Home</a>
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
            작은 실험과 도구를 모아두는 개인 작업 공간입니다.<br />
          </p>
          <span class="hero-link" aria-label="더 많은 실험 준비 중">
            More experiments soon <span>↗</span>
          </span>
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

      <footer class="home-footer">
        <span>STUDIO/01</span>
        <span>BUILDING SMALL THINGS WITH CARE</span>
        <span>© 2026</span>
      </footer>
    </main>
  `;
}

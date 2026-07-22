import { TMO_DATAS_ENDPOINT } from "./services/tmo-data-source";

export type OrdHelperElements = {
  connectionState: HTMLSpanElement;
  connectionDetail: HTMLParagraphElement;
  connectionDot: HTMLSpanElement;
  launchButton: HTMLButtonElement;
  demoButton: HTMLButtonElement;
  sourceLabel: HTMLSpanElement;
  observedUnitCount: HTMLSpanElement;
  bannedUnitCount: HTMLSpanElement;
  receivedAt: HTMLSpanElement;
  observedUnits: HTMLDivElement;
  recommendations: HTMLDivElement;
};

export function mountOrdHelperPage(root: HTMLDivElement): OrdHelperElements {
  root.innerHTML = `
    <main class="ord-helper-page">
      <header class="ord-helper-header">
        <a class="ord-helper-brand" href="#/home">STUDIO<span>/01</span></a>
        <nav class="ord-helper-nav" aria-label="ORD Helper 메뉴">
          <a href="#/home">Home</a>
          <a href="#/visualizer">Explore</a>
          <a class="is-current" href="#/ord-helper">ORD Helper</a>
        </nav>
      </header>

      <section class="ord-helper-shell">
        <div class="ord-helper-intro">
          <p class="ord-helper-kicker">ORD ADVISOR · LIVE BUILD ASSISTANT</p>
          <h1>지금 올릴 것과<br /><em>다음에 노릴 것</em>을 봅니다.</h1>
          <p>
            TMO.GG 데스크톱이 전달하는 원랜디 게임 상태를 읽어,
            조합 가능성뿐 아니라 현재 상황에 맞는 다음 선택을 계산하는 실험입니다.
          </p>
        </div>

        <section class="ord-helper-connection" aria-label="TMO.GG 연결 상태">
          <div class="connection-copy">
            <div class="connection-title-row">
              <span class="connection-dot" data-connection-dot></span>
              <span class="connection-state" data-connection-state>연결 확인 중</span>
            </div>
            <p data-connection-detail>로컬 TMO.GG 데스크톱을 찾고 있습니다.</p>
          </div>
          <div class="connection-actions">
            <button class="ord-helper-button ord-helper-button-primary" type="button" data-launch-tmogg>
              데스크톱 열기 ↗
            </button>
            <button class="ord-helper-button" type="button" data-use-demo>
              데모 데이터 보기
            </button>
          </div>
        </section>

        <div class="advisor-grid">
          <section class="advisor-card recommendation-card">
            <div class="advisor-card-heading">
              <div>
                <p class="ord-helper-kicker">NEXT MOVE</p>
                <h2>추천 우선순위</h2>
              </div>
              <span class="advisor-source" data-source-label>LIVE</span>
            </div>
            <div class="recommendation-list" data-recommendations>
              <p class="empty-state">현재 상태를 기다리는 중입니다.</p>
            </div>
          </section>

          <section class="advisor-card live-state-card">
            <div class="advisor-card-heading">
              <div>
                <p class="ord-helper-kicker">GAME STATE</p>
                <h2>실시간 감지</h2>
              </div>
              <span class="live-pulse">●</span>
            </div>
            <div class="state-metrics">
              <div><strong data-observed-unit-count>0</strong><span>감지된 유닛</span></div>
              <div><strong data-banned-unit-count>0</strong><span>밴 목록</span></div>
              <div><strong data-received-at>—</strong><span>마지막 수신</span></div>
            </div>
            <div class="observed-units" data-observed-units>
              <p class="empty-state">TMO.GG 연결 후 유닛 이름과 보유 수량이 표시됩니다.</p>
            </div>
          </section>
        </div>

        <section class="ord-helper-note">
          <div>
            <p class="ord-helper-kicker">DATA CONTRACT</p>
          <h2>실제 조합 데이터 위에서 추천합니다.</h2>
          </div>
          <p>
            TMO.GG 빌드 헬퍼의 조합 데이터로 유닛 이름·재료·역할을 표시하고,
            최상위 목표에서 역산한 조합 경로, 물딜·마딜 계열 시너지,
            방깍·아머브레이크·마방깍·라인/단일/끝딜·보스/광폭 역할,
            이감과 연계한 스턴 1 이상 조건, 마나 스킬/체력 스킬에 맞는
            마나젠·체젠 조합, 전용 강화 아이템 보유 여부,
            흔함을 대체하는 위습 사용량까지 계산합니다.
          </p>
          <code>${TMO_DATAS_ENDPOINT}</code>
        </section>
      </section>
    </main>
  `;

  return {
    connectionState: getElement(root, "[data-connection-state]"),
    connectionDetail: getElement(root, "[data-connection-detail]"),
    connectionDot: getElement(root, "[data-connection-dot]"),
    launchButton: getElement(root, "[data-launch-tmogg]"),
    demoButton: getElement(root, "[data-use-demo]"),
    sourceLabel: getElement(root, "[data-source-label]"),
    observedUnitCount: getElement(root, "[data-observed-unit-count]"),
    bannedUnitCount: getElement(root, "[data-banned-unit-count]"),
    receivedAt: getElement(root, "[data-received-at]"),
    observedUnits: getElement(root, "[data-observed-units]"),
    recommendations: getElement(root, "[data-recommendations]"),
  };
}

function getElement<T extends Element>(
  root: HTMLDivElement,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Required element was not found: ${selector}`);
  }

  return element;
}

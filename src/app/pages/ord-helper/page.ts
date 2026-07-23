import { TMO_DATAS_ENDPOINT } from "./services/tmo-data-source";

export type OrdHelperElements = {
  connectionState: HTMLSpanElement;
  connectionDetail: HTMLParagraphElement;
  connectionDot: HTMLSpanElement;
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
            <p data-connection-detail>로컬 /datas 엔드포인트를 확인하고 있습니다.</p>
          </div>
          <div class="connection-actions">
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
              <div><strong data-observed-unit-count>0</strong><span>보유 유닛 종류</span></div>
              <div><strong data-banned-unit-count>0</strong><span>밴 목록</span></div>
              <div><strong data-received-at>—</strong><span>마지막 수신</span></div>
            </div>
            <div class="observed-units" data-observed-units>
              <p class="empty-state">/datas 연결 후 보유 유닛이 작게 표시됩니다.</p>
            </div>
          </section>
        </div>

        <section class="ord-helper-note">
          <div>
            <p class="ord-helper-kicker">DATA CONTRACT</p>
          <h2>등급별 조합 경로를 봅니다.</h2>
          </div>
          <p>
            /datas에서 받은 유닛 ID를 로컬 조합 데이터와 즉시 매칭해,
            특별함·희귀함·전설·히든·최상위 유닛으로 이어지는 이름과 등급만
            간결하게 표시합니다.
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

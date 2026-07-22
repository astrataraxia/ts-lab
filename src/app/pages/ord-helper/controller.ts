import {
  DEMO_CATALOG,
  DEMO_SNAPSHOT,
  loadOrdAliases,
  loadOrdCatalog,
} from "./data/catalog";
import {
  createRecommendationModel,
  type RecommendationModel,
  rankRecommendations,
} from "./logic/recommendations";
import { mountOrdHelperPage } from "./page";
import { createTmoDataSource } from "./services/tmo-data-source";
import type { Recommendation, TmoSnapshot } from "./types";

export function mountOrdHelper(root: HTMLDivElement) {
  const elements = mountOrdHelperPage(root);
  const dataSource = createTmoDataSource();

  let snapshot: TmoSnapshot = { units: {}, banned: [], receivedAt: 0 };
  let catalog: readonly import("./types").UnitDefinition[] = [];
  let catalogModel: RecommendationModel | null = null;
  let demoModel: RecommendationModel | null = null;
  let aliases: Record<string, string> = {};
  let isDemo = false;

  const render = () => {
    const activeModel = isDemo ? demoModel : catalogModel;
    const activeCatalog =
      activeModel?.catalog ?? (isDemo ? DEMO_CATALOG : catalog);
    const hasKnownCatalogData = Object.keys(snapshot.units).some((id) =>
      activeCatalog.some(
        (unit) => unit.id === id || Object.hasOwn(unit.recipe, id),
      ),
    );
    const recommendations =
      activeModel && (isDemo || hasKnownCatalogData)
        ? rankRecommendations(activeModel, snapshot)
        : [];
    const observedUnitIds = Object.keys(snapshot.units).sort();

    elements.sourceLabel.textContent = isDemo ? "DEMO" : "LIVE";
    elements.observedUnitCount.textContent = String(observedUnitIds.length);
    elements.bannedUnitCount.textContent = String(snapshot.banned.length);
    elements.receivedAt.textContent = snapshot.receivedAt
      ? formatTime(snapshot.receivedAt)
      : "—";
    elements.observedUnits.innerHTML = renderObservedUnits(
      observedUnitIds,
      snapshot,
      activeCatalog,
    );
    elements.recommendations.innerHTML = renderRecommendations(
      recommendations,
      snapshot,
      snapshot.receivedAt > 0,
      activeCatalog,
    );
  };

  const stopPolling = dataSource.start({
    onSnapshot: (nextSnapshot) => {
      snapshot = normalizeSnapshot(nextSnapshot, aliases, catalog);
      isDemo = false;
      setConnectionState(elements, true, "TMO.GG 데스크톱 연결됨");
      elements.connectionDetail.textContent =
        "게임 상태를 2초 간격으로 받고 있습니다.";
      render();
    },
    onError: (message) => {
      if (!isDemo) {
        setConnectionState(elements, false, "TMO.GG 데스크톱 미연동");
        elements.connectionDetail.textContent = `${message} 데스크톱을 실행한 뒤 다시 확인합니다.`;
      }
    },
  });

  void Promise.all([loadOrdCatalog(), loadOrdAliases()])
    .then(([nextCatalog, nextAliases]) => {
      catalog = nextCatalog;
      catalogModel = createRecommendationModel(nextCatalog);
      aliases = nextAliases;
      snapshot = normalizeSnapshot(snapshot, aliases, catalog);
      elements.connectionDetail.textContent = isDemo
        ? "실제 연결 전에도 추천 화면과 데이터 흐름을 확인할 수 있습니다."
        : `원랜디 조합 데이터 ${catalog.length}개를 준비했습니다.`;
      render();
    })
    .catch((error: unknown) => {
      if (!isDemo) {
        elements.connectionDetail.textContent =
          error instanceof Error
            ? error.message
            : "원랜디 조합 데이터를 불러오지 못했습니다.";
      }
    });

  const onLaunchClick = () => {
    window.location.href = "tmogg://run";
  };

  const onDemoClick = () => {
    demoModel ??= createRecommendationModel(DEMO_CATALOG);
    snapshot = { ...DEMO_SNAPSHOT, receivedAt: Date.now() };
    isDemo = true;
    setConnectionState(elements, false, "데모 데이터 표시 중");
    elements.connectionDetail.textContent =
      "실제 연결 전에도 추천 화면과 데이터 흐름을 확인할 수 있습니다.";
    render();
  };

  elements.launchButton.addEventListener("click", onLaunchClick);
  elements.demoButton.addEventListener("click", onDemoClick);
  render();

  return () => {
    stopPolling();
    elements.launchButton.removeEventListener("click", onLaunchClick);
    elements.demoButton.removeEventListener("click", onDemoClick);
  };
}

function setConnectionState(
  elements: ReturnType<typeof mountOrdHelperPage>,
  connected: boolean,
  label: string,
) {
  elements.connectionState.textContent = label;
  elements.connectionDot.classList.toggle("is-connected", connected);
}

function renderObservedUnits(
  ids: string[],
  snapshot: TmoSnapshot,
  catalog: readonly import("./types").UnitDefinition[],
): string {
  if (ids.length === 0) {
    return '<p class="empty-state">TMO.GG 연결 후 유닛 이름과 보유 수량이 표시됩니다.</p>';
  }

  return ids
    .slice(0, 24)
    .map((id) => {
      const banned = snapshot.banned.includes(id);
      const name = getUnitName(id, catalog);
      return `<span class="observed-unit${banned ? " is-banned" : ""}"><strong>${escapeHtml(name)}</strong><code>${escapeHtml(id)}</code><span>×${snapshot.units[id]}</span></span>`;
    })
    .join("");
}

function renderRecommendations(
  recommendations: Recommendation[],
  snapshot: TmoSnapshot,
  hasSnapshot: boolean,
  catalog: readonly import("./types").UnitDefinition[],
): string {
  if (recommendations.length === 0) {
    return hasSnapshot
      ? '<p class="empty-state">연결은 되었지만 아직 시즌 2 추천 규칙이 없습니다.</p>'
      : '<p class="empty-state">현재 상태를 기다리는 중입니다.</p>';
  }

  return recommendations
    .map((recommendation, index) => {
      const statusLabel =
        recommendation.status === "ready"
          ? "지금 가능"
          : recommendation.status === "near"
            ? "거의 준비"
            : "계획 후보";
      const progress = Math.round(recommendation.progress * 100);
      const ingredients = recommendation.ingredients
        .map((item) => {
          const replacement =
            item.coveredByWisp > 0 ? `, 위습 ${item.coveredByWisp}개 대체` : "";
          const shortage =
            item.remaining > 0 ? `, ${item.remaining}개 부족` : "";
          return `${item.name} ${item.owned}/${item.required}${replacement}${shortage}`;
        })
        .join(" · ");
      const wisp =
        recommendation.wispUsed > 0
          ? `위습 ${recommendation.wispUsed}/${recommendation.wispOwned}개 사용`
          : "위습 사용 없음";
      const pathMissing = recommendation.missingPath
        .map((item) => `${item.name} ${item.count}개`)
        .join(" · ");
      const target = `목표 ${recommendation.target.name} ${Math.round(recommendation.target.progress * 100)}%`;
      const targetRoles = recommendation.target.roles.length
        ? `목표 역할: ${recommendation.target.roles.join(" · ")}`
        : "";
      const targetResource =
        recommendation.target.skillResource !== "없음"
          ? `스킬 자원: ${recommendation.target.skillResource}`
          : "";
      const enhancements = recommendation.target.enhancements
        .map((item) => {
          const owned = snapshot.units[item.id] ?? 0;
          const state =
            owned >= item.count
              ? "보유"
              : item.required
                ? "필수 미보유"
                : "강화 미보유";
          return `${item.name} ${owned}/${item.count} (${state})`;
        })
        .join(" · ");
      const resources = Object.entries(recommendation.resourceRequirements)
        .map(([id, required]) => {
          const owned = recommendation.unknownResources.includes(id)
            ? "?"
            : String(
                recommendation.missingResources.find((item) => item.id === id)
                  ?.owned ?? required,
              );
          return `${getUnitName(id, catalog)} ${owned}/${required}`;
        })
        .join(" · ");
      const detail =
        [
          target,
          targetRoles,
          targetResource,
          enhancements ? `강화 아이템: ${enhancements}` : "",
          pathMissing ? `경로 부족: ${pathMissing}` : "",
          ingredients,
          wisp,
          resources,
        ]
          .filter(Boolean)
          .join(" · ") ||
        recommendation.unit.note ||
        "추천 규칙에 의해 우선순위가 계산되었습니다.";

      return `
        <article class="recommendation-item">
          <div class="recommendation-rank">0${index + 1}</div>
          <div class="recommendation-body">
            <div class="recommendation-title-row">
              <h3>${escapeHtml(recommendation.unit.name)}</h3>
              <span class="recommendation-status is-${recommendation.status}">${statusLabel}</span>
            </div>
            <p>${escapeHtml(recommendation.unit.role)} · ${escapeHtml(recommendation.reason)}</p>
            <div class="recommendation-progress"><span style="width: ${progress}%"></span></div>
            <small>${escapeHtml(detail)}</small>
          </div>
        </article>
      `;
    })
    .join("");
}

function getUnitName(
  id: string,
  catalog: readonly import("./types").UnitDefinition[],
): string {
  return (
    catalog.find((unit) => unit.id.toLowerCase() === id.toLowerCase())?.name ??
    id
  );
}

function normalizeSnapshot(
  snapshot: TmoSnapshot,
  aliases: Record<string, string>,
  catalog: readonly import("./types").UnitDefinition[],
): TmoSnapshot {
  const units: Record<string, number> = {};

  for (const [id, count] of Object.entries(snapshot.units)) {
    const aliasedId = aliases[id] ?? aliases[id.toLowerCase()] ?? id;
    const catalogUnit = catalog.find(
      (unit) => unit.id.toLowerCase() === aliasedId.toLowerCase(),
    );
    const canonicalId = catalogUnit?.id ?? aliasedId;
    units[canonicalId] = (units[canonicalId] ?? 0) + count;
  }

  return {
    ...snapshot,
    units,
    banned: snapshot.banned.map((id) => {
      const aliasedId = aliases[id] ?? aliases[id.toLowerCase()] ?? id;
      return (
        catalog.find(
          (unit) => unit.id.toLowerCase() === aliasedId.toLowerCase(),
        )?.id ?? aliasedId
      );
    }),
  };
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

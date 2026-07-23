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
import type {
  Recommendation,
  RecommendationPathNode,
  TmoSnapshot,
  UnitDefinition,
} from "./types";

export function mountOrdHelper(root: HTMLDivElement) {
  const elements = mountOrdHelperPage(root);
  const dataSource = createTmoDataSource();

  let snapshot: TmoSnapshot = { units: {}, banned: [], receivedAt: 0 };
  let catalog: readonly UnitDefinition[] = [];
  let catalogLookup = new Map<string, UnitDefinition>();
  const demoLookup = createCatalogLookup(DEMO_CATALOG);
  let catalogModel: RecommendationModel | null = null;
  let demoModel: RecommendationModel | null = null;
  let aliases: Record<string, string> = {};
  let isDemo = false;

  const render = () => {
    const activeModel = isDemo ? demoModel : catalogModel;
    const activeLookup = isDemo ? demoLookup : catalogLookup;
    const hasKnownCatalogData = Object.keys(snapshot.units).some(
      (id) => activeLookup.has(id.toLowerCase()) || isDemo,
    );
    const recommendations =
      activeModel && (isDemo || hasKnownCatalogData)
        ? rankRecommendations(activeModel, snapshot)
        : [];
    const observedUnitIds = Object.keys(snapshot.units).sort();

    updateSnapshotMeta(elements, snapshot, isDemo, observedUnitIds.length);
    elements.observedUnits.innerHTML = renderObservedUnits(
      observedUnitIds,
      snapshot,
      activeLookup,
    );
    elements.recommendations.innerHTML = renderRecommendations(
      recommendations,
      snapshot.receivedAt > 0,
    );
  };

  const stopPolling = dataSource.start({
    onSnapshot: (nextSnapshot) => {
      const normalizedSnapshot = normalizeSnapshot(
        nextSnapshot,
        aliases,
        catalogLookup,
      );
      const shouldRender =
        snapshot.receivedAt === 0 ||
        !sameSnapshotData(snapshot, normalizedSnapshot) ||
        !catalogModel;
      snapshot = normalizedSnapshot;
      isDemo = false;
      setConnectionState(elements, true, "TMO.GG 데스크톱 연결됨");
      elements.connectionDetail.textContent =
        "게임 상태를 1초 간격으로 받고 있습니다.";
      if (shouldRender) {
        render();
      } else {
        updateSnapshotMeta(elements, snapshot, false, undefined);
      }
    },
    onError: (message) => {
      if (!isDemo) {
        setConnectionState(elements, false, "TMO.GG 데스크톱 미연동");
        elements.connectionDetail.textContent = `${message} 잠시 후 다시 확인합니다.`;
      }
    },
  });

  void Promise.all([loadOrdCatalog(), loadOrdAliases()])
    .then(([nextCatalog, nextAliases]) => {
      catalog = nextCatalog;
      catalogLookup = createCatalogLookup(nextCatalog);
      catalogModel = createRecommendationModel(nextCatalog);
      aliases = nextAliases;
      snapshot = normalizeSnapshot(snapshot, aliases, catalogLookup);
      elements.connectionDetail.textContent = isDemo
        ? "실제 연결 전에도 추천 화면과 데이터 흐름을 확인할 수 있습니다."
        : `원랜디 조합 데이터 ${catalog.length}개 · /datas 1초 간격`;
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

  const onDemoClick = () => {
    demoModel ??= createRecommendationModel(DEMO_CATALOG);
    snapshot = { ...DEMO_SNAPSHOT, receivedAt: Date.now() };
    isDemo = true;
    setConnectionState(elements, false, "데모 데이터 표시 중");
    elements.connectionDetail.textContent =
      "실제 연결 전에도 추천 화면과 데이터 흐름을 확인할 수 있습니다.";
    render();
  };

  elements.demoButton.addEventListener("click", onDemoClick);
  render();

  return () => {
    stopPolling();
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

function updateSnapshotMeta(
  elements: ReturnType<typeof mountOrdHelperPage>,
  snapshot: TmoSnapshot,
  isDemo: boolean,
  observedUnitCount = Object.keys(snapshot.units).length,
) {
  elements.sourceLabel.textContent = isDemo ? "DEMO" : "LIVE";
  elements.observedUnitCount.textContent = String(observedUnitCount);
  elements.bannedUnitCount.textContent = String(snapshot.banned.length);
  elements.receivedAt.textContent = snapshot.receivedAt
    ? formatTime(snapshot.receivedAt)
    : "—";
}

function sameSnapshotData(left: TmoSnapshot, right: TmoSnapshot): boolean {
  const leftUnitIds = Object.keys(left.units);
  const rightUnitIds = Object.keys(right.units);

  return (
    leftUnitIds.length === rightUnitIds.length &&
    leftUnitIds.every((id) => right.units[id] === left.units[id]) &&
    left.banned.length === right.banned.length &&
    left.banned.every((id, index) => right.banned[index] === id)
  );
}

function renderObservedUnits(
  ids: string[],
  snapshot: TmoSnapshot,
  catalogLookup: ReadonlyMap<string, UnitDefinition>,
): string {
  if (ids.length === 0) {
    return '<p class="empty-state">/datas 연결 후 보유 유닛이 작게 표시됩니다.</p>';
  }

  return ids
    .slice(0, 24)
    .map((id) => {
      const banned = snapshot.banned.includes(id);
      const name = getUnitName(id, catalogLookup);
      return `<span class="observed-unit${banned ? " is-banned" : ""}" title="${escapeHtml(id)}"><strong>${escapeHtml(name)}</strong><span>×${snapshot.units[id]}</span></span>`;
    })
    .join("");
}

function renderRecommendations(
  recommendations: Recommendation[],
  hasSnapshot: boolean,
): string {
  if (recommendations.length === 0) {
    return hasSnapshot
      ? '<p class="empty-state">연결은 되었지만 아직 시즌 2 추천 규칙이 없습니다.</p>'
      : '<p class="empty-state">현재 상태를 기다리는 중입니다.</p>';
  }

  const trees = groupRecommendations(recommendations);

  return trees
    .map((tree, treeIndex) => renderRecommendationTree(tree, treeIndex))
    .join("");
}

function getUnitName(
  id: string,
  catalogLookup: ReadonlyMap<string, UnitDefinition>,
): string {
  return catalogLookup.get(id.toLowerCase())?.name ?? id;
}

function normalizeSnapshot(
  snapshot: TmoSnapshot,
  aliases: Record<string, string>,
  catalogLookup: ReadonlyMap<string, UnitDefinition>,
): TmoSnapshot {
  const units: Record<string, number> = {};

  for (const [id, count] of Object.entries(snapshot.units)) {
    const aliasedId = aliases[id] ?? aliases[id.toLowerCase()] ?? id;
    const catalogUnit = catalogLookup.get(aliasedId.toLowerCase());
    const canonicalId = catalogUnit?.id ?? aliasedId;
    units[canonicalId] = (units[canonicalId] ?? 0) + count;
  }

  return {
    ...snapshot,
    units,
    banned: snapshot.banned.map((id) => {
      const aliasedId = aliases[id] ?? aliases[id.toLowerCase()] ?? id;
      return catalogLookup.get(aliasedId.toLowerCase())?.id ?? aliasedId;
    }),
  };
}

function createCatalogLookup(
  catalog: readonly UnitDefinition[],
): Map<string, UnitDefinition> {
  return new Map(catalog.map((unit) => [unit.id.toLowerCase(), unit]));
}

type RecommendationTree = {
  target: Recommendation["target"];
  branches: RecommendationPathNode[][];
};

function groupRecommendations(
  recommendations: Recommendation[],
): RecommendationTree[] {
  const trees = new Map<string, RecommendationTree>();

  for (const recommendation of recommendations) {
    const key = recommendation.target.id.toLowerCase();
    const existing = trees.get(key);

    if (existing) {
      if (
        !existing.branches.some((branch) =>
          samePath(branch, recommendation.path),
        )
      ) {
        existing.branches.push(recommendation.path);
      }
      continue;
    }

    trees.set(key, {
      target: recommendation.target,
      branches: [recommendation.path],
    });
  }

  return Array.from(trees.values());
}

function samePath(
  left: RecommendationPathNode[],
  right: RecommendationPathNode[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (node, index) => node.id.toLowerCase() === right[index]?.id.toLowerCase(),
    )
  );
}

function renderRecommendationTree(
  tree: RecommendationTree,
  treeIndex: number,
): string {
  const targetProgress = Math.round(tree.target.progress * 100);
  const statusLabel =
    targetProgress === 100 && tree.target.missingResources.length === 0
      ? "지금 가능"
      : targetProgress >= 55
        ? "거의 준비"
        : "계획 후보";

  return `
    <article class="recommendation-tree">
      <div class="recommendation-tree-heading">
        <span class="recommendation-rank">0${treeIndex + 1}</span>
        <div class="recommendation-tree-target">
          <span class="recommendation-tree-label">최종 유닛</span>
          <strong>${escapeHtml(tree.target.name)}</strong>
          <span class="recommendation-tier is-target">${escapeHtml(tree.target.group)}</span>
          <span class="recommendation-lane is-${tree.target.lane}">${escapeHtml(tree.target.lane)}</span>
        </div>
        <div class="recommendation-tree-readiness">
          <span>${statusLabel}</span>
          <strong>${targetProgress}%</strong>
        </div>
      </div>
      ${renderResourceRequirements(tree.target)}
      <div class="recommendation-tree-branches">
        ${tree.branches.map((branch) => renderRecommendationBranch(branch)).join("")}
      </div>
      <div class="recommendation-progress is-target-progress"><span style="width: ${targetProgress}%"></span></div>
    </article>
  `;
}

function renderResourceRequirements(target: Recommendation["target"]): string {
  const requirements = Object.entries(target.resourceRequirements);
  if (requirements.length === 0) {
    return "";
  }

  const missingById = new Map(
    target.missingResources.map((resource) => [resource.id, resource]),
  );
  const resourceNames: Record<string, string> = {
    GOLD: "금화",
    LUMBER: "목재",
    FOOD: "식량",
    POINT: "특성포인트",
  };
  const items = requirements.map(([id, required]) => {
    const missing = missingById.get(id);
    const shortage = missing
      ? ` · 부족 ${required - (missing.owned ?? 0)}`
      : " · 확보";

    return `<span class="${missing ? "is-missing" : ""}">${escapeHtml(resourceNames[id] ?? id)} ${required}${shortage}</span>`;
  });

  return `<div class="recommendation-tree-resources"><small>조합 자원</small>${items.join("")}</div>`;
}

function renderRecommendationBranch(path: RecommendationPathNode[]): string {
  const nodes = path.map((node, index) => {
    const isFinal = index === path.length - 1;
    return `
      <div class="recommendation-tree-node${isFinal ? " is-final" : ""}">
        <strong>${escapeHtml(node.name)}</strong>
        <span>${escapeHtml(node.group)}</span>
        ${isFinal ? `<em>${escapeHtml(node.lane)}</em>` : ""}
      </div>
    `;
  });

  return `<div class="recommendation-tree-branch">${nodes.join('<span class="recommendation-tree-arrow" aria-hidden="true">›</span>')}</div>`;
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

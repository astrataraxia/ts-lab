import type { TmoSnapshot, UnitDefinition } from "../types";

// 공식 조합 데이터는 배포 시 프로젝트에 포함한다.
// 런타임에는 외부 static.tmo.gg에 의존하지 않고 이 로컬 사본을 읽는다.
const ORD_ASSETS_URL = "/data/ord-helper/assets.json";
const ORD_COMMON_URL = "/data/ord-helper/common.json";
const RESOURCE_IDS = new Set(["GOLD", "LUMBER", "FOOD", "POINT"]);

type OrdAsset = {
  id: string;
  name: string;
  abilities?: Record<string, number | boolean | string>;
  desc?: string;
  stuffs?: Array<{ id: string; count: number }>;
  codes?: string[];
  selectWisp?: boolean;
};

type OrdBuildHelperGroup = {
  name: string;
  units: OrdAsset[];
  resourceCost?: Record<string, number>;
};

type OrdBuildHelperResponse = {
  groups?: OrdBuildHelperGroup[];
};

type OrdCommonResponse = {
  ORD?: Record<string, string>;
};

type OrdSourceData = {
  buildHelper: OrdBuildHelperResponse;
  common: OrdCommonResponse;
};

let ordSourcePromise: Promise<OrdSourceData> | undefined;

export const DEMO_CATALOG: readonly UnitDefinition[] = [
  {
    id: "demo-control",
    name: "초반 제어형",
    group: "DEMO",
    role: "이동속도 감소",
    recipe: { "demo-common-a": 2, "demo-common-b": 1 },
    resources: {},
    priority: 34,
    note: "초반 안정성을 우선하는 샘플 규칙",
  },
  {
    id: "demo-damage",
    name: "누적 화력형",
    group: "DEMO",
    role: "지속 딜링",
    recipe: { "demo-common-a": 1, "demo-common-c": 2 },
    resources: {},
    priority: 42,
    note: "재료가 모이면 화력 투자를 우선하는 샘플 규칙",
  },
  {
    id: "demo-support",
    name: "팀 보조형",
    group: "DEMO",
    role: "공격력 보조",
    recipe: { "demo-common-b": 2, "demo-common-c": 1 },
    resources: {},
    priority: 28,
    note: "팀 전체 효율을 고려하는 샘플 규칙",
  },
];

export const DEMO_SNAPSHOT: TmoSnapshot = {
  units: {
    "demo-common-a": 2,
    "demo-common-b": 1,
    "demo-common-c": 1,
  },
  banned: [],
  receivedAt: Date.now(),
};

export async function loadOrdCatalog(): Promise<readonly UnitDefinition[]> {
  const { buildHelper } = await loadOrdSourceData();

  return (buildHelper.groups ?? []).flatMap((sourceGroup) => {
    const group = normalizeGroupName(sourceGroup.name);

    return sourceGroup.units.map((unit) =>
      toUnitDefinition(unit, group, sourceGroup),
    );
  });
}

export async function loadOrdAliases(): Promise<Record<string, string>> {
  const { buildHelper, common } = await loadOrdSourceData();
  const units = (buildHelper.groups ?? []).flatMap((group) => group.units);
  const ids = new Set(units.map((unit) => unit.id));
  const codeOwners = new Map<string, string>();

  for (const unit of units) {
    for (const code of unit.codes ?? []) {
      if (codeOwners.has(code)) {
        continue;
      }

      codeOwners.set(
        code,
        ids.has(code) && (unit.id === code || unit.codes?.includes(code))
          ? code
          : unit.id,
      );
    }
  }

  return Object.fromEntries(
    Object.entries(common.ORD ?? {})
      .flatMap(([from, to]) => [
        [from, to],
        [from.toLowerCase(), to],
      ])
      .concat(
        Array.from(codeOwners, ([from, to]) => [
          [from, to],
          [from.toLowerCase(), to],
        ]).flat(),
      ),
  );
}

function loadOrdSourceData(): Promise<OrdSourceData> {
  ordSourcePromise ??= Promise.all([
    fetch(ORD_ASSETS_URL),
    fetch(ORD_COMMON_URL),
  ]).then(async ([buildHelperResponse, commonResponse]) => {
    if (!buildHelperResponse.ok || !commonResponse.ok) {
      throw new Error("원랜디 코드 호환 정보를 불러오지 못했습니다.");
    }

    return {
      buildHelper: (await buildHelperResponse.json()) as OrdBuildHelperResponse,
      common: (await commonResponse.json()) as OrdCommonResponse,
    };
  });

  return ordSourcePromise;
}

function toUnitDefinition(
  unit: OrdAsset,
  group: string,
  sourceGroup: OrdBuildHelperGroup | undefined,
): UnitDefinition {
  const recipe: Record<string, number> = {};
  const resources: Record<string, number> = {};

  for (const stuff of unit.stuffs ?? []) {
    if (RESOURCE_IDS.has(stuff.id)) {
      resources[stuff.id] = stuff.count;
    } else {
      recipe[stuff.id] = stuff.count;
    }
  }

  for (const [resourceId, resourceCount] of Object.entries(
    sourceGroup?.resourceCost ?? {},
  )) {
    resources[resourceId] = (resources[resourceId] ?? 0) + resourceCount;
  }

  const abilityNames = Object.keys(unit.abilities ?? {});
  const abilities = normalizeAbilities(unit.abilities);

  return {
    id: unit.id,
    name: unit.name,
    group,
    role: abilityNames.length > 0 ? abilityNames.join(" · ") : group,
    recipe,
    resources,
    abilities,
    priority: getPriority(abilities),
    note: unit.desc,
    ...(unit.selectWisp ? { selectWisp: true } : {}),
  };
}

function normalizeGroupName(group: string): string {
  return group.replaceAll("🚁", "").trim();
}

function normalizeAbilities(
  abilities: Record<string, number | boolean | string> | undefined,
): Record<string, number | boolean> {
  const normalized: Record<string, number | boolean> = {};

  for (const [name, value] of Object.entries(abilities ?? {})) {
    if (value === "true") {
      normalized[name] = true;
    } else if (value === "false") {
      normalized[name] = false;
    } else if (typeof value === "string") {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        normalized[name] = parsed;
      }
    } else {
      normalized[name] = value;
    }
  }

  return normalized;
}

function getPriority(abilities: Record<string, number | boolean> | undefined) {
  if (!abilities) {
    return 0;
  }

  const priorityByAbility: Record<string, number> = {
    "방어력 감소": 12,
    "발동방어력 감소": 14,
    "이동속도 감소": 10,
    "발동이동속도 감소": 11,
    스턴: 8,
    단일: 7,
  };

  return Object.keys(abilities).reduce(
    (priority, ability) => priority + (priorityByAbility[ability] ?? 0),
    0,
  );
}

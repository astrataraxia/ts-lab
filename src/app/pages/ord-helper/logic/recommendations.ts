import type {
  CombatRole,
  DamageLane,
  EnhancementRequirement,
  IngredientProgress,
  MissingMaterial,
  Recommendation,
  RecommendationTarget,
  SkillResource,
  TmoSnapshot,
  UnitDefinition,
} from "../types";

const WISP_ID = "810e";
const COMMON_GROUP = "흔함";
const MAX_PLAN_STEPS = 2_000;

// 카탈로그가 바뀔 때만 다시 계산하는 최상위 목표 점수표.
// 전설·히든은 목표 자체보다 상위 목표로 이어지는 중간 단계로 취급한다.
// 실제 체감 성능 기준: 불멸 > 영원≈초월 > 제한됨.
const TOP_TARGET_GROUP_WEIGHTS: Record<string, number> = {
  "불멸 [물딜]": 120,
  "불멸 [마딜]": 120,
  "신비함 [물딜]": 116,
  "신비함 [마딜]": 116,
  "영원 [물딜]": 108,
  "영원 [마딜]": 108,
  "초월 [물딜]": 105,
  "초월 [마딜]": 105,
  "제한됨 [물딜]": 92,
  "제한됨 [마딜]": 92,
  세라핌: 70,
  왜곡됨: 64,
};

const TOP_TARGET_COPY_POLICIES: Record<
  string,
  { maxCopies?: number; repeatPenalty?: number }
> = {
  세라핌: { maxCopies: 1 },
  왜곡됨: { repeatPenalty: 30 },
};

export type UnitIndex = {
  byId: ReadonlyMap<string, UnitDefinition>;
  byLowerId: ReadonlyMap<string, UnitDefinition>;
};

type RoleScoreMap = Partial<Record<CombatRole, number>>;

export type CombatProfile = {
  lane: DamageLane;
  skillResource: SkillResource;
  roles: readonly CombatRole[];
  strengths: Readonly<RoleScoreMap>;
  enhancements: readonly EnhancementRequirement[];
};

export type TopTargetProfile = {
  target: UnitDefinition;
  combat: CombatProfile;
  lane: DamageLane;
  weight: number;
  dependencyDemand: ReadonlyMap<string, number>;
  roleNeeds: Readonly<RoleScoreMap>;
};

export type RecommendationModel = {
  catalog: readonly UnitDefinition[];
  index: UnitIndex;
  candidates: readonly UnitDefinition[];
  combatProfiles: ReadonlyMap<string, CombatProfile>;
  topTargets: readonly TopTargetProfile[];
};

type BuildPlan = {
  progress: number;
  missingById: Map<string, number>;
  missingTotal: number;
  wispUsed: number;
  requiredResources: Record<string, number>;
  missingResources: Array<{
    id: string;
    required: number;
    owned: number | undefined;
  }>;
  unknownResources: string[];
};

type GoalAssessment = {
  target: UnitDefinition;
  combat: CombatProfile;
  lane: DamageLane;
  plan: BuildPlan;
  dependencyDemand: ReadonlyMap<string, number>;
  roleNeeds: Readonly<RoleScoreMap>;
  opportunity: number;
};

type GoalMatch = {
  assessment: GoalAssessment;
  demand: number;
  score: number;
};

type ControlState = {
  hasSlow: boolean;
  hasStun: boolean;
};

export function createRecommendationModel(
  catalog: readonly UnitDefinition[],
): RecommendationModel {
  const index = createUnitIndex(catalog);
  const combatProfiles = new Map(
    catalog.map((unit) => [
      normalizeId(unit.id),
      createCombatProfile(unit, index),
    ]),
  );
  const candidates = catalog.filter(
    (unit) => Object.keys(unit.recipe).length > 0,
  );
  const topTargets = candidates
    .map((target) => {
      const weight = getGoalWeight(target.group);
      const combat = getCombatProfile(combatProfiles, target, index);

      return weight > 0
        ? {
            target,
            combat,
            lane: combat.lane,
            weight,
            dependencyDemand: buildDependencyDemand(target.id, index),
            roleNeeds: createRoleNeeds(combat),
          }
        : null;
    })
    .filter((profile): profile is TopTargetProfile => profile !== null);

  return { catalog, index, candidates, combatProfiles, topTargets };
}

export function rankRecommendations(
  model: RecommendationModel,
  snapshot: TmoSnapshot,
): Recommendation[] {
  const banned = new Set(snapshot.banned.map(normalizeId));
  const { candidates, index } = model;
  const availableCandidates = candidates.filter(
    (unit) =>
      !banned.has(normalizeId(unit.id)) &&
      !isCopyBlocked(unit.group, snapshot.units, index),
  );
  const canPursueMystic = hasOwnedGroup(snapshot.units, index, "랜덤유닛");
  const goals = model.topTargets.filter(
    (profile) =>
      !banned.has(normalizeId(profile.target.id)) &&
      !isCopyBlocked(profile.target.group, snapshot.units, index) &&
      (canPursueMystic || !profile.target.group.startsWith("신비함")),
  );
  const assessments = goals.map((profile) =>
    createGoalAssessment(profile, index, snapshot.units),
  );
  const activeLane = getActiveDamageLane(snapshot.units, index);
  const bestGoalLane = getBestGoalLane(assessments);
  const preferredLane = activeLane ?? bestGoalLane;
  const controlState = getControlState(snapshot.units, index);
  const ownedRoleCoverage = getOwnedRoleCoverage(
    snapshot.units,
    index,
    model.combatProfiles,
  );

  return availableCandidates
    .map((unit) =>
      createRecommendation(
        unit,
        snapshot.units,
        index,
        getCombatProfile(model.combatProfiles, unit, index),
        ownedRoleCoverage,
        assessments,
        preferredLane,
        controlState,
      ),
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

function createRecommendation(
  unit: UnitDefinition,
  owned: Record<string, number>,
  index: UnitIndex,
  combat: CombatProfile,
  ownedRoleCoverage: Readonly<RoleScoreMap>,
  assessments: GoalAssessment[],
  preferredLane: DamageLane | null,
  controlState: ControlState,
): Recommendation {
  const direct = createDirectIngredients(unit, owned, index);
  const plan = calculateBuildPlan(unit.id, 1, index, owned);
  const goalMatch = selectGoalForUnit(
    unit,
    combat,
    assessments,
    preferredLane,
    ownedRoleCoverage,
  );
  const target = goalMatch
    ? toRecommendationTarget(goalMatch.assessment)
    : toFallbackTarget(unit, combat, plan);
  const status = getStatus(plan);
  const candidateStun = getStunCapability(unit);
  const controlBonus = getControlBonus(unit, controlState);
  const laneBonus = getLaneSynergy(combat.lane, preferredLane);
  const readinessBonus = status === "ready" ? 75 : status === "near" ? 30 : 0;
  const goalScore = goalMatch ? goalMatch.score * 1.1 : 0;
  const tierBonus = getGoalWeight(unit.group) * 0.08;
  const roleNeeds =
    goalMatch?.assessment.roleNeeds ?? createLaneRoleNeeds(preferredLane);
  const roleBonus =
    getRoleContribution(combat, roleNeeds, ownedRoleCoverage) * 42;
  const enhancementScore = getEnhancementScore(combat.enhancements, owned);
  const copyAdjustment = getCopyAdjustment(unit.group, owned, index);
  const score =
    goalScore +
    plan.progress * 45 +
    readinessBonus +
    (unit.priority ?? 0) * 1.2 +
    tierBonus +
    laneBonus +
    controlBonus +
    roleBonus +
    enhancementScore +
    copyAdjustment;
  const missingPath = createMissingMaterials(plan, index);
  const reason = createReason(
    unit,
    target,
    status,
    missingPath,
    plan,
    controlState,
    candidateStun,
    combat,
  );

  return {
    unit,
    score,
    progress: plan.progress,
    ingredients: direct.ingredients,
    missing: direct.ingredients.filter(
      (ingredient) => ingredient.remaining > 0,
    ),
    wispOwned: owned[WISP_ID] ?? 0,
    wispUsed: plan.wispUsed,
    missingResources: plan.missingResources,
    unknownResources: plan.unknownResources,
    resourceRequirements: plan.requiredResources,
    missingPath,
    target,
    status,
    reason,
  };
}

function createGoalAssessment(
  profile: TopTargetProfile,
  index: UnitIndex,
  owned: Record<string, number>,
): GoalAssessment {
  const plan = calculateBuildPlan(profile.target.id, 1, index, owned);
  const progressFactor = 0.35 + plan.progress * 0.65;
  const readyBonus = plan.missingTotal === 0 ? 20 : 0;
  const enhancementScore = getEnhancementScore(
    profile.combat.enhancements,
    owned,
  );
  const copyAdjustment = getCopyAdjustment(profile.target.group, owned, index);

  return {
    target: profile.target,
    combat: profile.combat,
    lane: profile.lane,
    plan,
    dependencyDemand: profile.dependencyDemand,
    roleNeeds: profile.roleNeeds,
    opportunity:
      profile.weight * progressFactor +
      readyBonus +
      enhancementScore +
      copyAdjustment,
  };
}

const COMBAT_ROLE_ORDER: readonly CombatRole[] = [
  "실딜",
  "라인딜",
  "단일딜",
  "끝딜",
  "보스딜",
  "광폭딜",
  "방깍",
  "아머브레이크",
  "마방깍",
  "버프",
  "스턴",
  "이감",
  "마나젠",
  "체젠",
];

function createCombatProfile(
  unit: UnitDefinition,
  index: UnitIndex,
): CombatProfile {
  const abilities = unit.abilities ?? {};
  const note = unit.note ?? "";
  const strengths: RoleScoreMap = {};
  const hasAbility = (...names: string[]) =>
    names.some((name) => Object.hasOwn(abilities, name));
  const maxAbilityNumber = (...names: string[]) =>
    Math.max(
      0,
      ...names.map((name) => {
        const value = abilities[name];
        return typeof value === "number" ? value : value === true ? 1 : 0;
      }),
    );
  const mark = (role: CombatRole, strength = 1) => {
    strengths[role] = Math.max(
      strengths[role] ?? 0,
      clampRoleStrength(strength),
    );
  };

  const defenseReduction = maxAbilityNumber(
    "방어력 감소",
    "발동방어력 감소",
    "단일방어력 감소",
    "중첩방어력 감소",
  );
  if (defenseReduction > 0 || hasAbility("방어력 감소", "발동방어력 감소")) {
    mark("방깍", Math.max(0.55, defenseReduction / 40));
  }

  const armorBreak = maxAbilityNumber("아머브레이크");
  if (
    armorBreak > 0 ||
    hasAbility("아머브레이크") ||
    /암브|아머브레이크/.test(note)
  ) {
    mark("아머브레이크", Math.max(0.7, armorBreak));
  }

  const magicDefenseReduction = maxAbilityNumber(
    "마법 방어력 감소",
    "단일마법 방어력 감소",
  );
  if (magicDefenseReduction > 0 || hasAbility("마법 방어력 감소")) {
    mark("마방깍", Math.max(0.55, magicDefenseReduction / 20));
  }

  const hasBuffAbility = hasAbility(
    "공격력 증가",
    "발동공격력 증가",
    "공격속도 증가",
    "마법 대미지 증가",
    "단일마법 대미지 증가",
    "폭발형 대미지 증폭",
    "모든피해증가",
    "마나 재생",
    "체력 재생",
  );
  const hasExplicitBuff =
    /각종버프|공증\s*\d+|마뎀증\s*\d+|공속\s*\d+|마나젠\s*\d+/.test(note) &&
    !/해주면|받으면|챙겨주|필요/.test(note);
  if (hasBuffAbility || hasExplicitBuff) {
    const buffValue = Math.max(
      maxAbilityNumber(
        "공격력 증가",
        "발동공격력 증가",
        "공격속도 증가",
        "마법 대미지 증가",
        "단일마법 대미지 증가",
        "폭발형 대미지 증폭",
        "모든피해증가",
      ) / 50,
      0.65,
    );
    mark("버프", buffValue);
  }

  const slowValue = Math.max(
    maxAbilityNumber("이동속도 감소") / 50,
    maxAbilityNumber("발동이동속도 감소") / 70,
  );
  if (slowValue > 0 || /이감\s*\d+|이동속도 감소\s*\d+|발동이감/.test(note)) {
    mark("이감", Math.max(0.45, slowValue));
  }

  const manaRegen = maxAbilityNumber("마나 재생");
  const healthRegen = maxAbilityNumber("체력 재생");
  const hasManaSupportText =
    /마나젠|마나리젠|마나회복오라|마나\s*재생/.test(note) &&
    !/올려주면|받으면|필요|챙겨주|높으면|좋으면|있으면/.test(note);
  const hasHealthSupportText =
    /체젠|체력\s*재생|체력회복/.test(note) &&
    !/올려주면|받으면|필요|챙겨주|높으면|좋으면|있으면/.test(note);
  if (manaRegen > 0 || hasManaSupportText) {
    mark("마나젠", Math.max(0.55, manaRegen / 2.5));
  }
  if (healthRegen > 0 || hasHealthSupportText) {
    mark("체젠", Math.max(0.55, healthRegen / 1.75));
  }

  const hasLineDamage = /라인딜|라인 딜|라인에.*딜|라인.*강함/.test(note);
  const hasSingleDamage =
    hasAbility("단일") || /단일(?:딜|대미지|스킬|저격|처치|죽이)/.test(note);
  const hasEndDamage = hasAbility("끝딜", "범위 끝딜") || /끝딜/.test(note);
  const hasBossDamage =
    hasAbility("보스 잡기", "보스잡기") ||
    /보스(?:딜|잡|킬|에 강|에 좋|최고)/.test(note);
  const hasRageDamage = hasAbility("광폭화") || /광폭|폭뎀|폭딜/.test(note);
  const hasPrimaryDamageAbility = hasAbility(
    "단일",
    "끝딜",
    "범위 끝딜",
    "보스 잡기",
    "보스잡기",
    "방어력 무시 대미지",
    "범위 전체 체력 퍼센트 대미지",
    "범위 현재 체력 퍼센트 대미지",
    "범위 잃은 체력 퍼센트 대미지",
  );
  const hasAuxiliaryDamage = hasAbility("보조딜");
  const hasDirectDamage =
    hasAbility(
      "단일",
      "끝딜",
      "범위 끝딜",
      "보스 잡기",
      "보스잡기",
      "방어력 무시 대미지",
      "범위 전체 체력 퍼센트 대미지",
      "범위 현재 체력 퍼센트 대미지",
      "범위 잃은 체력 퍼센트 대미지",
      "보조딜",
    ) || /(?:딜러|딜링|스킬딜|폭뎀딜러|실딜)/.test(note);

  if (
    hasDirectDamage ||
    hasLineDamage ||
    hasSingleDamage ||
    hasEndDamage ||
    hasBossDamage ||
    hasRageDamage
  ) {
    mark("실딜", hasAuxiliaryDamage && !hasPrimaryDamageAbility ? 0.55 : 1);
  }
  if (hasLineDamage) {
    mark("라인딜");
  }
  if (hasSingleDamage) {
    mark("단일딜");
  }
  if (hasEndDamage) {
    mark("끝딜");
  }
  if (hasBossDamage) {
    mark("보스딜");
  }
  if (hasRageDamage) {
    mark("광폭딜");
  }

  const stun = getStunCapability(unit);
  if (stun > 0) {
    mark("스턴", stun);
  }

  const roles = COMBAT_ROLE_ORDER.filter((role) => (strengths[role] ?? 0) > 0);

  return {
    lane: getDamageLane(unit),
    skillResource: getSkillResource(note),
    roles,
    strengths,
    enhancements: createEnhancementRequirements(unit, index),
  };
}

function createRoleNeeds(profile: CombatProfile): RoleScoreMap {
  const needs = createLaneRoleNeeds(profile.lane);
  const damageRoles: CombatRole[] = [
    "실딜",
    "라인딜",
    "단일딜",
    "끝딜",
    "보스딜",
    "광폭딜",
  ];
  const hasDamage = damageRoles.some(
    (role) => (profile.strengths[role] ?? 0) > 0,
  );

  if (!hasDamage) {
    addRoleNeed(needs, "실딜", 1.4);
    addRoleNeed(needs, profile.lane === "마딜" ? "단일딜" : "라인딜", 1.1);
    addRoleNeed(needs, profile.lane === "마딜" ? "끝딜" : "보스딜", 1);
  }

  if (profile.skillResource === "마나") {
    addRoleNeed(needs, "마나젠", 1.45);
  } else if (profile.skillResource === "체력") {
    addRoleNeed(needs, "체젠", 1.45);
  } else if (profile.skillResource === "혼합") {
    addRoleNeed(needs, "마나젠", 1.25);
    addRoleNeed(needs, "체젠", 1.25);
  }

  for (const role of ["라인딜", "보스딜", "광폭딜"] as const) {
    if ((profile.strengths[role] ?? 0) > 0) {
      needs[role] = (needs[role] ?? 0) * 0.55;
    }
  }

  return needs;
}

function createLaneRoleNeeds(lane: DamageLane | null): RoleScoreMap {
  if (lane === "물딜") {
    return {
      방깍: 1.35,
      아머브레이크: 1.1,
      버프: 1,
      라인딜: 1,
      보스딜: 1,
      광폭딜: 1,
      이감: 0.85,
      스턴: 0.7,
    };
  }

  if (lane === "마딜") {
    return {
      마방깍: 1.35,
      버프: 1.1,
      단일딜: 1,
      끝딜: 1,
      보스딜: 0.95,
      광폭딜: 0.95,
      이감: 0.85,
      스턴: 0.7,
    };
  }

  return lane === "공통"
    ? {
        실딜: 0.9,
        라인딜: 0.7,
        보스딜: 0.7,
        광폭딜: 0.7,
        버프: 0.7,
        이감: 0.6,
        스턴: 0.6,
      }
    : {};
}

function getOwnedRoleCoverage(
  owned: Record<string, number>,
  index: UnitIndex,
  profiles: ReadonlyMap<string, CombatProfile>,
): RoleScoreMap {
  const coverage: RoleScoreMap = {};

  for (const [id, count] of Object.entries(owned)) {
    if (count <= 0) {
      continue;
    }

    const unit = findUnit(index, id);
    if (!unit) {
      continue;
    }

    const profile = getCombatProfile(profiles, unit, index);
    for (const role of profile.roles) {
      coverage[role] = Math.min(
        1,
        (coverage[role] ?? 0) +
          (profile.strengths[role] ?? 0) * Math.min(count, 2) * 0.75,
      );
    }
  }

  return coverage;
}

function getRoleContribution(
  combat: CombatProfile,
  needs: Readonly<RoleScoreMap>,
  ownedCoverage: Readonly<RoleScoreMap>,
): number {
  const entries = Object.entries(needs) as Array<[CombatRole, number]>;
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  const weightedContribution = entries.reduce((sum, [role, weight]) => {
    const strength = combat.strengths[role] ?? 0;
    const missing = 1 - (ownedCoverage[role] ?? 0);
    return sum + weight * strength * (0.2 + Math.max(missing, 0));
  }, 0);

  return Math.min(weightedContribution / totalWeight, 1);
}

function getCombatProfile(
  profiles: ReadonlyMap<string, CombatProfile>,
  unit: UnitDefinition,
  index: UnitIndex,
): CombatProfile {
  return profiles.get(normalizeId(unit.id)) ?? createCombatProfile(unit, index);
}

function addRoleNeed(needs: RoleScoreMap, role: CombatRole, weight: number) {
  needs[role] = Math.max(needs[role] ?? 0, weight);
}

function clampRoleStrength(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function getSkillResource(note: string): SkillResource {
  const usesMana =
    /마나\s*스킬|마나스킬|마나\s*\d+\s*(?:소모|사용)|마나\s*소모/.test(note);
  const usesHealth =
    /체력\s*스킬|체력스킬|체력\s*\d+\s*(?:소모|사용)|체력\s*소모/.test(note);

  if (usesMana && usesHealth) {
    return "혼합";
  }

  if (usesMana) {
    return "마나";
  }

  if (usesHealth) {
    return "체력";
  }

  return "없음";
}

function createEnhancementRequirements(
  unit: UnitDefinition,
  index: UnitIndex,
): EnhancementRequirement[] {
  const requirements = new Map<string, EnhancementRequirement>();
  const addRequirement = (
    item: UnitDefinition,
    count: number,
    required: boolean,
  ) => {
    const existing = requirements.get(normalizeId(item.id));
    requirements.set(normalizeId(item.id), {
      id: item.id,
      name: item.name,
      count: Math.max(existing?.count ?? 0, count),
      required: (existing?.required ?? false) || required,
    });
  };

  for (const [id, count] of Object.entries(unit.recipe)) {
    const item = findUnit(index, id);
    if (item?.group === "아이템") {
      addRequirement(item, count, true);
    }
  }

  const note = unit.note ?? "";
  for (const match of note.matchAll(/아이템\s*'([^']+)'/g)) {
    const reference = match[1]?.trim();
    if (!reference) {
      continue;
    }

    const item = resolveItemReference(reference, index);
    if (!item) {
      continue;
    }

    const start = match.index ?? 0;
    const context = note.slice(start, start + 100);
    addRequirement(item, 1, /필요/.test(context));
  }

  return Array.from(requirements.values());
}

function resolveItemReference(
  reference: string,
  index: UnitIndex,
): UnitDefinition | undefined {
  const normalizedReference = normalizeItemName(reference);
  return Array.from(index.byId.values())
    .filter((unit) => unit.group === "아이템")
    .find((item) => {
      const normalizedName = normalizeItemName(item.name);
      return (
        normalizedName.includes(normalizedReference) ||
        normalizedReference.includes(normalizedName)
      );
    });
}

function normalizeItemName(name: string): string {
  return name.toLowerCase().replaceAll(" ", "");
}

function getEnhancementScore(
  requirements: readonly EnhancementRequirement[],
  owned: Record<string, number>,
): number {
  return requirements.reduce((score, requirement) => {
    const ownedCount = owned[requirement.id] ?? 0;
    const progress = Math.min(ownedCount / requirement.count, 1);

    if (requirement.required) {
      return score + (progress === 1 ? 28 : -32 * (1 - progress));
    }

    return score + (progress === 1 ? 14 : -5 * (1 - progress));
  }, 0);
}

function selectGoalForUnit(
  unit: UnitDefinition,
  combat: CombatProfile,
  assessments: GoalAssessment[],
  preferredLane: DamageLane | null,
  ownedRoleCoverage: Readonly<RoleScoreMap>,
): GoalMatch | null {
  const matches = assessments.flatMap((assessment) => {
    const demand = assessment.dependencyDemand.get(normalizeId(unit.id)) ?? 0;

    if (demand === 0) {
      return [];
    }

    const demandFactor = Math.min(1.8, 1 + Math.log2(demand + 1) * 0.18);
    const targetLaneFactor = getGoalLaneFactor(combat.lane, assessment.lane);
    const preferredLaneFactor = preferredLane
      ? getPreferredLaneFactor(combat.lane, preferredLane)
      : 1;
    const roleFactor =
      0.82 +
      getRoleContribution(combat, assessment.roleNeeds, ownedRoleCoverage) *
        0.36;

    return [
      {
        assessment,
        demand,
        score:
          assessment.opportunity *
          demandFactor *
          targetLaneFactor *
          preferredLaneFactor *
          roleFactor,
      },
    ];
  });

  return matches.sort((left, right) => right.score - left.score)[0] ?? null;
}

function createDirectIngredients(
  unit: UnitDefinition,
  owned: Record<string, number>,
  index: UnitIndex,
): { ingredients: IngredientProgress[] } {
  let remainingWisp = owned[WISP_ID] ?? 0;
  const ingredients = Object.entries(unit.recipe).map(([id, required]) => {
    const ownedCount = owned[id] ?? 0;
    const exactMissing = Math.max(required - ownedCount, 0);
    const ingredient = findUnit(index, id);
    const canUseWisp = id !== WISP_ID && ingredient?.group === COMMON_GROUP;
    const coveredByWisp = canUseWisp
      ? Math.min(exactMissing, remainingWisp)
      : 0;

    remainingWisp -= coveredByWisp;

    return {
      id,
      name: ingredient?.name ?? id,
      required,
      owned: ownedCount,
      coveredByWisp,
      remaining: exactMissing - coveredByWisp,
    } satisfies IngredientProgress;
  });

  return { ingredients };
}

function calculateBuildPlan(
  rootId: string,
  count: number,
  index: UnitIndex,
  owned: Record<string, number>,
): BuildPlan {
  const inventory = new Map(
    Object.entries(owned).map(([id, amount]) => [normalizeId(id), amount]),
  );
  const pending = new Map<string, number>([[rootId, count]]);
  const missingById = new Map<string, number>();
  const requiredResources: Record<string, number> = {};
  let wispRemaining = inventory.get(WISP_ID) ?? 0;
  let workRequired = 0;
  let workCovered = 0;
  let wispUsed = 0;
  let steps = 0;

  const addPending = (id: string, amount: number) => {
    pending.set(id, (pending.get(id) ?? 0) + amount);
  };

  const addMissing = (id: string, amount: number) => {
    missingById.set(id, (missingById.get(id) ?? 0) + amount);
  };

  while (pending.size > 0 && steps < MAX_PLAN_STEPS) {
    steps += 1;
    const next = pending.entries().next().value as [string, number];
    const [id, required] = next;
    pending.delete(id);

    const inventoryKey = normalizeId(id);
    const available = Math.max(inventory.get(inventoryKey) ?? 0, 0);
    const used = Math.min(required, available);
    const remaining = required - used;
    inventory.set(inventoryKey, available - used);
    if (inventoryKey === WISP_ID) {
      wispRemaining -= used;
    }

    workRequired += required;
    workCovered += used;

    if (remaining === 0) {
      continue;
    }

    const unit = findUnit(index, id);
    if (unit) {
      for (const [resourceId, resourceCount] of Object.entries(
        unit.resources,
      )) {
        requiredResources[resourceId] =
          (requiredResources[resourceId] ?? 0) + resourceCount * remaining;
      }

      if (Object.keys(unit.recipe).length > 0) {
        for (const [ingredientId, ingredientCount] of Object.entries(
          unit.recipe,
        )) {
          addPending(ingredientId, ingredientCount * remaining);
        }
        continue;
      }
    }

    if (id !== WISP_ID && unit?.group === COMMON_GROUP) {
      const coveredByWisp = Math.min(remaining, wispRemaining);
      wispRemaining -= coveredByWisp;
      wispUsed += coveredByWisp;
      workCovered += coveredByWisp;
      addMissing(id, remaining - coveredByWisp);
    } else {
      addMissing(id, remaining);
    }
  }

  if (pending.size > 0) {
    for (const [id, amount] of pending) {
      addMissing(id, amount);
    }
  }

  const missingTotal = Array.from(missingById.values()).reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const missingResources = Object.entries(requiredResources).flatMap(
    ([id, required]) => {
      const ownedCount = owned[id];

      return ownedCount !== undefined && ownedCount < required
        ? [{ id, required, owned: ownedCount }]
        : [];
    },
  );
  const unknownResources = Object.keys(requiredResources).filter(
    (id) => owned[id] === undefined,
  );

  return {
    progress: workRequired === 0 ? 1 : Math.min(workCovered / workRequired, 1),
    missingById,
    missingTotal,
    wispUsed,
    requiredResources,
    missingResources,
    unknownResources,
  };
}

function createMissingMaterials(
  plan: BuildPlan,
  index: UnitIndex,
): MissingMaterial[] {
  return Array.from(plan.missingById, ([id, count]) => ({
    id,
    name: findUnit(index, id)?.name ?? id,
    count,
  }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
}

function buildDependencyDemand(
  rootId: string,
  index: UnitIndex,
): ReadonlyMap<string, number> {
  const demand = new Map<string, number>();

  const visit = (id: string, amount: number, path: ReadonlySet<string>) => {
    const unit = findUnit(index, id);
    const canonicalId = normalizeId(unit?.id ?? id);
    demand.set(canonicalId, (demand.get(canonicalId) ?? 0) + amount);

    if (!unit || path.has(canonicalId)) {
      return;
    }

    const nextPath = new Set(path);
    nextPath.add(canonicalId);
    for (const [ingredientId, ingredientCount] of Object.entries(unit.recipe)) {
      visit(ingredientId, amount * ingredientCount, nextPath);
    }
  };

  visit(rootId, 1, new Set());
  return demand;
}

function createUnitIndex(catalog: readonly UnitDefinition[]): UnitIndex {
  const byId = new Map<string, UnitDefinition>();
  const byLowerId = new Map<string, UnitDefinition>();

  for (const unit of catalog) {
    byId.set(unit.id, unit);
    if (!byLowerId.has(normalizeId(unit.id))) {
      byLowerId.set(normalizeId(unit.id), unit);
    }
  }

  return { byId, byLowerId };
}

function findUnit(index: UnitIndex, id: string): UnitDefinition | undefined {
  return index.byId.get(id) ?? index.byLowerId.get(normalizeId(id));
}

function getActiveDamageLane(
  owned: Record<string, number>,
  index: UnitIndex,
): DamageLane | null {
  const scores: Record<"물딜" | "마딜", number> = { 물딜: 0, 마딜: 0 };

  for (const [id, count] of Object.entries(owned)) {
    if (count <= 0) {
      continue;
    }

    const unit = findUnit(index, id);
    const lane = unit ? getDamageLane(unit) : "공통";
    if (lane === "물딜" || lane === "마딜") {
      scores[lane] += count * (1 + getGoalWeight(unit?.group ?? "") / 100);
    }
  }

  if (scores.물딜 === scores.마딜 || (scores.물딜 === 0 && scores.마딜 === 0)) {
    return null;
  }

  return scores.물딜 > scores.마딜 ? "물딜" : "마딜";
}

function getBestGoalLane(assessments: GoalAssessment[]): DamageLane | null {
  return (
    assessments
      .filter(
        (assessment) =>
          assessment.lane === "물딜" || assessment.lane === "마딜",
      )
      .sort((left, right) => right.opportunity - left.opportunity)[0]?.lane ??
    null
  );
}

function getDamageLane(unit: UnitDefinition): DamageLane {
  if (unit.group.includes("[물딜]")) {
    return "물딜";
  }

  if (unit.group.includes("[마딜]")) {
    return "마딜";
  }

  if (unit.group.includes("[스턴]")) {
    return "스턴";
  }

  return "공통";
}

function getStunCapability(unit: UnitDefinition): number {
  const stun = unit.abilities?.스턴;

  if (typeof stun === "number") {
    return stun;
  }

  if (stun === true || unit.group.includes("[스턴]")) {
    return 1;
  }

  return 0;
}

function getSlowCapability(unit: UnitDefinition): number {
  const direct = getAbilityNumber(unit, "이동속도 감소");
  const triggered = getAbilityNumber(unit, "발동이동속도 감소");
  const note = unit.note ?? "";

  if (direct > 0) {
    return Math.min(1, Math.max(0.35, direct / 50));
  }

  if (triggered > 0) {
    return Math.min(1, Math.max(0.25, (triggered / 70) * 0.75));
  }

  return /이감\s*\d+|이동속도 감소\s*\d+|발동이감/.test(note) ? 0.25 : 0;
}

function getAbilityNumber(unit: UnitDefinition, ability: string): number {
  const value = unit.abilities?.[ability];
  return typeof value === "number" ? value : value === true ? 1 : 0;
}

function getControlState(
  owned: Record<string, number>,
  index: UnitIndex,
): ControlState {
  const state: ControlState = { hasSlow: false, hasStun: false };

  for (const [id, count] of Object.entries(owned)) {
    if (count <= 0) {
      continue;
    }

    const unit = findUnit(index, id);
    if (!unit) {
      continue;
    }

    state.hasSlow ||= getSlowCapability(unit) > 0;
    state.hasStun ||= getStunCapability(unit) >= 1;

    if (state.hasSlow && state.hasStun) {
      break;
    }
  }

  return state;
}

function getControlBonus(unit: UnitDefinition, state: ControlState): number {
  const slow = getSlowCapability(unit);
  const stun = getStunCapability(unit);

  if (state.hasSlow && state.hasStun) {
    return 0;
  }

  const slowScore = slow > 0 ? Math.min(1, 0.4 + slow) : 0;
  const stunScore = stun >= 1 ? 1 : stun > 0 ? Math.min(0.5, stun) : 0;

  if (!state.hasSlow && !state.hasStun) {
    const pairBonus = slow > 0 && stun >= 1 ? 18 : 0;
    const soloStunPenalty = stun >= 1 && slow === 0 ? -16 : 0;
    return slowScore * 32 + stunScore * 34 + pairBonus + soloStunPenalty;
  }

  if (!state.hasSlow) {
    return slow > 0 ? slowScore * 42 : -8;
  }

  return stun >= 1 ? 42 : stun > 0 ? stunScore * 18 : -8;
}

function getControlText(
  state: ControlState,
  candidateSlow: number,
  candidateStun: number,
): string {
  if (!state.hasSlow && !state.hasStun) {
    if (candidateSlow > 0 && candidateStun >= 1) {
      return "이감+스턴 1 이상 동시 보완";
    }

    if (candidateStun >= 1) {
      return "스턴 1 이상이지만 이감 선행 필요";
    }

    if (candidateSlow > 0) {
      return "이감 우선 확보 · 스턴 1 이상 필요";
    }

    return "이감+스턴 조건 필요";
  }

  if (!state.hasSlow) {
    return candidateSlow > 0 ? "이감 보완" : "이감 필요 · 스턴만으로 부족";
  }

  if (!state.hasStun) {
    return candidateStun >= 1
      ? "이감 연계 스턴 1 이상 확보"
      : "이감 연계 스턴 1 이상 필요";
  }

  return "이감+스턴 조건 충족";
}

function hasOwnedGroup(
  owned: Record<string, number>,
  index: UnitIndex,
  group: string,
): boolean {
  return Object.entries(owned).some(([id, count]) => {
    const unit = findUnit(index, id);
    return count > 0 && unit?.group === group;
  });
}

function getLaneSynergy(
  candidateLane: DamageLane,
  preferredLane: DamageLane | null,
): number {
  if (!preferredLane || candidateLane === "공통") {
    return 5;
  }

  if (candidateLane === preferredLane) {
    return 20;
  }

  if (candidateLane === "스턴") {
    return 12;
  }

  return -18;
}

function getPreferredLaneFactor(
  candidateLane: DamageLane,
  preferredLane: DamageLane,
): number {
  if (candidateLane === "공통" || candidateLane === "스턴") {
    return 1.05;
  }

  return candidateLane === preferredLane ? 1.12 : 0.88;
}

function getGoalLaneFactor(
  candidateLane: DamageLane,
  targetLane: DamageLane,
): number {
  if (candidateLane === "공통" || targetLane === "공통") {
    return 1.05;
  }

  if (candidateLane === targetLane || candidateLane === "스턴") {
    return 1.12;
  }

  return 0.9;
}

function getGoalWeight(group: string): number {
  return TOP_TARGET_GROUP_WEIGHTS[group] ?? 0;
}

function isCopyBlocked(
  group: string,
  owned: Record<string, number>,
  index: UnitIndex,
): boolean {
  const maxCopies = TOP_TARGET_COPY_POLICIES[group]?.maxCopies;
  return (
    maxCopies !== undefined &&
    getOwnedGroupCount(group, owned, index) >= maxCopies
  );
}

function getCopyAdjustment(
  group: string,
  owned: Record<string, number>,
  index: UnitIndex,
): number {
  const repeatPenalty = TOP_TARGET_COPY_POLICIES[group]?.repeatPenalty;
  if (!repeatPenalty) {
    return 0;
  }

  const ownedCount = getOwnedGroupCount(group, owned, index);
  return ownedCount > 0 ? -repeatPenalty * ownedCount : 0;
}

function getOwnedGroupCount(
  group: string,
  owned: Record<string, number>,
  index: UnitIndex,
): number {
  return Object.entries(owned).reduce((total, [id, count]) => {
    const unit = findUnit(index, id);
    return unit?.group === group && count > 0 ? total + count : total;
  }, 0);
}

function getStatus(plan: BuildPlan): "ready" | "near" | "planned" {
  if (plan.missingTotal === 0 && plan.missingResources.length === 0) {
    return "ready";
  }

  return plan.progress >= 0.55 ? "near" : "planned";
}

function toRecommendationTarget(
  assessment: GoalAssessment,
): RecommendationTarget {
  return {
    id: assessment.target.id,
    name: assessment.target.name,
    group: assessment.target.group,
    lane: assessment.lane,
    roles: [...assessment.combat.roles],
    skillResource: assessment.combat.skillResource,
    enhancements: [...assessment.combat.enhancements],
    progress: assessment.plan.progress,
  };
}

function toFallbackTarget(
  unit: UnitDefinition,
  combat: CombatProfile,
  plan: BuildPlan,
): RecommendationTarget {
  return {
    id: unit.id,
    name: unit.name,
    group: unit.group,
    lane: combat.lane,
    roles: [...combat.roles],
    skillResource: combat.skillResource,
    enhancements: [...combat.enhancements],
    progress: plan.progress,
  };
}

function createReason(
  unit: UnitDefinition,
  target: RecommendationTarget,
  status: "ready" | "near" | "planned",
  missingPath: MissingMaterial[],
  plan: BuildPlan,
  controlState: ControlState,
  candidateStun: number,
  combat: CombatProfile,
): string {
  const goalText =
    target.id === unit.id
      ? `최종 목표 ${target.name}`
      : `${target.name}으로 이어지는 경로`;
  const laneText = target.lane === "공통" ? "공통 재료" : `${target.lane} 축`;
  const controlText = getControlText(
    controlState,
    getSlowCapability(unit),
    candidateStun,
  );
  const resourceText = formatSkillResource(target.skillResource);
  const readinessText =
    status === "ready"
      ? "현재 재료로 올릴 수 있습니다"
      : status === "near"
        ? `부족 재료 ${missingPath.length}종만 남았습니다`
        : `부족 재료 ${missingPath.length}종을 모읍니다`;
  const wispText = formatWispUsage(plan.wispUsed);
  const roleText =
    combat.roles.length > 0
      ? `후보 역할 ${formatRoles(combat.roles)}`
      : "역할 데이터 확인 필요";

  return [
    goalText,
    laneText,
    roleText,
    controlText,
    resourceText,
    readinessText,
    wispText,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatRoles(roles: readonly CombatRole[]): string {
  return roles.join("·");
}

function formatSkillResource(resource: SkillResource): string {
  if (resource === "마나") {
    return "마나 스킬 · 마나젠 조합";
  }

  if (resource === "체력") {
    return "체력 스킬 · 체젠 조합";
  }

  if (resource === "혼합") {
    return "마나·체력 스킬 · 마나젠+체젠 조합";
  }

  return "";
}

function formatWispUsage(wispUsed: number): string {
  return wispUsed > 0 ? `위습 ${wispUsed}개 사용` : "위습 사용 없음";
}

function normalizeId(id: string): string {
  return id.toLowerCase();
}

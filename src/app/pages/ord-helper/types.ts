export type TmoSnapshot = {
  units: Record<string, number>;
  banned: string[];
  receivedAt: number;
};

export type UnitDefinition = {
  id: string;
  name: string;
  group: string;
  role: string;
  recipe: Record<string, number>;
  resources: Record<string, number>;
  selectWisp?: boolean;
  abilities?: Record<string, number | boolean>;
  priority?: number;
  note?: string;
};

export type DamageLane = "물딜" | "마딜" | "스턴" | "공통";

export type SkillResource = "마나" | "체력" | "혼합" | "없음";

export type CombatRole =
  | "방깍"
  | "아머브레이크"
  | "마방깍"
  | "실딜"
  | "버프"
  | "라인딜"
  | "단일딜"
  | "끝딜"
  | "보스딜"
  | "광폭딜"
  | "스턴"
  | "이감"
  | "마나젠"
  | "체젠";

export type EnhancementRequirement = {
  id: string;
  name: string;
  count: number;
  required: boolean;
};

export type RecommendationTarget = {
  id: string;
  name: string;
  group: string;
  lane: DamageLane;
  roles: CombatRole[];
  skillResource: SkillResource;
  enhancements: EnhancementRequirement[];
  progress: number;
};

export type MissingMaterial = {
  id: string;
  name: string;
  count: number;
};

export type IngredientProgress = {
  id: string;
  name: string;
  required: number;
  owned: number;
  coveredByWisp: number;
  remaining: number;
};

export type Recommendation = {
  unit: UnitDefinition;
  score: number;
  progress: number;
  ingredients: IngredientProgress[];
  missing: IngredientProgress[];
  wispOwned: number;
  wispUsed: number;
  missingResources: Array<{
    id: string;
    required: number;
    owned: number | undefined;
  }>;
  unknownResources: string[];
  resourceRequirements: Record<string, number>;
  missingPath: MissingMaterial[];
  target: RecommendationTarget;
  status: "ready" | "near" | "planned";
  reason: string;
};

export type PlaceRow = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

export type ExperienceRow = {
  id: string;
  placeId: string;
  title: string;
  description: string | null;
  goodToKnow: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TagRow = {
  id: string;
  name: string;
};

export type ExperienceTagRow = {
  id: string;
  experienceId: string;
  tagId: string;
};

export type PromotionPayload = {
  places: PlaceRow[];
  experiences: ExperienceRow[];
  tags: TagRow[];
  experienceTags: ExperienceTagRow[];
  /** Approved submissions that contributed experience IDs (may exceed unique experiences). */
  approvedSubmissionCount: number;
};

export type ExistingState = {
  placesById: Map<string, PlaceRow>;
  placesBySlug: Map<string, PlaceRow>;
  experiencesById: Map<string, ExperienceRow>;
  tagsById: Map<string, TagRow>;
  tagsByName: Map<string, TagRow>;
  experienceTagsByPair: Map<string, ExperienceTagRow>;
};

export type PromotionConflict = {
  code:
    | "place_slug_id_mismatch"
    | "place_slug_collision"
    | "tag_name_id_mismatch"
    | "tag_name_collision"
    | "missing_place"
    | "missing_tag"
    | "missing_experience"
    | "approved_without_experience";
  message: string;
};

export type EntityAction = "create" | "update" | "unchanged";

export type PlannedPlace = {
  row: PlaceRow;
  action: EntityAction;
};

export type PlannedExperience = {
  row: ExperienceRow;
  action: EntityAction;
};

export type PlannedTag = {
  row: TagRow;
  action: EntityAction;
};

export type PlannedExperienceTag = {
  row: ExperienceTagRow;
  action: "create" | "unchanged";
};

export type PromotionPlan = {
  places: PlannedPlace[];
  experiences: PlannedExperience[];
  tags: PlannedTag[];
  experienceTags: PlannedExperienceTag[];
  conflicts: PromotionConflict[];
};

export type PromotionCounts = {
  placesCreated: number;
  placesUpdated: number;
  experiencesCreated: number;
  experiencesUpdated: number;
  tagsCreated: number;
  tagsUpdated: number;
  relationshipsAdded: number;
};

export type PromotionStatus = "success" | "failure" | "dry_run" | "aborted";

export type PromotionLogEntry = {
  promotionId: string;
  timestamp: string;
  sourceEnvironment: "qa";
  targetEnvironment: "production";
  placesCreated: number;
  placesUpdated: number;
  experiencesCreated: number;
  experiencesUpdated: number;
  tagsCreated: number;
  tagsUpdated: number;
  relationshipsAdded: number;
  status: PromotionStatus;
  error: string | null;
  dryRun: boolean;
};

export type PromoteOptions = {
  qaDatabaseUrl: string;
  productionDatabaseUrl: string;
  dryRun: boolean;
  confirmProduction: boolean;
  /** When set, used instead of generating a new UUID (tests). */
  promotionId?: string;
  /** Optional override for where JSON logs are written. */
  logDirectory?: string;
};

export type PromoteResult = {
  promotionId: string;
  dryRun: boolean;
  status: PromotionStatus;
  plan: PromotionPlan;
  counts: PromotionCounts;
  error: string | null;
};

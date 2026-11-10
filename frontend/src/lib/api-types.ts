export type QuestionType = "TEXT" | "TEXT_IMAGE";
export type TransactionType = "TOPUP" | "EXAM_FEE" | "REFUND" | "PLAN_PURCHASE" | "ADMIN_ADJUSTMENT";
export type TransactionStatus = "PENDING" | "SUCCESS" | "FAILED";
export type ExamAttemptStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export interface User {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  walletBalance: string;
  hasUsedFreeExam: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoleSummary {
  id: string;
  name: string;
  isSuperAdmin: boolean;
}

/** GET /auth/me — the signed-in user plus what they're allowed to do and their exam access. */
export interface CurrentUser extends User {
  roles: RoleSummary[];
  isSuperAdmin: boolean;
  permissions: string[];
  access: AccessSummary;
}

/** GET /users — a user row as seen by admins. */
export interface ManagedUser extends User {
  roles: RoleSummary[];
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSuperAdmin: boolean;
  isDefault: boolean;
  userCount: number;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

/** GET /permissions/catalog — modules and actions from the backend access config. */
export interface PermissionCatalogModule {
  module: string;
  label: string;
  actions: { name: string; action: string; label: string }[];
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExamConfig {
  id: string;
  name: string;
  numberOfQuestions: number;
  price: string;
  passMarkPercent: number;
  durationMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Option {
  id: string;
  text: string | null;
  imageUrl: string | null;
  isCorrect?: boolean;
}

/** A paginated list response ({ items, total, page, pageSize }). */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** GET /question — a row of the admin question bank. */
export interface QuestionListItem {
  id: string;
  categoryId: string;
  category: { id: string; name: string };
  type: QuestionType;
  text: string;
  imageUrl: string | null;
  explanation: string | null;
  isActive: boolean;
  allowMultiple: boolean;
  optionCount: number;
  optionImageCount: number;
  createdAt: string;
  updatedAt: string;
}

/** GET /question/:id — options come back in display order (position). */
export interface QuestionDetail extends Omit<QuestionListItem, "optionCount" | "optionImageCount"> {
  options: (Required<Option> & { position: number })[];
}

export interface AttemptQuestion {
  order: number;
  question: {
    id: string;
    type: QuestionType;
    text: string;
    imageUrl: string | null;
    allowMultiple: boolean;
    explanation?: string | null;
    options: Option[];
  };
}

export interface AttemptAnswer {
  questionId: string;
  selectedOptionIds: string[];
  isCorrect?: boolean;
  answeredAt: string;
}

export interface ExamAttempt {
  id: string;
  userId: string;
  examConfigId: string;
  categoryId: string | null;
  transactionId: string | null;
  isFree: boolean;
  status: ExamAttemptStatus;
  totalQuestions: number;
  score: number;
  percentage: string;
  passed: boolean;
  startedAt: string;
  completedAt: string | null;
  examConfig?: ExamConfig;
  questions?: AttemptQuestion[];
  answers?: AttemptAnswer[];
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  isReversed: boolean;
  provider: string | null;
  providerRef: string | null;
  /** Top-up payer details (reconciliation): phone for mobile money, masked card otherwise. */
  payerPhone: string | null;
  cardHolderName: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpiryMonth: number | null;
  cardExpiryYear: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ---------------------------------- Plans & subscriptions --------------------------------- */

export type PlanAccessType = "ATTEMPTS" | "TIME";
export type SubscriptionStatus = "PENDING" | "ACTIVE" | "EXHAUSTED" | "EXPIRED" | "CANCELLED";
export type SubscriptionSource = "PURCHASE" | "ADMIN_GRANT" | "MIGRATION";

/** Admin-entered text keyed by locale ("en" always present on plans; may be {} on custom grants). */
export type LocalizedText = Partial<Record<string, string>>;
export type LocalizedLines = Partial<Record<string, string[]>>;

/** GET /plans — an active plan as shown on the pricing page. Prices are whole RWF. */
export interface SubscriptionPlan {
  id: string;
  name: LocalizedText;
  extraFeatures: LocalizedLines | null;
  price: number;
  currency: string;
  accessType: PlanAccessType;
  attemptLimit: number | null;
  durationDays: number | null;
  isMostPopular: boolean;
  displayOrder: number;
}

/** GET /plans/manage — every plan, inactive included, as seen by admins. */
export interface ManagedPlan extends SubscriptionPlan {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { subscriptions: number };
}

/** A purchase/grant snapshot — the fields the access summary and history share. */
export interface SubscriptionSummary {
  id: string;
  planId: string | null;
  planName: LocalizedText;
  accessType: PlanAccessType;
  attemptLimit: number | null;
  attemptsRemaining: number | null;
  durationDays: number | null;
  startsAt: string;
  expiresAt: string | null;
  source: SubscriptionSource;
  createdAt: string;
}

/** GET /subscriptions — purchase history (own rows, or everyone's for staff). */
export interface UserSubscription extends SubscriptionSummary {
  userId: string;
  price: number;
  currency: string;
  status: SubscriptionStatus;
  isQueued: boolean;
  note: string | null;
  transactionId: string | null;
  user: { id: string; fullName: string; phone: string };
  plan: { id: string; isActive: boolean } | null;
}

/** GET /subscriptions/me/access (also embedded in /auth/me). */
export interface AccessSummary {
  activeTimePlan: SubscriptionSummary | null;
  queuedTimePlans: SubscriptionSummary[];
  bundles: SubscriptionSummary[];
  bundleAttemptsRemaining: number;
  freeExamAvailable: boolean;
  hasAccess: boolean;
}

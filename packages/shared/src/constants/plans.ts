export const PlanType = {
  FREE_TIER: 'FREE_TIER',
  PRO: 'PRO',
  FAMILY: 'FAMILY',
} as const;

export type PlanType = (typeof PlanType)[keyof typeof PlanType];

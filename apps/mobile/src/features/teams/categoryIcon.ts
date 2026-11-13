import type { TechIconName } from '../../design-system';

/** The eight keys of `teams.category_key` (CHECK in migration 20261113000200). The free-text `category` is display copy only. */
export const TEAM_CATEGORY_KEYS = ['robotics', 'software', 'entrepreneurship', 'science', 'design', 'social_impact', 'media', 'other'] as const;
export type TeamCategoryKey = (typeof TEAM_CATEGORY_KEYS)[number];

export const CATEGORY_LABEL: Record<TeamCategoryKey, string> = {
  robotics: 'Robotik', software: 'Yazılım', entrepreneurship: 'Girişimcilik', science: 'Bilim', design: 'Tasarım', social_impact: 'Sosyal etki', media: 'Medya', other: 'Diğer',
};

const ICON: Record<Exclude<TeamCategoryKey, 'other'>, TechIconName> = {
  robotics: 'robot', software: 'code', entrepreneurship: 'rocket', science: 'leaf', design: 'spark', social_impact: 'community', media: 'play',
};

/**
 * Icon of a team or community, from the structured category only (icon meaning table: the robot glyph is for robotics and nothing else).
 * Free text never picks an icon; a key this build does not know behaves like `other`.
 */
export function categoryIcon(key: TeamCategoryKey | string | null | undefined, kind: 'team' | 'community'): TechIconName {
  const known = (TEAM_CATEGORY_KEYS as readonly string[]).includes(key ?? '') && key !== 'other';
  return known ? ICON[key as Exclude<TeamCategoryKey, 'other'>] : kind === 'team' ? 'team' : 'community';
}

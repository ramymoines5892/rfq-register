/**
 * Central query-key factory. All feature APIs should derive their keys from
 * here to avoid typos and to make invalidation targeted and consistent.
 *
 * Convention:
 *   qk.<domain>.all              → invalidate everything for the domain
 *   qk.<domain>.list(filters?)   → collection reads
 *   qk.<domain>.detail(id)       → single-entity reads
 *   qk.<domain>.byUser(userId)   → user-scoped collections
 */
export const qk = {
  notifications: {
    all: ["notifications"] as const,
    list: (userId: string) => ["notifications", "list", userId] as const,
    prefs: (userId: string) => ["notifications", "prefs", userId] as const,
  },
  customers: {
    all: ["customers"] as const,
    list: (filters?: Record<string, unknown>) =>
      filters ? (["customers", "list", filters] as const) : (["customers", "list"] as const),
    detail: (id: string) => ["customers", "detail", id] as const,
  },
  workflows: {
    all: ["workflows"] as const,
    templates: () => ["workflows", "templates"] as const,
    template: (id: string) => ["workflows", "template", id] as const,
    stages: (templateId: string) => ["workflows", "stages", templateId] as const,
  },
  quotes: {
    all: ["quotes"] as const,
    list: () => ["quotes", "list"] as const,
    detail: (id: string) => ["quotes", "detail", id] as const,
  },
  hr: {
    all: ["hr"] as const,
    profiles: () => ["hr", "profiles"] as const,
    profile: (id: string) => ["hr", "profile", id] as const,
    departments: () => ["hr", "departments"] as const,
    jobTitles: () => ["hr", "job_titles"] as const,
    userRoles: (userId: string) => ["hr", "user_roles", userId] as const,
    userPermissions: (userId: string) => ["hr", "user_permissions", userId] as const,
  },
  settings: {
    all: ["settings"] as const,
    fieldDefinitions: () => ["settings", "field_definitions"] as const,
    fieldOptions: (fieldId: string) => ["settings", "field_options", fieldId] as const,
  },
  trash: {
    all: ["trash"] as const,
    list: (tableKey: string) => ["trash", "list", tableKey] as const,
    ownerCheck: () => ["trash", "owner"] as const,
  },
} as const;

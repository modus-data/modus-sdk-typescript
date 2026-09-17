import type { components } from '../_generated/v1.js'

/** A whole dashboard, including its draft definition and `draftRevision`. */
export type Dashboard = components['schemas']['DashboardDto']
/** Every tile and filter on a dashboard draft, plus the current `draftRevision`. */
export type DashboardElementsList = components['schemas']['DashboardElementsListResponseDto']
/** One tile or filter in a list result. */
export type DashboardElementSummary = components['schemas']['DashboardElementSummaryDto']
/** One element's full draft settings, plus the current `draftRevision`. */
export type DashboardElementResult = components['schemas']['DashboardElementResponseDto']
/** `"chart"`, `"kpi"`, `"table"`, `"markdown"` or `"filter"`. */
export type DashboardElementKind = components['schemas']['DashboardElementKind']
/** Grid position of an element: `x` (0-11), `y`, `w` (1-12) and `h`. */
export type DashboardElementLayout = components['schemas']['DashboardElementLayoutDto']
/** Settings to change on one element; `null` clears a setting that supports clearing. */
export type DashboardElementPatch = components['schemas']['DashboardElementPatchDto']
/** One element and its final grid position for `updateLayout()`. */
export type DashboardLayoutElement = components['schemas']['DashboardLayoutElementDto']
/** Input for `elements(id).create()`. */
export type CreateDashboardElementInput = components['schemas']['CreateDashboardElementDto']
/** Input for `elements(id).update()`. */
export type UpdateDashboardElementInput = components['schemas']['UpdateDashboardElementDto']
/** Input for `updateLayout()`. */
export type UpdateDashboardLayoutInput = components['schemas']['UpdateDashboardLayoutDto']

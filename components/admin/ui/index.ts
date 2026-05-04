// Barrel for admin UI primitives. Import from here, never deep-link to a
// specific file — that way the redesign can shuffle internal layout
// without breaking screens.
export { default as AdminPage } from './AdminPage';
export type { Crumb } from './AdminPage';
export { default as AdminShell, useAdminDrawer } from './AdminShell';
export { default as ConfirmDialog } from './ConfirmDialog';
export { default as DataTable } from './DataTable';
export type { Column } from './DataTable';
export { default as EmptyState } from './EmptyState';
export { default as FilterBar } from './FilterBar';
export type { FilterChip } from './FilterBar';
export { default as SlideOver } from './SlideOver';
export { default as StatCard } from './StatCard';
export { default as StatusBadge } from './StatusBadge';
export { default as Toolbar, ToolbarButton } from './Toolbar';

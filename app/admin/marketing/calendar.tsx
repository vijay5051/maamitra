/**
 * Admin · Marketing calendar.
 *
 * Thin page wrapper around the shared <PublishingCalendar /> component.
 * The same calendar also lives inside the Posts hub at
 * /admin/marketing/posts?tab=calendar — both routes render identical UI.
 */

import { Stack } from 'expo-router';

import { AdminPage } from '../../../components/admin/ui';
import { PublishingCalendar } from '../../../components/marketing/PublishingCalendar';

export default function MarketingCalendarScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Calendar' }} />
      <AdminPage
        title="Publishing calendar"
        description="Approved + scheduled + posted drafts plotted by day. Drag any card to reschedule."
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Marketing', href: '/admin/marketing' },
          { label: 'Calendar' },
        ]}
      >
        <PublishingCalendar />
      </AdminPage>
    </>
  );
}

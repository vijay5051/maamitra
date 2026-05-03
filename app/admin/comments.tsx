/**
 * Admin · Comment moderation.
 *
 * Reads recent comments across BOTH active (communityPosts) and legacy
 * (community_posts) post collections via collectionGroup('comments').
 *
 * Wave 3 rebuild: AdminPage shell, DataTable with bulk-select + bulk delete,
 * SlideOver for full comment text + post link, ConfirmDialog for deletes.
 */
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Spacing } from '../../constants/theme';
import {
  AdminPage,
  Column,
  ConfirmDialog,
  DataTable,
  SlideOver,
  Toolbar,
  ToolbarButton,
} from '../../components/admin/ui';
import { useAuthStore } from '../../store/useAuthStore';
import { useAdminRole } from '../../lib/useAdminRole';
import { can } from '../../lib/admin';
import { AdminComment, deleteComment, listRecentComments } from '../../services/admin';

export default function CommentsScreen() {
  const router = useRouter();
  const { user: actor } = useAuthStore();
  const role = useAdminRole();
  const canModerate = can(role, 'moderate_comments');

  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<AdminComment | null>(null);
  const [confirm, setConfirm] = useState<null | (() => Promise<void>)>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmBody, setConfirmBody] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setComments(await listRecentComments(150));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteOne(c: AdminComment) {
    if (!actor || !canModerate) return;
    setConfirmTitle('Delete comment?');
    setConfirmBody(`By ${c.author}: "${c.text.slice(0, 140)}${c.text.length > 140 ? '…' : ''}"`);
    setConfirm(() => async () => {
      try {
        await deleteComment(actor, c.id, c.postId, c.postCollection);
        setComments((prev) => prev.filter((x) => x.id !== c.id));
        setDetail(null);
      } catch (e: any) {
        setError(e?.message ?? 'Could not delete comment.');
      }
    });
  }

  async function handleBulkDelete() {
    if (!actor || !canModerate) return;
    const ids = Array.from(selected);
    setConfirmTitle(`Delete ${ids.length} comment${ids.length === 1 ? '' : 's'}?`);
    setConfirmBody('This cannot be undone. Each deletion is audit-logged.');
    setConfirm(() => async () => {
      const targets = comments.filter((c) => ids.includes(c.id));
      let succeeded = 0;
      for (const c of targets) {
        try {
          await deleteComment(actor, c.id, c.postId, c.postCollection);
          succeeded++;
        } catch (_) { /* keep going */ }
      }
      setComments((prev) => prev.filter((c) => !ids.includes(c.id)));
      setSelected(new Set());
      if (succeeded < ids.length) {
        setError(`${ids.length - succeeded} of ${ids.length} deletions failed.`);
      }
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return comments;
    return comments.filter((c) =>
      c.text.toLowerCase().includes(q) ||
      c.author.toLowerCase().includes(q),
    );
  }, [comments, search]);

  const columns: Column<AdminComment>[] = [
    {
      key: 'author',
      header: 'Author',
      width: 180,
      render: (c) => (
        <View>
          <Text style={styles.cellPrimary} numberOfLines={1}>{c.author}</Text>
          {c.authorUid ? (
            <Pressable onPress={() => router.push(`/admin/users/${c.authorUid}` as any)}>
              <Text style={styles.cellLink}>open profile →</Text>
            </Pressable>
          ) : null}
        </View>
      ),
      sort: (c) => c.author,
    },
    {
      key: 'text',
      header: 'Comment',
      render: (c) => (
        <Text style={styles.cellBody} numberOfLines={3}>{c.text}</Text>
      ),
    },
    {
      key: 'createdAt',
      header: 'When',
      width: 130,
      align: 'right',
      render: (c) => (
        <Text style={styles.cellMeta}>
          {c.createdAt
            ? new Date(c.createdAt).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })
            : '—'}
        </Text>
      ),
      sort: (c) => c.createdAt ?? '',
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Comments' }} />
      <AdminPage
        title="Comments"
        description="Recent comments across every post. Bulk-select to remove spam in one pass."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Comments' }]}
        headerActions={
          <>
            <ToolbarButton label="Refresh" icon="refresh" onPress={load} />
            {canModerate && selected.size > 0 ? (
              <ToolbarButton
                label={`Delete ${selected.size}`}
                icon="trash-outline"
                variant="danger"
                onPress={handleBulkDelete}
              />
            ) : null}
          </>
        }
        toolbar={
          <Toolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search comment text or author…',
            }}
            leading={<Text style={styles.countText}>{filtered.length} of {comments.length}</Text>}
          />
        }
        error={error}
      >
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(c) => c.id}
          loading={loading}
          selectable={canModerate}
          selected={selected}
          onSelectChange={setSelected}
          onRowPress={(c) => setDetail(c)}
          emptyTitle={search ? 'No comments match' : 'No comments to moderate'}
          emptyBody={search ? 'Try a different search.' : 'When users comment on posts, they appear here.'}
        />
      </AdminPage>

      <SlideOver
        visible={!!detail}
        title={detail?.author ?? ''}
        subtitle={detail?.createdAt ? new Date(detail.createdAt).toLocaleString('en-IN') : undefined}
        onClose={() => setDetail(null)}
        footer={
          <>
            {detail?.authorUid ? (
              <ToolbarButton
                label="Open author"
                icon="person-circle-outline"
                onPress={() => {
                  router.push(`/admin/users/${detail.authorUid}` as any);
                  setDetail(null);
                }}
              />
            ) : null}
            {canModerate && detail ? (
              <ToolbarButton
                label="Delete comment"
                icon="trash-outline"
                variant="danger"
                onPress={() => handleDeleteOne(detail)}
              />
            ) : null}
          </>
        }
      >
        {detail ? (
          <>
            <Text style={styles.detailLabel}>Comment</Text>
            <Text style={styles.detailBody}>{detail.text}</Text>
            <Text style={[styles.detailLabel, { marginTop: Spacing.lg }]}>Post</Text>
            <Text style={styles.detailMeta}>id {detail.postId}</Text>
            <Text style={styles.detailMeta}>collection {detail.postCollection}</Text>
          </>
        ) : null}
      </SlideOver>

      <ConfirmDialog
        visible={!!confirm}
        title={confirmTitle}
        body={confirmBody}
        destructive
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const fn = confirm;
          setConfirm(null);
          if (fn) await fn();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  cellPrimary: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  cellLink: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary, marginTop: 2 },
  cellBody: { fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 19 },
  cellMeta: { fontSize: FontSize.xs, color: Colors.textLight },
  countText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.4 },
  detailLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.5, textTransform: 'uppercase' },
  detailBody: { fontSize: FontSize.md, color: Colors.textDark, lineHeight: 22, marginTop: 6 },
  detailMeta: { fontSize: FontSize.sm, color: Colors.textLight, fontFamily: 'DMMono_400Regular', marginTop: 4 },
});

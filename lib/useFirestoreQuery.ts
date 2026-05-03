// Generic Firestore query hook used across the admin panel.
//
// The pattern in the old admin was: each screen wrote its own getDocs call,
// its own loading state, its own error handling (usually missing), its own
// pagination (usually missing). Every screen reinvented the same five bits
// of glue and got them slightly wrong.
//
// This hook centralises:
//   - subscribe (live) OR fetch-once mode
//   - loading / error state
//   - pagination via startAfter cursor
//   - normalised error -> string for toast/banner display
//   - automatic teardown of onSnapshot subscriptions
//
// Usage:
//   const { data, loading, error, hasMore, loadMore, refetch } =
//     useFirestoreQuery({
//       path: 'communityPosts',
//       constraints: [orderBy('createdAt', 'desc')],
//       pageSize: 25,
//       live: false,
//     });

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  CollectionReference,
  DocumentData,
  getDocs,
  limit,
  onSnapshot,
  query,
  QueryConstraint,
  QueryDocumentSnapshot,
  startAfter,
  Unsubscribe,
} from 'firebase/firestore';

import { db } from '../services/firebase';

export interface UseFirestoreQueryOptions {
  /** Collection path, e.g. 'communityPosts' or 'users/{uid}/notifications/items'. */
  path: string;
  /** Firestore constraints (where / orderBy / limit). `limit` is overridden by pageSize. */
  constraints?: QueryConstraint[];
  /** Page size for paginated mode. Defaults to 25. */
  pageSize?: number;
  /** If true, subscribes via onSnapshot. Otherwise getDocs once. Defaults false. */
  live?: boolean;
  /** Disable the query without unmounting the hook. */
  enabled?: boolean;
}

export interface UseFirestoreQueryResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

function normaliseError(e: unknown): string {
  if (!e) return 'Unknown error';
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

export function useFirestoreQuery<T = DocumentData>(
  options: UseFirestoreQueryOptions,
): UseFirestoreQueryResult<T> {
  const { path, constraints = [], pageSize = 25, live = false, enabled = true } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const unsubRef = useRef<Unsubscribe | null>(null);

  // Memoise the constraints array identity so consumers can pass an inline
  // array without re-running the effect every render. We compare by their
  // serialised forms (Firestore constraints are reference-fragile but their
  // string form is stable enough for this).
  const constraintKey = useMemo(
    () => constraints.map((c) => (c as any)._field?.toString?.() ?? '').join('|'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(constraints)],
  );

  const colRef = useMemo(
    // db is `Firestore | null` at the type level; in practice services/firebase
    // initialises it before any hook can run. The non-null assertion matches
    // the convention used everywhere else in services/*.
    () => collection(db!, path) as CollectionReference<DocumentData>,
    [path],
  );

  const buildQuery = useCallback(
    (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
      const parts: QueryConstraint[] = [...constraints, limit(pageSize)];
      if (cursor) parts.push(startAfter(cursor));
      return query(colRef, ...parts);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [colRef, pageSize, constraintKey],
  );

  const fetchPage = useCallback(
    async (cursor: QueryDocumentSnapshot<DocumentData> | null, append: boolean) => {
      try {
        setError(null);
        if (!append) setLoading(true);
        const snap = await getDocs(buildQuery(cursor));
        const docs = snap.docs;
        const next = docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T));
        setData((prev) => (append ? [...prev, ...next] : next));
        lastDocRef.current = docs[docs.length - 1] ?? null;
        setHasMore(docs.length === pageSize);
      } catch (e) {
        setError(normaliseError(e));
      } finally {
        setLoading(false);
      }
    },
    [buildQuery, pageSize],
  );

  // Initial fetch / live subscription.
  useEffect(() => {
    if (!enabled) return;
    if (live) {
      setLoading(true);
      setError(null);
      try {
        unsubRef.current = onSnapshot(
          buildQuery(null),
          (snap) => {
            const next = snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T));
            setData(next);
            lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
            setHasMore(snap.docs.length === pageSize);
            setLoading(false);
          },
          (e) => {
            setError(normaliseError(e));
            setLoading(false);
          },
        );
      } catch (e) {
        setError(normaliseError(e));
        setLoading(false);
      }
      return () => {
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }
      };
    }
    // one-shot mode
    fetchPage(null, false);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, live, buildQuery]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || live) return;
    await fetchPage(lastDocRef.current, true);
  }, [fetchPage, hasMore, loading, live]);

  const refetch = useCallback(async () => {
    lastDocRef.current = null;
    setHasMore(true);
    await fetchPage(null, false);
  }, [fetchPage]);

  return { data, loading, error, hasMore, loadMore, refetch };
}

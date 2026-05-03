import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '../../../constants/theme';

import EmptyState from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  /** Pixel width on web. On mobile this is ignored and rows wrap. */
  width?: number;
  /** Render a cell. Defaults to row[key] as string. */
  render?: (row: T) => React.ReactNode;
  /** Pluck a sortable scalar from a row. If omitted, column isn't sortable. */
  sort?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRowPress?: (row: T) => void;
  /** Show checkbox column for bulk select. */
  selectable?: boolean;
  selected?: Set<string>;
  onSelectChange?: (next: Set<string>) => void;
  /** Empty-state copy when rows.length === 0 and not loading. */
  emptyTitle?: string;
  emptyBody?: string;
  /** Footer slot (used for "Load more" button). */
  footer?: React.ReactNode;
  style?: ViewStyle;
}

type SortDir = 'asc' | 'desc';

export default function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  error,
  onRowPress,
  selectable,
  selected,
  onSelectChange,
  emptyTitle = 'Nothing to show',
  emptyBody,
  footer,
  style,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sort) return rows;
    const out = [...rows].sort((a, b) => {
      const av = col.sort!(a);
      const bv = col.sort!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    if (sortDir === 'desc') out.reverse();
    return out;
  }, [rows, sortKey, sortDir, columns]);

  function toggleSort(col: Column<T>) {
    if (!col.sort) return;
    if (sortKey === col.key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(col.key); setSortDir('desc'); }
  }

  const allSelected =
    selectable && rows.length > 0 && selected && rows.every((r) => selected.has(rowKey(r)));

  function toggleAll() {
    if (!onSelectChange) return;
    if (allSelected) onSelectChange(new Set());
    else onSelectChange(new Set(rows.map(rowKey)));
  }

  function toggleOne(id: string) {
    if (!onSelectChange) return;
    const next = new Set(selected ?? []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectChange(next);
  }

  if (error) {
    return <EmptyState kind="error" title="Couldn't load data" body={error} />;
  }
  if (loading && rows.length === 0) {
    return <EmptyState kind="loading" title="Loading…" />;
  }
  if (!loading && rows.length === 0) {
    return <EmptyState kind="empty" title={emptyTitle} body={emptyBody} />;
  }

  return (
    <View style={[styles.wrap, style]}>
      <ScrollView horizontal>
        <View>
          <View style={styles.headerRow}>
            {selectable ? (
              <Pressable style={styles.checkCell} onPress={toggleAll} hitSlop={6}>
                <View style={[styles.checkbox, allSelected && styles.checkboxOn]}>
                  {allSelected ? <Ionicons name="checkmark" size={12} color={Colors.white} /> : null}
                </View>
              </Pressable>
            ) : null}
            {columns.map((c) => (
              <Pressable
                key={c.key}
                style={[
                  styles.headerCell,
                  c.width ? { width: c.width } : { flex: 1, minWidth: 120 },
                  c.align === 'right' && styles.alignRight,
                  c.align === 'center' && styles.alignCenter,
                ]}
                onPress={() => toggleSort(c)}
                disabled={!c.sort}
              >
                <Text style={styles.headerText} numberOfLines={1}>
                  {c.header}
                </Text>
                {c.sort ? (
                  <Ionicons
                    name={sortKey === c.key
                      ? (sortDir === 'asc' ? 'arrow-up' : 'arrow-down')
                      : 'swap-vertical'}
                    size={12}
                    color={sortKey === c.key ? Colors.primary : Colors.textMuted}
                    style={{ marginLeft: 4 }}
                  />
                ) : null}
              </Pressable>
            ))}
          </View>
          {sorted.map((row) => {
            const id = rowKey(row);
            const isSel = selected?.has(id) ?? false;
            const Wrapper: any = onRowPress ? Pressable : View;
            return (
              <Wrapper
                key={id}
                onPress={onRowPress ? () => onRowPress(row) : undefined}
                style={[styles.row, isSel && styles.rowSelected]}
              >
                {selectable ? (
                  <Pressable style={styles.checkCell} onPress={() => toggleOne(id)} hitSlop={6}>
                    <View style={[styles.checkbox, isSel && styles.checkboxOn]}>
                      {isSel ? <Ionicons name="checkmark" size={12} color={Colors.white} /> : null}
                    </View>
                  </Pressable>
                ) : null}
                {columns.map((c) => {
                  const v = c.render
                    ? c.render(row)
                    : <Text style={styles.cellText} numberOfLines={2}>{String((row as any)[c.key] ?? '')}</Text>;
                  return (
                    <View
                      key={c.key}
                      style={[
                        styles.cell,
                        c.width ? { width: c.width } : { flex: 1, minWidth: 120 },
                        c.align === 'right' && styles.alignRight,
                        c.align === 'center' && styles.alignCenter,
                      ]}
                    >
                      {v}
                    </View>
                  );
                })}
              </Wrapper>
            );
          })}
        </View>
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgLight,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  headerCell: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  headerText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.5, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
    backgroundColor: Colors.cardBg,
  },
  rowSelected: { backgroundColor: Colors.primarySoft },
  cell: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    justifyContent: 'center',
  },
  cellText: { fontSize: FontSize.sm, color: Colors.textDark },
  checkCell: {
    width: 44, alignItems: 'center', justifyContent: 'center',
  },
  checkbox: {
    width: 18, height: 18, borderRadius: 5,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.cardBg,
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  alignRight: { justifyContent: 'flex-end' },
  alignCenter: { justifyContent: 'center' },
  footer: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderSoft,
    backgroundColor: Colors.bgLight,
  },
});

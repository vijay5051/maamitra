import { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INDIAN_STATES } from '../../data/states';
import {
  Colors,
  Fonts,
  FontSize,
  Radius,
  Spacing,
  withAlpha,
} from '../../constants/theme';

interface StateSelectorProps {
  onSelect: (state: string) => void;
  selected?: string;
}

/**
 * State picker rendered as a collapsible field.
 *
 * Closed (default once a state is picked): looks like a single-line text
 * field with the chosen state and a chevron-down. Tapping opens the search +
 * list. After picking a state, the list collapses again so the user has
 * clear feedback that their selection was captured.
 *
 * The list is rendered as a plain View.map (not FlatList) so the parent
 * ScrollView in onboarding owns scrolling — nesting a vertical FlatList
 * inside a vertical ScrollView is broken on Android.
 */
export default function StateSelector({ onSelect, selected }: StateSelectorProps) {
  const [open, setOpen] = useState(!selected);
  const [query, setQuery] = useState('');

  // If the parent clears the selection (e.g. on profile reset), reopen.
  useEffect(() => {
    if (!selected) setOpen(true);
  }, [selected]);

  const filtered = useMemo(() => {
    if (!query.trim()) return INDIAN_STATES;
    const q = query.toLowerCase();
    return INDIAN_STATES.filter((s) => s.toLowerCase().includes(q));
  }, [query]);

  const pick = (state: string) => {
    onSelect(state);
    setQuery('');
    setOpen(false);
  };

  // Collapsed: show the selected state with an "Edit" chevron.
  if (!open && selected) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.selectedField}
          onPress={() => setOpen(true)}
          accessibilityLabel="Change state"
          accessibilityRole="button"
        >
          <Ionicons name="location-outline" size={18} color={Colors.primary} style={styles.searchIcon} />
          <Text style={styles.selectedFieldText} numberOfLines={1}>
            {selected}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search state…"
          placeholderTextColor={Colors.textMuted}
          autoFocus={!!selected}
          accessibilityLabel="Search states"
        />
        {query.length > 0 ? (
          <TouchableOpacity
            onPress={() => setQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Clear search"
            accessibilityRole="button"
          >
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : selected ? (
          // Already picked — let the user collapse without changing anything.
          <TouchableOpacity
            onPress={() => setOpen(false)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Collapse state picker"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-up" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.listArea}>
        {filtered.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>No states match "{query}"</Text>
          </View>
        ) : (
          filtered.map((item, idx) => {
            const isSelected = selected === item;
            const isLast = idx === filtered.length - 1;
            return (
              <TouchableOpacity
                key={item}
                onPress={() => pick(item)}
                activeOpacity={0.7}
                accessibilityLabel={`Select ${item}`}
                accessibilityRole="button"
                style={[
                  styles.stateRow,
                  isLast && styles.stateRowLast,
                  isSelected && styles.stateRowSelected,
                ]}
              >
                <Text style={[styles.stateText, isSelected && styles.stateTextSelected]}>
                  {item}
                </Text>
                {isSelected ? (
                  <Ionicons name="checkmark" size={18} color={Colors.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  selectedField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  selectedFieldText: {
    flex: 1,
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.md,
    color: Colors.textDark,
    marginLeft: Spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgTint,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: withAlpha(Colors.textDark, 0.09),
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.sm,
    color: Colors.textDark,
  },
  listArea: {
    borderRadius: Radius.sm,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    overflow: 'hidden',
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md + 1,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
    minHeight: 44,
  },
  stateRowLast: {
    borderBottomWidth: 0,
  },
  stateRowSelected: {
    backgroundColor: Colors.bgTint,
  },
  stateText: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.md,
    color: Colors.textDark,
  },
  stateTextSelected: {
    fontFamily: Fonts.sansBold,
    color: Colors.primary,
  },
  emptyRow: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});

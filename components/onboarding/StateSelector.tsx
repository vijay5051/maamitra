import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INDIAN_STATES } from '../../data/states';
import { Colors } from '../../constants/theme';

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
    return INDIAN_STATES.filter((s) =>
      s.toLowerCase().includes(query.toLowerCase())
    );
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
        >
          <Ionicons name="location-outline" size={18} color={Colors.primary} style={styles.searchIcon} />
          <Text style={styles.selectedFieldText} numberOfLines={1}>
            {selected}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#9ca3af" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search state…"
          placeholderTextColor="#9ca3af"
          autoFocus={!!selected}
        />
        {query.length > 0 ? (
          <TouchableOpacity
            onPress={() => setQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color="#9ca3af" />
          </TouchableOpacity>
        ) : selected ? (
          // Already picked — let the user collapse without changing anything.
          <TouchableOpacity
            onPress={() => setOpen(false)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-up" size={16} color="#9ca3af" />
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
                  <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
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
    gap: 12,
  },
  selectedField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 48,
  },
  selectedFieldText: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a2e',
    fontWeight: '600',
    marginLeft: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf6ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(28, 16, 51, 0.09)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a2e',
  },
  listArea: {
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f3e8ff',
    overflow: 'hidden',
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    minHeight: 44,
  },
  stateRowLast: {
    borderBottomWidth: 0,
  },
  stateRowSelected: {
    backgroundColor: '#F5F0FF',
  },
  stateText: {
    fontSize: 15,
    color: '#1a1a2e',
    fontWeight: '500',
    flex: 1,
  },
  stateTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  emptyRow: {
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#9ca3af',
  },
});

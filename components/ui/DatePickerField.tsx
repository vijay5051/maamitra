import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DatePickerFieldProps {
  value: string; // ISO date string YYYY-MM-DD, or ''
  onChange: (isoDate: string) => void; // Returns YYYY-MM-DD
  placeholder?: string;
  label?: string;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
}

/**
 * Cross-platform date picker field.
 * On web: renders a native <input type="date"> which shows the OS date picker on mobile Safari.
 * On native: shows a simple text input (for future native picker enhancement).
 */
export default function DatePickerField({
  value,
  onChange,
  placeholder = 'Select date',
  label,
  minDate,
  maxDate,
}: DatePickerFieldProps) {
  // Format YYYY-MM-DD → human-readable "12 Sep 2025"
  const displayValue = React.useMemo(() => {
    if (!value) return '';
    const d = new Date(value + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }, [value]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrapper}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={styles.inputRow}>
          <Ionicons name="calendar-outline" size={20} color="#8b5cf6" style={styles.icon} />
          <Text style={[styles.displayText, !value && styles.placeholder]}>
            {displayValue || placeholder}
          </Text>
          {/* Hidden native date input overlaid on top — captures taps & shows native picker */}
          <TextInput
            // @ts-ignore — web-only prop
            type="date"
            value={value}
            min={minDate}
            max={maxDate}
            onChange={(e: any) => {
              const raw = e?.target?.value ?? e?.nativeEvent?.text ?? '';
              onChange(raw);
            }}
            style={styles.nativeDateInput as any}
          />
        </View>
      </View>
    );
  }

  // Native fallback — simple text input
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <Ionicons name="calendar-outline" size={20} color="#8b5cf6" style={styles.icon} />
        <TextInput
          style={styles.nativeInput}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          keyboardType="default"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'relative',
  },
  icon: {
    marginRight: 10,
  },
  displayText: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a2e',
    fontWeight: '500',
  },
  placeholder: {
    color: '#9ca3af',
    fontWeight: '400',
  },
  // Overlay the native <input type="date"> over the styled row
  nativeDateInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
    width: '100%',
    height: '100%',
    minHeight: 44,
    cursor: 'pointer',
    touchAction: 'manipulation',
    zIndex: 1,
  } as any,
  nativeInput: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a2e',
  },
});

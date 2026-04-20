import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Colors, Fonts, Gradients } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

// ─── Tab icon with subtle scale animation on focus ──────────────
function TabIcon({
  name,
  focused,
  label,
}: {
  name: string;
  focused: boolean;
  label: string;
}) {
  const scale = useSharedValue(focused ? 1.15 : 1.0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 0.9, SPRING_CONFIG);
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.tabWrap}>
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={name as any}
          size={22}
          color={focused ? Colors.primary : '#9ca3af'}
        />
      </Animated.View>
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? Colors.primary : '#9ca3af' },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Center FAB that opens Chat ─────────────────────────────────
// Used as the custom tabBarButton for the chat screen. Sits on the
// center slot of the bar and visually lifts above it so the AI feels
// like the hero action everywhere.
function AskFab({ focused, onPress }: { focused: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.fabWrap}
    >
      <View style={styles.fabLift}>
        <LinearGradient colors={Gradients.primary} style={styles.fabGrad}>
          <Ionicons name="sparkles" size={26} color="#fff" />
        </LinearGradient>
        <Text
          style={[
            styles.fabLabel,
            { color: focused ? Colors.primary : Colors.textDark },
          ]}
        >
          Ask
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  const { onboardingComplete } = useProfileStore();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/(auth)/welcome');
      return;
    }
    if (!onboardingComplete) {
      router.replace('/(auth)/onboarding');
      return;
    }
  }, [isLoading, isAuthenticated, onboardingComplete]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1C1033', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated || !onboardingComplete) {
    return <View style={{ flex: 1, backgroundColor: '#1C1033' }} />;
  }

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.98)',
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          // Extra height so the lifted Ask FAB has room to sit above.
          height: Platform.OS === 'ios' ? 84 : 74,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          paddingTop: 8,
          // Neutral subtle lift — was a pink shadow.
          shadowColor: '#1C1033',
          shadowOpacity: 0.05,
          shadowRadius: 14,
          elevation: 10,
          boxShadow: '0px -2px 14px rgba(28, 16, 51, 0.05)',
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#9ca3af',
        tabBarShowLabel: false,
      }}
    >
      {/* ─── 4 visible tabs + center FAB (5 slots total) ─── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'home' : 'home-outline'}
              focused={focused}
              label="Home"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: 'Health',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'medkit' : 'medkit-outline'}
              focused={focused}
              label="Health"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Ask',
          tabBarButton: (props) => (
            <AskFab
              focused={!!props.accessibilityState?.selected}
              onPress={props.onPress as any}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'heart-circle' : 'heart-circle-outline'}
              focused={focused}
              label="Community"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wellness"
        options={{
          title: 'Wellness',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'leaf' : 'leaf-outline'}
              focused={focused}
              label="Wellness"
            />
          ),
        }}
      />

      {/* ─── Hidden from tab bar, still routable via deep link + Profile sheet ─── */}
      {/* Family moved into the Profile sheet (see Home → avatar → "Your family"). */}
      <Tabs.Screen name="family" options={{ href: null }} />
      <Tabs.Screen name="library" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 40,
    paddingTop: 4,
  },
  tabLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.2,
    marginTop: 2,
  },

  // Center FAB — lifted above the tab bar line for emphasis.
  fabWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  fabLift: {
    alignItems: 'center',
    // Lift above the bar — visually sits half-above the top border.
    marginTop: -18,
    gap: 2,
  },
  fabGrad: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    // Neutral soft lift — was a glowing pink shadow.
    shadowColor: '#1C1033',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
    boxShadow: '0px 6px 16px rgba(28, 16, 51, 0.18)',
  },
  fabLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    marginTop: 2,
  },
});

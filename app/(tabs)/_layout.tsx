import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Fonts } from '../../constants/theme';

const SPRING_CONFIG = { damping: 12, stiffness: 180 };

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
          size={24}
          color={focused ? '#E8487A' : '#C4B5D4'}
        />
      </Animated.View>
      {focused && <View style={styles.activeDot} />}
      {focused && (
        <Text style={styles.tabLabel}>{label}</Text>
      )}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(255,248,252,0.96)',
          borderTopWidth: 1,
          borderTopColor: '#EDE9F6',
          height: 68,
          paddingBottom: 10,
          paddingTop: 6,
          shadowColor: '#E8487A',
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 12,
          boxShadow: '0px -2px 16px rgba(232, 72, 122, 0.08)',
        },
        tabBarActiveTintColor: '#E8487A',
        tabBarInactiveTintColor: '#C4B5D4',
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'chatbubble' : 'chatbubble-outline'}
              focused={focused}
              label="Chat"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Family',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'people' : 'people-outline'}
              focused={focused}
              label="Family"
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
              name={focused ? 'medical' : 'medical-outline'}
              focused={focused}
              label="Health"
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
      <Tabs.Screen
        name="community"
        options={{
          title: 'Connect',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'heart-circle' : 'heart-circle-outline'}
              focused={focused}
              label="Connect"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'library' : 'library-outline'}
              focused={focused}
              label="Library"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabWrap: {
    alignItems: 'center',
    gap: 3,
    minHeight: 30,
  },
  activeDot: {
    width: 4,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E8487A',
  },
  tabLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    color: '#E8487A',
    marginTop: 1,
    letterSpacing: 0.2,
  },
});

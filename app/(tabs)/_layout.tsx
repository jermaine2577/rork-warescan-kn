import { Tabs } from "expo-router";
import { Package, Settings, LogOut, MapPin } from "lucide-react-native";
import React from "react";
import { BRAND_COLORS } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const { hasPrivilege } = useAuth();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRAND_COLORS.primary,
        headerShown: false,
        tabBarStyle: {
          display: 'none',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600' as const,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "St. Kitts Receiving",
          tabBarIcon: ({ color }) => <Package size={24} color={color} />,
          href: hasPrivilege('receiving') ? '/' : null,
        }}
      />
      <Tabs.Screen
        name="release"
        options={{
          title: "St. Kitts Releasing",
          tabBarIcon: ({ color }) => <LogOut size={24} color={color} />,
          href: hasPrivilege('releasing') ? '/release' : null,
        }}
      />
      <Tabs.Screen
        name="nevis-receiving"
        options={{
          title: "Nevis Receiving",
          tabBarIcon: ({ color }) => <MapPin size={24} color={color} />,
          href: hasPrivilege('nevisReceiving') ? '/nevis-receiving' : null,
        }}
      />
      <Tabs.Screen
        name="nevis-releasing"
        options={{
          title: "Nevis Releasing",
          tabBarIcon: ({ color }) => <MapPin size={24} color={color} />,
          href: hasPrivilege('nevisReleasing') ? '/nevis-releasing' : null,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: "Tools",
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

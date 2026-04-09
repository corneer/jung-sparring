import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: "#0a0a0a", borderTopColor: "#222" },
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: "#555",
        headerStyle: { backgroundColor: "#0a0a0a" },
        headerTintColor: "#ffffff",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Klienter", tabBarLabel: "Klienter" }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: "Historik", tabBarLabel: "Historik" }}
      />
    </Tabs>
  );
}

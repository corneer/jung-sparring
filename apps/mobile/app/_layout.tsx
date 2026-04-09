import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0a0a0a" },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: "#0a0a0a" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="clients/new" options={{ title: "Ny klient", presentation: "modal" }} />
        <Stack.Screen name="clients/[id]/edit" options={{ title: "Redigera klient", presentation: "modal" }} />
        <Stack.Screen name="runs/new" options={{ title: "Ny körning", presentation: "modal" }} />
        <Stack.Screen name="runs/[runId]" options={{ title: "Körning" }} />
      </Stack>
    </>
  );
}

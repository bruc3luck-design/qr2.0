import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import * as SplashScreen from "expo-splash-screen";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { AppTheme } from "../constants/theme";
import { supabase } from "../lib/supabase";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function Layout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(AppTheme.colors.background).catch(() => undefined);

    const handleAppStateChange = (state: string) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
        return;
      }

      supabase.auth.stopAutoRefresh();
    };

    handleAppStateChange(AppState.currentState);
    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar
        style="dark"
        hidden={false}
        translucent={false}
        backgroundColor={AppTheme.colors.background}
      />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

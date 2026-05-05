import { createClient } from "@supabase/supabase-js"
import { Platform } from "react-native"

const supabaseUrl = "https://xarntfqxllizuehumayh.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhcm50ZnF4bGxpenVlaHVtYXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MTgwOTAsImV4cCI6MjA4NzM5NDA5MH0.G4EIFSA4Gw9C6nfVrxipC_-e2qUWHRtG2CvZDzILnF0"

const authOptions: any = {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
}

if (Platform.OS !== "web") {
  const AsyncStorage = require("@react-native-async-storage/async-storage").default
  authOptions.storage = AsyncStorage
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: authOptions,
})
  
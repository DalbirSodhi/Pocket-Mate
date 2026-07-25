const requiredEnv = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

function assertEnvValue(name, value) {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

export function getSupabaseEnv() {
  assertEnvValue('EXPO_PUBLIC_SUPABASE_URL', requiredEnv.supabaseUrl);
  assertEnvValue('EXPO_PUBLIC_SUPABASE_ANON_KEY', requiredEnv.supabaseAnonKey);

  return requiredEnv;
}

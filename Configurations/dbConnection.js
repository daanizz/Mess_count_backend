import { createClient } from "@supabase/supabase-js";

// from your Supabase project settings → API
const SUPABASE_URL = "https://ddewkohumlqxyzdkpfyg.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_KEY;

// create client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;

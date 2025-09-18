import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// from your Supabase project settings → API
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_KEY;

// create client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;

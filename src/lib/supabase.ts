import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) throw new Error("SUPABASE_URL environment variable is not set");
if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_KEY environment variable is not set");

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

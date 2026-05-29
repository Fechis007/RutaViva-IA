import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Inicializamos el cliente de Supabase listo para usarse en toda la app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
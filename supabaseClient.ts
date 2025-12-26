import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://llgaijmjquoargmkywmg.supabase.co';
// Note: In a production app, use environment variables. 
// Using the key provided by the user.
const supabaseKey = 'sb_publishable_Gk4caevMf_Ld5pSQ2QrwPQ_0ewqQbBl';

export const supabase = createClient(supabaseUrl, supabaseKey);
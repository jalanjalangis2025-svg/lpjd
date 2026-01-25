const SUPABASE_URL = 'https://azsyumglszxnxgewumkc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6c3l1bWdsc3p4bnhnZXd1bWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMzk4NzksImV4cCI6MjA4NDgxNTg3OX0.Mt28kbwJyzYTIowbn5-6JoaKQOy4qzsD-OwxttPX9M8';


if (!window.sb) {
  window.sb = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );
}
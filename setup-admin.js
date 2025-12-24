// setup-admin.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.0/+esm";

const supabaseUrl = "https://your-project-id.supabase.co";
const supabaseServiceKey = "your-service-role-key"; // Dapatkan dari Supabase Settings > API

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupFirstAdmin() {
  try {
    // 1. Buat user di auth
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: "admin@jalanrusak.id",
        password: "Admin123!", // Password kuat
        email_confirm: true,
        user_metadata: {
          full_name: "Administrator",
          role: "super_admin",
        },
      });

    if (authError) throw authError;

    console.log("✅ User auth created:", authData.user.email);

    // 2. Buat profile di admin_profiles
    const { error: profileError } = await supabase
      .from("admin_profiles")
      .insert([
        {
          id: authData.user.id,
          email: authData.user.email,
          full_name: "Administrator",
          role: "super_admin",
        },
      ]);

    if (profileError) throw profileError;

    console.log("✅ Admin profile created");
    console.log("🎉 Setup completed!");
    console.log("Email: admin@jalanrusak.id");
    console.log("Password: Admin123!");
  } catch (error) {
    console.error("❌ Setup error:", error.message);
  }
}

// Jalankan setup
setupFirstAdmin();

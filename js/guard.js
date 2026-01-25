(async () => {
  // pastikan client ada
  if (!window.sb || !sb.auth) {
    alert("Supabase client belum siap");
    return;
  }

  const { data } = await sb.auth.getSession();

  if (!data.session) {
    location.replace("/login");
    return;
  }

  // Show the page content now that user is authenticated
  document.body.style.display = "block";

  const emailEl = document.getElementById("userEmail");
  if (emailEl) {
    emailEl.innerText = data.session.user.email;
  }
})();

async function logout() {
  if (!window.sb || !sb.auth) return;

  await sb.auth.signOut();
  location.replace("/login");
}

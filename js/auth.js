async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const loginCard = document.querySelector('.login-card') || document.body;

  // Show Loader
  let loader = document.querySelector('.page-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.className = 'page-loader';
    loader.innerHTML = '<div class="spinner"></div><div class="loader-text">Memproses...</div>';
    document.body.appendChild(loader);
  }
  
  // Force reflow
  loader.offsetHeight; 
  loader.classList.add('active');

  const { error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    // Hide Loader
    loader.classList.remove('active');
    setTimeout(() => {
        if(document.querySelector('.page-loader')) document.querySelector('.page-loader').remove();
    }, 300);

    // Shake Effect on Card
    loginCard.classList.add('shake');
    setTimeout(() => loginCard.classList.remove('shake'), 500);
    
    alert("Login Gagal: " + error.message);
  } else {
    // Success - Keep loader and redirect
    document.querySelector('.loader-text').innerText = "Berhasil Masuk!";
    setTimeout(() => {
        location.replace("/home");
    }, 800);
  }
}

(async () => {
  // Tunggu sb siap (kalau synchronous di supabase.js harusnya aman, tapi check null just in case)
  if (!window.sb || !sb.auth) return;

  const { data } = await sb.auth.getSession();
  if (data.session) {
    location.replace("/home");
  } else {
    // Show page if not logged in
    document.body.style.opacity = '1';
  }
})();

/**
 * =======================================================
 *  AUTH (khusus halaman input.html)
 *  Login pakai Firebase Authentication (Email/Password).
 *  Cara buat akun admin: Firebase Console > Authentication
 *  > Sign-in method > aktifkan "Email/Password" >
 *  tab Users > Add user (isi email & password kamu sendiri).
 * =======================================================
 */
const Auth = {
  init() {
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.login();
    });
    document.getElementById('btnLogout').addEventListener('click', () => this.logout());

    auth.onAuthStateChanged((user) => {
      const loginPanel = document.getElementById('loginPanel');
      const inputPanel = document.getElementById('inputPanel');
      if (user) {
        loginPanel.style.display = 'none';
        inputPanel.style.display = 'block';
        document.getElementById('loggedInAs').textContent = user.email;
        if (window.InputApp) InputApp.init();
      } else {
        loginPanel.style.display = 'flex';
        inputPanel.style.display = 'none';
      }
    });
  },

  async login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorBox = document.getElementById('loginError');
    errorBox.textContent = '';

    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      errorBox.textContent = 'Login gagal: email atau password salah.';
      console.error(err);
    }
  },

  logout() {
    auth.signOut();
  }
};

document.addEventListener('DOMContentLoaded', () => Auth.init());

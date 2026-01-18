// Optional base URL for API (set `window.API_BASE` if API is on a different origin)
const API_BASE = window.API_BASE || '';

async function apiPost(path, data){
  const token = localStorage.getItem('aviva_token');
  const headers = {'Content-Type':'application/json'};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, {method:'POST', headers, body: JSON.stringify(data)});
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}
async function apiGet(path){
  const token = localStorage.getItem('aviva_token');
  const headers = {'Content-Type':'application/json'};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, {method:'GET', headers});
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// Attach basic handlers for forms
document.addEventListener('DOMContentLoaded', ()=>{
  const loginForm = document.getElementById('loginForm');
  if (loginForm){
    loginForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(loginForm);
      const data = {email: fd.get('email'), password: fd.get('password')};
      try {
        const r = await apiPost('/api/login', data);
        console.log('Login response:', r);
        if (r.ok && r.token) {
          localStorage.setItem('aviva_token', r.token);
          location.href = '/dashboard.html';
        } else alert(r.error || 'Login failed');
      } catch (err) {
        console.error('Login error:', err);
        alert('Error: ' + err.message);
      }
    });
  }

  const registerForm = document.getElementById('registerForm');
  if (registerForm){
    registerForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(registerForm);
      const data = {name: fd.get('name'), email: fd.get('email'), password: fd.get('password')};
      try {
        const r = await apiPost('/api/register', data);
        console.log('Register response:', r);
        if (r.ok && r.token) {
          localStorage.setItem('aviva_token', r.token);
          location.href = '/dashboard.html';
        } else alert(r.error || 'Registration failed');
      } catch (err) {
        console.error('Register error:', err);
        alert('Error: ' + err.message);
      }
    });
  }
});

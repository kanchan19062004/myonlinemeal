const forms = {
  login: document.getElementById('login-form'),
  register: document.getElementById('register-form'),
};
const authStatus = document.getElementById('auth-status');

// Only allow redirects to our own pages, e.g. ?next=cart.html
const nextParam = new URLSearchParams(location.search).get('next');
const nextPage = /^[a-z]+\.html$/.test(nextParam || '') ? nextParam : 'menu.html';

if (Auth.user) location.replace(nextPage);

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    Object.entries(forms).forEach(([name, form]) => form.classList.toggle('hidden', name !== tab.dataset.tab));
    authStatus.className = 'form-status';
  });
});

function submitHandler(endpoint, label) {
  return async (e) => {
    e.preventDefault();
    const form = e.target;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Please wait...';

    try {
      const { token, user } = await api(endpoint, { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      Auth.save(token, user);
      location.href = nextPage;
    } catch (err) {
      authStatus.textContent = err.message;
      authStatus.className = 'form-status show error';
      button.disabled = false;
      button.textContent = label;
    }
  };
}

forms.login.addEventListener('submit', submitHandler('/api/auth/login', 'Login'));
forms.register.addEventListener('submit', submitHandler('/api/auth/register', 'Create Account'));

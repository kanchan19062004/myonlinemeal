// Shared helpers used by every page: API calls, auth, cart, header/footer, toast.

const MAX_QTY = 50;

const Auth = {
  get token() { return localStorage.getItem('token'); },
  get user() {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  },
  save(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (Auth.token) headers.Authorization = `Bearer ${Auth.token}`;

  let res;
  try {
    res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. Is it running? (npm start)');
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && Auth.token) Auth.clear();
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong.');
    err.status = res.status;
    throw err;
  }
  return data;
}

// Cart is stored in localStorage as { [foodId]: quantity }.
const Cart = {
  get() {
    try { return JSON.parse(localStorage.getItem('cart')) || {}; } catch { return {}; }
  },
  save(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount(true);
  },
  add(foodId, qty) {
    const cart = this.get();
    cart[foodId] = Math.min((cart[foodId] || 0) + qty, MAX_QTY);
    this.save(cart);
    return cart[foodId];
  },
  setQty(foodId, qty) {
    const cart = this.get();
    if (qty <= 0) delete cart[foodId];
    else cart[foodId] = Math.min(qty, MAX_QTY);
    this.save(cart);
  },
  remove(foodId) { this.setQty(foodId, 0); },
  clear() { this.save({}); },
  count() { return Object.values(this.get()).reduce((a, b) => a + b, 0); },
};

const formatPrice = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const clampQty = (n) => Math.max(1, Math.min(MAX_QTY, parseInt(n, 10) || 1));

let toastTimer;
function toast(message, type = 'info') {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.toggle('error', type === 'error');
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function updateCartCount(animate = false) {
  const el = document.querySelector('.cart-count');
  if (!el) return;
  el.textContent = Cart.count();
  if (animate) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
}

const ICONS = {
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>',
};

function renderHeader() {
  const page = document.body.dataset.page;
  const user = Auth.user;
  const link = (href, label, key) =>
    `<li><a href="${href}" class="${page === key ? 'active' : ''}">${label}</a></li>`;

  const authLinks = user
    ? `${link('orders.html', 'My Orders', 'orders')}
       <li><button type="button" id="logout-btn">Logout (${escapeHtml(user.name.split(' ')[0])})</button></li>`
    : `<li><a href="login.html" class="nav-login">Login</a></li>`;

  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <nav class="navbar container">
      <a class="brand" href="index.html"><img src="images/logo.jpg" alt="MyOnlineMeal logo"><span>MyOnline<b>Meal</b></span></a>
      <ul class="nav-links" id="nav-links">
        ${link('index.html#home', 'Home', 'home')}
        ${link('index.html#services', 'Services')}
        ${link('menu.html', 'Menu', 'menu')}
        ${link('index.html#clients', 'Our Clients')}
        ${link('index.html#contact', 'Contact Us')}
        ${authLinks}
      </ul>
      <a class="cart-btn" href="cart.html" aria-label="View cart">${ICONS.cart}<span class="cart-count">0</span></a>
      <button class="nav-toggle" type="button" aria-label="Toggle menu" aria-expanded="false" aria-controls="nav-links">
        <span></span><span></span><span></span>
      </button>
    </nav>`;
  document.body.prepend(header);

  const toggle = header.querySelector('.nav-toggle');
  const links = header.querySelector('.nav-links');
  const setOpen = (open) => {
    links.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!links.classList.contains('open')));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });

  header.querySelector('#logout-btn')?.addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* already logged out */ }
    Auth.clear();
    location.href = 'index.html';
  });

  updateCartCount();
}

function renderFooter() {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="container footer-grid">
      <div>
        <a class="brand" href="index.html"><img src="images/logo.jpg" alt=""><span>MyOnline<b>Meal</b></span></a>
        <p>Fresh, healthy and hygienically prepared pure vegetarian meals delivered to your doorstep. Good food, good health, every day.</p>
      </div>
      <div>
        <h4>Quick Links</h4>
        <ul>
          <li><a href="index.html#home">Home</a></li>
          <li><a href="menu.html">Our Menu</a></li>
          <li><a href="cart.html">Cart</a></li>
          <li><a href="index.html#contact">Contact Us</a></li>
        </ul>
      </div>
      <div>
        <h4>Opening Hours</h4>
        <ul>
          <li>Mon – Fri: 9:00 AM – 11:00 PM</li>
          <li>Sat – Sun: 10:00 AM – 12:00 AM</li>
          <li>support@myonlinemeal.com</li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      &copy; ${new Date().getFullYear()} www.myonlinemeal.com &middot; All rights reserved
    </div>`;
  document.body.appendChild(footer);
}

renderHeader();
renderFooter();
window.addEventListener('storage', () => updateCartCount());

const root = document.getElementById('cart-root');
let foodsById = new Map();

const CART_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>';
const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

// Cart entries joined with current food data from the DB; unknown/unavailable foods are dropped.
function cartLines() {
  const cart = Cart.get();
  const lines = [];
  for (const [id, qty] of Object.entries(cart)) {
    const food = foodsById.get(Number(id));
    if (food) lines.push({ food, qty, total: food.price * qty });
  }
  return lines;
}

function renderEmpty() {
  root.innerHTML = `
    <div class="panel empty-state">
      ${CART_ICON}
      <h2>Your cart is empty</h2>
      <p>Looks like you haven't added anything yet. Explore our menu and pick something delicious.</p>
      <a href="menu.html" class="btn btn-primary">Explore Food</a>
    </div>`;
}

function renderSuccess(orderId, total) {
  root.innerHTML = `
    <div class="panel empty-state">
      <div class="success-icon">${CHECK_ICON}</div>
      <h2>Order #${orderId} placed successfully!</h2>
      <p>Thank you for ordering with MyOnlineMeal. Total paid on delivery: <strong>${formatPrice(total)}</strong></p>
      <div class="actions-row">
        <a href="orders.html" class="btn btn-primary">View My Orders</a>
        <a href="menu.html" class="btn btn-outline">Order More</a>
      </div>
    </div>`;
  root.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCart() {
  const lines = cartLines();
  if (!lines.length) return renderEmpty();

  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const grandTotal = lines.reduce((s, l) => s + l.total, 0);
  const user = Auth.user;

  root.innerHTML = `
    <div class="cart-layout">
      <div class="panel">
        <h2>Items (${itemCount})</h2>
        ${lines.map(({ food, qty, total }) => `
          <div class="cart-item" data-id="${food.id}">
            <img src="${escapeHtml(food.imageUrl || 'images/foods/placeholder.svg')}" alt="${escapeHtml(food.name)}"
                 onerror="this.onerror=null;this.src='images/foods/placeholder.svg'">
            <div class="item-info">
              <h3>${escapeHtml(food.name)}</h3>
              <span class="unit">${formatPrice(food.price)} each</span>
            </div>
            <div class="qty">
              <button type="button" data-step="-1" aria-label="Decrease quantity">&minus;</button>
              <input type="number" value="${qty}" min="1" max="${MAX_QTY}" aria-label="Quantity">
              <button type="button" data-step="1" aria-label="Increase quantity">+</button>
            </div>
            <span class="line-total">${formatPrice(total)}</span>
            <button type="button" class="remove-btn" aria-label="Remove ${escapeHtml(food.name)}">&times;</button>
          </div>`).join('')}
      </div>

      <aside class="panel">
        <h2>Order Summary</h2>
        <div class="summary-row"><span>Subtotal (${itemCount} items)</span><span>${formatPrice(grandTotal)}</span></div>
        <div class="summary-row"><span>Delivery</span><span class="free">FREE</span></div>
        <div class="summary-row total"><span>Total</span><span>${formatPrice(grandTotal)}</span></div>

        ${user
          ? `<p class="user-note">Ordering as <strong>${escapeHtml(user.name)}</strong> (User ID: ${user.id})</p>`
          : `<p class="user-note">Please <a href="login.html?next=cart.html">log in or create an account</a> to place your order.</p>`}

        <form id="order-form" novalidate>
          <div class="form-group">
            <label for="address">Delivery Address</label>
            <textarea id="address" rows="3" placeholder="House no., street, area, city, PIN code">${escapeHtml(localStorage.getItem('lastAddress') || '')}</textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-block">${user ? `Order Now · ${formatPrice(grandTotal)}` : 'Login to Order'}</button>
          <p class="form-status" id="order-status" role="alert"></p>
        </form>
      </aside>
    </div>`;
}

root.addEventListener('click', (e) => {
  const row = e.target.closest('.cart-item');
  if (!row) return;
  const id = Number(row.dataset.id);

  if (e.target.closest('.remove-btn')) {
    Cart.remove(id);
    toast(`${foodsById.get(id).name} removed from cart`);
    return renderCart();
  }

  const step = e.target.closest('[data-step]');
  if (step) {
    const newQty = (Cart.get()[id] || 0) + Number(step.dataset.step);
    if (newQty < 1) return;
    Cart.setQty(id, newQty);
    renderCart();
  }
});

root.addEventListener('change', (e) => {
  const row = e.target.closest('.cart-item');
  if (row && e.target.matches('.qty input')) {
    Cart.setQty(Number(row.dataset.id), clampQty(e.target.value));
    renderCart();
  }
});

root.addEventListener('submit', async (e) => {
  if (e.target.id !== 'order-form') return;
  e.preventDefault();

  if (!Auth.user) {
    location.href = 'login.html?next=cart.html';
    return;
  }

  const status = document.getElementById('order-status');
  const address = document.getElementById('address').value.trim();
  const showError = (msg) => {
    status.textContent = msg;
    status.className = 'form-status show error';
  };
  status.className = 'form-status';

  if (address.length < 10) return showError('Please enter your full delivery address.');

  const button = e.target.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Placing order...';

  try {
    const items = cartLines().map((l) => ({ foodId: l.food.id, quantity: l.qty }));
    const { orderId, total } = await api('/api/orders', { method: 'POST', body: { items, address } });
    localStorage.setItem('lastAddress', address);
    Cart.clear();
    renderSuccess(orderId, total);
  } catch (err) {
    if (err.status === 401) {
      location.href = 'login.html?next=cart.html';
      return;
    }
    showError(err.message);
    button.disabled = false;
    button.textContent = 'Order Now';
  }
});

async function loadCart() {
  if (!Cart.count()) return renderEmpty();
  try {
    const foods = await api('/api/foods');
    foodsById = new Map(foods.map((f) => [f.id, f]));

    const cart = Cart.get();
    const missing = Object.keys(cart).filter((id) => !foodsById.has(Number(id)));
    if (missing.length) {
      missing.forEach((id) => delete cart[id]);
      Cart.save(cart);
      toast('Some items are no longer available and were removed from your cart.', 'error');
    }
    renderCart();
  } catch (err) {
    root.innerHTML = `<p class="state-msg">${escapeHtml(err.message)}</p>`;
  }
}

loadCart();

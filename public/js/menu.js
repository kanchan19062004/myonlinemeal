const grid = document.getElementById('food-grid');
const chipsEl = document.getElementById('category-chips');
const searchEl = document.getElementById('search');
const cartBar = document.getElementById('cart-bar');
const cartBarText = document.getElementById('cart-bar-text');

let foods = [];
let activeCategory = 'All';

function inCartNote(foodId) {
  const qty = Cart.get()[foodId];
  return qty ? `${qty} in your cart` : '';
}

function foodCard(food) {
  return `
    <article class="food-card" data-id="${food.id}">
      <div class="food-img">
        <img src="${escapeHtml(food.imageUrl || 'images/foods/placeholder.svg')}" alt="${escapeHtml(food.name)}" loading="lazy"
             onerror="this.onerror=null;this.src='images/foods/placeholder.svg'">
        <span class="diet-badge">Pure Veg</span>
      </div>
      <div class="food-body">
        <span class="food-cat">${escapeHtml(food.category)}</span>
        <div class="food-top">
          <h3>${escapeHtml(food.name)}</h3>
          <span class="price">${formatPrice(food.price)}</span>
        </div>
        <p class="food-desc">${escapeHtml(food.description)}</p>
        <div class="food-actions">
          <div class="qty">
            <button type="button" data-step="-1" aria-label="Decrease quantity">&minus;</button>
            <input type="number" value="1" min="1" max="${MAX_QTY}" aria-label="Quantity">
            <button type="button" data-step="1" aria-label="Increase quantity">+</button>
          </div>
          <button type="button" class="btn btn-primary add-btn">Add to Cart</button>
        </div>
        <p class="in-cart-note">${inCartNote(food.id)}</p>
      </div>
    </article>`;
}

function renderChips() {
  const categories = ['All', ...new Set(foods.map((f) => f.category))];
  chipsEl.innerHTML = categories
    .map((c) => `<button type="button" class="chip ${c === activeCategory ? 'active' : ''}" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
    .join('');
}

function renderFoods() {
  const term = searchEl.value.trim().toLowerCase();
  const visible = foods.filter((f) =>
    (activeCategory === 'All' || f.category === activeCategory) &&
    (!term || f.name.toLowerCase().includes(term) || f.description.toLowerCase().includes(term))
  );
  grid.innerHTML = visible.length
    ? visible.map(foodCard).join('')
    : '<p class="state-msg">No dishes match your search.</p>';
}

function updateCartBar() {
  const count = Cart.count();
  if (!count) return cartBar.classList.remove('show');
  const cart = Cart.get();
  const total = foods.reduce((sum, f) => sum + (cart[f.id] || 0) * f.price, 0);
  cartBarText.textContent = `${count} item${count > 1 ? 's' : ''} · ${formatPrice(total)}`;
  cartBar.classList.add('show');
}

chipsEl.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  activeCategory = chip.dataset.category;
  renderChips();
  renderFoods();
});

searchEl.addEventListener('input', renderFoods);

grid.addEventListener('click', (e) => {
  const card = e.target.closest('.food-card');
  if (!card) return;
  const input = card.querySelector('.qty input');

  const stepBtn = e.target.closest('[data-step]');
  if (stepBtn) {
    input.value = clampQty(Number(input.value) + Number(stepBtn.dataset.step));
    return;
  }

  if (e.target.closest('.add-btn')) {
    const id = Number(card.dataset.id);
    const food = foods.find((f) => f.id === id);
    const qty = clampQty(input.value);
    const newQty = Cart.add(id, qty);
    card.querySelector('.in-cart-note').textContent = inCartNote(id);
    input.value = 1;
    updateCartBar();
    toast(newQty === MAX_QTY ? `Maximum ${MAX_QTY} of ${food.name} per order` : `Added ${qty} × ${food.name} to cart`);
  }
});

grid.addEventListener('change', (e) => {
  if (e.target.matches('.qty input')) e.target.value = clampQty(e.target.value);
});

async function loadMenu() {
  try {
    foods = await api('/api/foods');
    if (!foods.length) {
      grid.innerHTML = '<p class="state-msg">No dishes available right now. Please check back soon.</p>';
      return;
    }
    renderChips();
    renderFoods();
    updateCartBar();
  } catch (err) {
    grid.innerHTML = `<p class="state-msg">${escapeHtml(err.message)}</p>`;
  }
}

loadMenu();

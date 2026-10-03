const ordersRoot = document.getElementById('orders-root');

function orderCard(order) {
  return `
    <article class="panel order-card">
      <div class="order-head">
        <div>
          <h3>Order #${order.id}</h3>
          <span class="order-date">${new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        </div>
        <span class="status-pill">${escapeHtml(order.status)}</span>
      </div>
      <table class="order-table">
        <thead><tr><th>Item</th><th class="num">Price</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead>
        <tbody>
          ${order.items.map((i) => `
            <tr>
              <td>${escapeHtml(i.name)}</td>
              <td class="num">${formatPrice(i.price)}</td>
              <td class="num">${i.quantity}</td>
              <td class="num">${formatPrice(i.lineTotal)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="order-foot">
        <span>Deliver to: ${escapeHtml(order.address)}</span>
        <strong>Total: ${formatPrice(order.total)}</strong>
      </div>
    </article>`;
}

async function loadOrders() {
  if (!Auth.user) {
    location.replace('login.html?next=orders.html');
    return;
  }
  try {
    const orders = await api('/api/orders');
    ordersRoot.innerHTML = orders.length
      ? orders.map(orderCard).join('')
      : `<div class="panel empty-state">
           <h2>No orders yet</h2>
           <p>Your orders will appear here once you place one.</p>
           <a href="menu.html" class="btn btn-primary">Explore Food</a>
         </div>`;
  } catch (err) {
    if (err.status === 401) return location.replace('login.html?next=orders.html');
    ordersRoot.innerHTML = `<p class="state-msg">${escapeHtml(err.message)}</p>`;
  }
}

loadOrders();

const contactForm = document.getElementById('contact-form');
const contactStatus = document.getElementById('contact-status');

function showStatus(message, type) {
  contactStatus.textContent = message;
  contactStatus.className = `form-status show ${type}`;
}

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(contactForm));

  if (!data.name.trim() || !data.email.trim() || !data.message.trim()) {
    return showStatus('Please fill in your name, email and message.', 'error');
  }

  const button = contactForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Sending...';

  try {
    const result = await api('/api/contact', { method: 'POST', body: data });
    showStatus(result.message, 'success');
    contactForm.reset();
  } catch (err) {
    showStatus(err.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Send Message';
  }
});

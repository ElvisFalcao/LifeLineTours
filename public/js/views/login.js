import { api, session, IS_DEMO } from '../api.js';
import { store } from '../store.js';
import { h, clear, toast } from '../ui.js';

const DEMO = [
  { role: 'Admin', email: 'admin@lifelinetours.co.za', password: 'admin123' },
  { role: 'Staff', email: 'staff@lifelinetours.co.za', password: 'staff123' },
  { role: 'Driver', email: 'driver@lifelinetours.co.za', password: 'driver123' },
];

export function renderLogin(root, onSuccess) {
  clear(root);

  const emailInput = h('input', { class: 'input', type: 'email', placeholder: 'you@lifelinetours.co.za', value: 'admin@lifelinetours.co.za', autocomplete: 'username' });
  const passInput = h('input', { class: 'input', type: 'password', placeholder: '••••••••', value: 'admin123', autocomplete: 'current-password' });
  const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Sign in');

  const submit = async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const res = await api.post('/auth/login', { email: emailInput.value.trim(), password: passInput.value });
      session.set(res);
      store.user = res.user;
      toast(`Welcome back, ${res.user.name.split(' ')[0]}!`, 'success');
      await onSuccess();
    } catch (err) {
      toast(err.message || 'Login failed', 'error');
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  };

  const demoRows = DEMO.map((d) =>
    h(
      'div',
      {
        class: 'row',
        title: 'Click to fill',
        onClick: () => {
          emailInput.value = d.email;
          passInput.value = d.password;
        },
      },
      h('span', {}, h('b', {}, d.role), ' — ', d.email),
      h('span', {}, d.password)
    )
  );

  const side = h(
    'div',
    { class: 'login-side' },
    h(
      'div',
      { class: 'ls-brand' },
      h('div', { class: 'logo' }, 'L'),
      h('div', {}, h('div', { style: { fontWeight: '800', fontSize: '17px' } }, 'LifeLine Tours'), h('div', { style: { color: '#c8a24a', fontSize: '12px' } }, 'Cape Town'))
    ),
    h(
      'div',
      {},
      h('h1', {}, 'Private chauffeur', h('br'), 'bookings, simplified.'),
      h('p', {}, 'Manage airport transfers, tours, weddings, matric dances and VIP hire — with live availability, deposits and one-tap WhatsApp confirmations.'),
      h(
        'div',
        { class: 'feats' },
        h('div', {}, h('span', { class: 'tick' }, '✓'), 'Double-booking protection'),
        h('div', {}, h('span', { class: 'tick' }, '✓'), 'Calendar & fleet at a glance'),
        h('div', {}, h('span', { class: 'tick' }, '✓'), 'Invoices, deposits & reports')
      )
    ),
    h('div', { style: { fontSize: '12px', color: '#8493ad', position: 'relative', zIndex: '1' } }, 'Operated under Lyfe Computer Technologies · Hout Bay')
  );

  const formSide = h(
    'div',
    { class: 'login-form-side' },
    h(
      'form',
      { class: 'login-card', onSubmit: submit },
      h('h2', {}, 'Sign in'),
      h('p', { class: 'lead' }, IS_DEMO ? 'Live browser demo — data is saved locally in your browser, just for you. Use any login below.' : 'Welcome back. Please enter your details.'),
      h('div', { class: 'field' }, h('label', {}, 'Email address'), emailInput),
      h('div', { class: 'field' }, h('label', {}, 'Password'), passInput),
      btn,
      h(
        'div',
        { class: 'demo-creds' },
        h('b', {}, 'Demo logins '),
        '(click to fill)',
        ...demoRows,
        IS_DEMO
          ? h('div', { class: 'row', style: { marginTop: '8px', color: '#b53434' }, title: 'Clear demo data and reload', onClick: () => window.__LLT_RESET__ && window.__LLT_RESET__() }, h('span', {}, '↺ Reset demo data'))
          : null
      )
    )
  );

  root.append(h('div', { class: 'login-wrap' }, side, formSide));
  setTimeout(() => passInput.focus(), 50);
}

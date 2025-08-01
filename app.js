let auth0Client;

async function initializeAuth0() {
  auth0Client = await createAuth0Client({
    domain: 'mypetid.us.auth0.com',
    clientId: 'IEiEjV0D2Eabn3t8Q1HXSG3b7D7MifMB',
    redirectUri: window.location.origin,
    cacheLocation: 'localstorage',
  });
}

function mergeClasses(...classes) {
  return classes.filter(Boolean).join(' ');
}

function showToast({ title, description }) {
  const id = Date.now();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div>
      ${title ? `<h4>${title}</h4>` : ''}
      ${description ? `<p>${description}</p>` : ''}
      <button class="btn-ghost" onclick="this.parentElement.parentElement.remove()"><i class="fa fa-times"></i></button>
    </div>
  `;
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

function showTab(tabId) {
  document.querySelectorAll('.tabs-content').forEach(content => content.classList.add('hidden'));
  document.querySelectorAll('.tabs-trigger').forEach(trigger => trigger.classList.remove('active'));
  document.getElementById(tabId).classList.remove('hidden');
  document.querySelector(`[onclick="showTab('${tabId}')"]`).classList.add('active');
}

function toggleValue(field, value) {
  document.querySelectorAll(`#${field}-group .toggle`).forEach(toggle => toggle.classList.remove('active'));
  document.querySelector(`[onclick="toggleValue('${field}', '${value}')"]`).classList.add('active');
  document.getElementById(`pet-${field}`).value = value;
}

async function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(page).classList.remove('hidden');
  if (page === 'dashboard') {
    await loadDashboard();
  } else if (page === 'pet-profile' && window.location.pathname.match(/^\/[a-zA-Z0-9]+$/)) {
    await loadPetProfile(window.location.pathname.slice(1));
  }
}

async function loadDashboard() {
  const isAuthenticated = await auth0Client.isAuthenticated();
  if (!isAuthenticated) {
    navigate('home');
    return;
  }
  const user = await auth0Client.getUser();
  document.getElementById('user-info').innerHTML = `
    <p>Name: ${user.name}</p>
    <p>Email: ${user.email}</p>
  `;
  const response = await fetch('data/dogs.json');
  const dogs = await response.json();
  document.getElementById('pet-management').innerHTML = dogs
    .filter(d => d.ownerEmail === user.email)
    .map(dog => `
      <div class="card">
        <h3>${dog.name}</h3>
        <p>${dog.description}</p>
        <button class="btn-primary" onclick="navigateToPet('${dog.name}')">View Profile</button>
      </div>
    `).join('');
  const locResponse = await fetch('data/locations.json');
  const locations = await locResponse.json();
  document.getElementById('location-table').innerHTML = locations
    .filter(loc => dogs.find(d => d.id === loc.dogId && d.ownerEmail === user.email))
    .map(loc => `
      <tr class="table-row">
        <td class="table-cell">${loc.dogName}</td>
        <td class="table-cell">${loc.latitude}</td>
        <td class="table-cell">${loc.longitude}</td>
        <td class="table-cell">${new Date(loc.timestamp).toLocaleString()}</td>
      </tr>
    `).join('');
  if (user.email === 'admin@example.com') { // Replace with your admin email
    document.querySelector(`[onclick="showTab('admin')"]`).classList.remove('hidden');
    const allUsers = await (await fetch('data/users.json')).json();
    document.getElementById('admin-table').innerHTML = allUsers.map(u => `
      <tr class="table-row">
        <td class="table-cell">${u.username}</td>
        <td class="table-cell">${u.email}</td>
        <td class="table-cell">${dogs.filter(d => d.ownerEmail === u.email).map(d => d.name).join(', ')}</td>
      </tr>
    `).join('');
  } else {
    document.querySelector(`[onclick="showTab('admin')"]`).classList.add('hidden');
  }
}

async function loadPetProfile(petName) {
  document.getElementById('pet-loading').classList.remove('hidden');
  document.getElementById('pet-content').classList.add('hidden');
  document.getElementById('pet-error').classList.add('hidden');
  try {
    const response = await fetch('data/dogs.json');
    const dogs = await response.json();
    const dog = dogs.find(d => d.name.toLowerCase() === petName.toLowerCase());
    if (!dog) {
      document.getElementById('pet-loading').classList.add('hidden');
      document.getElementById('pet-error').classList.remove('hidden');
      showToast({ title: 'Error', description: 'Pet not found' });
      return;
    }
    document.getElementById('pet-name').textContent = dog.name;
    document.getElementById('pet-name-about').textContent = dog.name;
    document.getElementById('pet-details').textContent = `${dog.breed} • ${dog.age} • ${dog.neutered}`;
    if (dog.photoUrl) {
      document.getElementById('pet-photo').src = dog.photoUrl;
      document.getElementById('pet-photo').classList.remove('hidden');
      document.getElementById('pet-photo-placeholder').classList.add('hidden');
    }
    document.getElementById('pet-description').textContent = dog.description || 'No description available.';
    document.getElementById('pet-age').textContent = dog.age || 'Unknown';
    document.getElementById('pet-weight').textContent = dog.weight || 'Unknown';
    document.getElementById('pet-coat').textContent = dog.coat || 'Unknown';
    document.getElementById('pet-eye-color').textContent = dog.eyeColor || 'Unknown';
    document.getElementById('pet-personality').textContent = dog.personality || 'No personality info.';
    document.getElementById('pet-loves').textContent = dog.loves || 'No loves info.';
    document.getElementById('pet-quirks').textContent = dog.quirks || 'No quirks info.';
    document.getElementById('pet-medical-info').textContent = dog.medicalInfo ? JSON.stringify(dog.medicalInfo) : 'No medical info.';
    document.getElementById('pet-socials').innerHTML = dog.socials ? Object.entries(dog.socials).map(([k, v]) => `<a href="${v}">${k}</a>`).join('<br>') : 'No socials.';
    document.getElementById('pet-loading').classList.add('hidden');
    document.getElementById('pet-content').classList.remove('hidden');
  } catch (error) {
    document.getElementById('pet-loading').classList.add('hidden');
    document.getElementById('pet-error').classList.remove('hidden');
    showToast({ title: 'Error', description: 'Failed to load pet profile' });
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const username = document.getElementById('register-username').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;
  if (!username || !email || !password) {
    showToast({ title: 'Error', description: 'All fields are required' });
    return;
  }
  if (password !== confirmPassword) {
    showToast({ title: 'Error', description: 'Passwords do not match' });
    return;
  }
  if (password.length < 8) {
    showToast({ title: 'Error', description: 'Password must be at least 8 characters' });
    return;
  }
  try {
    await auth0Client.loginWithRedirect({
      authorizationParams: {
        screen_hint: 'signup',
        login_hint: email,
        username: username,
      },
    });
    localStorage.setItem('pendingUser', JSON.stringify({ username, email }));
    showToast({ title: 'Success', description: 'Redirecting to Auth0 for registration' });
  } catch (error) {
    showToast({ title: 'Error', description: error.message });
  }
}

async function handlePetSubmit(event) {
  event.preventDefault();
  const isAuthenticated = await auth0Client.isAuthenticated();
  if (!isAuthenticated) {
    showToast({ title: 'Error', description: 'Please log in to add a pet' });
    navigate('register');
    return;
  }
  const user = await auth0Client.getUser();
  const petData = {
    name: document.getElementById('pet-name').value,
    breed: document.getElementById('pet-breed').value,
    description: document.getElementById('pet-description').value,
    sex: document.getElementById('pet-sex').value,
    neutered: document.getElementById('pet-neutered').value,
    age: document.getElementById('pet-age').value,
    weight: document.getElementById('pet-weight').value,
    nfcTagId: `NFC-${Date.now()}`,
    ownerEmail: user.email,
    ownerName: user.name,
    ownerPhone: user.phone_number || '',
    personality: '',
    loves: '',
    quirks: '',
    medicalInfo: {},
    socials: {},
    coat: '',
    eyeColor: '',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (!petData.name || petData.name.length > 255) {
    showToast({ title: 'Error', description: 'Pet name is required and must be less than 255 characters' });
    return;
  }
  if (!petData.breed) {
    showToast({ title: 'Error', description: 'Breed is required' });
    return;
  }
  if (!petData.sex) {
    showToast({ title: 'Error', description: 'Sex is required' });
    return;
  }
  console.log('Pet data to submit:', petData);
  showToast({ title: 'Success', description: 'Pet saved successfully (pending GitHub Actions)' });
  navigate('dashboard');
}

async function reportFound() {
  const petName = document.getElementById('pet-name').textContent;
  console.log(`Reporting found pet: ${petName}`);
  showToast({ title: 'Report Found', description: `Reported ${petName} as found (pending GitHub Actions)` });
}

async function contactOwner() {
  const petName = document.getElementById('pet-name').textContent;
  console.log(`Contacting owner for: ${petName}`);
  showToast({ title: 'Contact Owner', description: `Contacting owner of ${petName} (simulated)` });
}

async function logout() {
  await auth0Client.logout({ returnTo: window.location.origin });
  localStorage.removeItem('user');
  navigate('home');
}

async function navigateToPet(petName) {
  window.history.pushState({}, '', `/${petName}`);
  await navigate('pet-profile');
}

document.addEventListener('DOMContentLoaded', async () => {
  await initializeAuth0();
  if (window.location.search.includes('code=')) {
    await auth0Client.handleRedirectCallback();
    const user = await auth0Client.getUser();
    const pendingUser = JSON.parse(localStorage.getItem('pendingUser') || '{}');
    localStorage.setItem('user', JSON.stringify({ ...user, username: pendingUser.username }));
    localStorage.removeItem('pendingUser');
    window.history.replaceState({}, '', window.location.pathname);
    navigate('dashboard');
  } else if (window.location.pathname.match(/^\/[a-zA-Z0-9]+$/)) {
    navigate('pet-profile');
  } else {
    navigate('home');
  }
});
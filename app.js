let isLoggedIn = false;
let userData = null;
let dogData = null;
let locationsData = [];

async function fetchData() {
    const urlParams = new URLSearchParams(window.location.search);
    const tagId = urlParams.get('tag') || '04:6C:E3:0F:BE:2A:81';

    if (!tagId) {
        const content = document.getElementById('content');
        if (content) content.innerHTML = '<p>No dog tag ID provided. Please scan a valid QR code or NFC tag.</p>';
        return;
    }

    try {
        const cacheBust = new Date().getTime();
        const dogsResponse = await fetch(`/data/dogs.json?t=${cacheBust}`);
        const dogs = dogsResponse.ok ? await dogsResponse.json() : [];
        dogData = dogs.find(dog => dog.nfcTagId === tagId) || {
            _id: 'defaultDogId',
            nfcTagId: tagId,
            name: 'Unknown Dog',
            description: 'No description available',
            age: 'Unknown',
            weight: 'Unknown',
            coat: 'Unknown',
            sex: 'Unknown',
            eyeColor: 'Unknown',
            neutered: 'Unknown',
            breed: 'Unknown',
            personality: 'Unknown',
            loves: 'Unknown',
            routine: 'Unknown',
            training: 'Unknown',
            quirks: 'Unknown',
            medicalInfo: { shots: '', medications: '', vaccinations: '', checkups: '', allergies: '' },
            socials: { youtube: '', facebook: '', instagram: '', donationLink: '' },
            testimonials: [],
            gallery: [],
            photoUrl: '',
            ownerId: ''
        };
        console.log('Dog Data:', dogData);

        const usersResponse = await fetch(`/data/users.json?t=${cacheBust}`);
        const users = usersResponse.ok ? await usersResponse.json() : [];
        userData = users.find(user => user._id === dogData.ownerId) || null;
        console.log('User Data:', userData);

        const locationsResponse = await fetch(`/data/locations.json?t=${cacheBust}`);
        locationsData = locationsResponse.ok ? await locationsResponse.json() : [];
        console.log('Locations Data:', locationsData);
    } catch (error) {
        console.error('Error fetching static data:', error);
        const content = document.getElementById('content');
        if (content) content.innerHTML = '<p>Failed to load data. Please check back later.</p>';
        return;
    }

    if (userData) {
        isLoggedIn = true;
        showLoggedInState();
    } else {
        isLoggedIn = false;
        showLoggedOutState();
    }

    navigate(window.location.hash.replace('#', '') || 'account');
}

setInterval(fetchData, 30000);

function showLoggedInState() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const registerBtn = document.getElementById('registerBtn');
    const accountBtn = document.getElementById('accountBtn');
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'block';
    if (registerBtn) registerBtn.style.display = 'none';
    if (accountBtn) accountBtn.style.display = 'block';
}

function showLoggedOutState() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const registerBtn = document.getElementById('registerBtn');
    const accountBtn = document.getElementById('accountBtn');
    if (loginBtn) loginBtn.style.display = 'none'; // Hidden; use account page for login
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (registerBtn) registerBtn.style.display = 'none'; // Hidden; use account page for register
    if (accountBtn) accountBtn.style.display = 'block';
}

function toggleDrawer() {
    const drawer = document.getElementById('drawer');
    if (drawer) drawer.style.display = drawer.style.display === 'flex' ? 'none' : 'flex';
}

async function navigate(page) {
    const content = document.getElementById('content');
    const pageTitle = document.getElementById('page-title');
    const profilePic = document.getElementById('profile-pic');
    const locationMap = document.getElementById('location-map');
    if (!content || !pageTitle || !profilePic || !locationMap) {
        console.error('Required DOM elements not found');
        return;
    }
    toggleDrawer();

    window.location.hash = page;
    pageTitle.textContent = page.charAt(0).toUpperCase() + page.split('-').join(' ').slice(1);

    if (page === 'account' || page === 'login' || page === 'register' || page === 'reset-password' || page === 'logout') {
        profilePic.style.backgroundColor = 'gray';
        profilePic.style.backgroundImage = 'none';
        locationMap.style.display = 'none';
    } else {
        profilePic.style.backgroundImage = `url("${dogData.photoUrl || ''}")`;
        profilePic.style.backgroundSize = 'cover';
    }

    switch (page) {
        case 'home':
            content.innerHTML = `
                <h2>${dogData.name}</h2>
                <p>${dogData.description}</p>
                <p>Age: ${dogData.age}</p>
                <p>Weight: ${dogData.weight}</p>
                <p>Coat: ${dogData.coat}</p>
                <p>Sex: ${dogData.sex}</p>
                <p>Eye Color: ${dogData.eyeColor}</p>
                <p>Neutered: ${dogData.neutered}</p>
                <button onclick="navigate('report-lost')">Report Lost</button>
                <button onclick="navigate('medical')">Medical Info</button>
                <button onclick="navigate('about')">About Me</button>
                <button onclick="navigate('socials')">Socials</button>
                <button class="text-button" onclick="navigate('contact')">Contact Information</button>
                <button onclick="navigate('location')">View Location</button>
            `;
            locationMap.style.display = 'none';
            break;
        case 'contact':
            content.innerHTML = `
                <h2>Contact Information</h2>
                <h2>Dad</h2>
                <p>Email: ${userData ? userData.email : 'real_CAK3D@yahoo.com'}</p>
                <p>Phone: ${userData ? userData.phone : '(518) 610-3096'}</p>
                <p>Address: ${userData ? userData.address : '37 Fisher Ave, Lewiston, Maine, 04240'}</p>
                <h2>Boy</h2>
                <p>Email: ${userData ? userData.email : 'therealzayne@yahoo.com'}</p>
                <p>Phone: ${userData ? userData.phone : '(207) 440-7812'}</p>
                <p>Address: ${userData ? userData.address : '3 Downey Ln, Poland, Maine, 04210'}</p>
                <button onclick="navigate('report-lost')">Report Lost</button>
                <button onclick="navigate('medical')">Medical Info</button>
            `;
            locationMap.style.display = 'none';
            break;
        case 'medical':
            content.innerHTML = `
                <h2>Medical Information</h2>
                <p>Note: Please cover any personal information before uploading any documents</p>
                <p>Recent Shots: ${dogData.medicalInfo.shots}</p>
                <p>Medications: ${dogData.medicalInfo.medications}</p>
                <p>Vaccinations: ${dogData.medicalInfo.vaccinations}</p>
                <p>Checkups: ${dogData.medicalInfo.checkups}</p>
                <p>Allergies: ${dogData.medicalInfo.allergies}</p>
                <button class="text-button" onclick="navigate('about')">View About Me</button>
            `;
            locationMap.style.display = 'none';
            break;
        case 'about':
            content.innerHTML = `
                <h2>About Me</h2>
                <p>Breed: ${dogData.breed}</p>
                <p>Personality: ${dogData.personality}</p>
                <p>Loves: ${dogData.loves}</p>
                <p>Routine: ${dogData.routine}</p>
                <p>Training: ${dogData.training}</p>
                <p>Quirks: ${dogData.quirks}</p>
                <div style="display: flex; align-items: center; justify-content: center;">
                    <strong>My Socials</strong>
                    <span style="margin-left: 8px;">☰</span>
                </div>
                <p style="text-align: center;">Take a look at my Socials to see all my crazy journeys my owners have posted!</p>
                <button class="text-button" onclick="navigate('socials')">View Socials</button>
            `;
            locationMap.style.display = 'none';
            break;
        case 'socials':
            content.innerHTML = `
                <h2>Socials</h2>
                <p>YouTube: ${dogData.socials.youtube}</p>
                [![My Skills](https://skillicons.dev/icons?i=instagram)](https://skillicons.dev)<p>Instagram: ${dogData.socials.instagram}</p>
                <p>Facebook: ${dogData.socials.facebook}</p>
                <button class="text-button" onclick="navigate('donation')">Donation: ${dogData.socials.donationLink}</button>
                <p>Testimonials: See what others have to say about me!</p>
                ${dogData.testimonials.map(t => `<p>${t.text} - ${t.author}</p>`).join('')}
                <button class="text-button" onclick="navigate('gallery')">View Gallery: Check out my photos and videos!</button>
            `;
            locationMap.style.display = 'none';
            break;
        case 'donation':
            content.innerHTML = `
                <h2>Socials</h2>
                <strong>Throw me a Bone!</strong>
                <p style="text-align: center;">All proceeds cover food, supplies, and medical costs as needed to ensure ${dogData.name} receives proper nutrition and care.</p>
                <input type="text" id="donation-amount" placeholder="$ Custom Amount">
                <button onclick="alert('Redirect to PayPal (not implemented)')">Woof!</button>
                <div style="display: flex; justify-content: center; gap: 16px;">
                    <div style="width: 50px; height: 50px; border-radius: 50%; background-color: gray;"></div>
                    <div style="width: 50px; height: 50px; border-radius: 50%; background-color: gray;"></div>
                </div>
            `;
            locationMap.style.display = 'none';
            break;
        case 'gallery':
            content.innerHTML = `
                <h2>Gallery</h2>
                ${dogData.gallery.map(item => `
                    <p>${item.type}: ${item.description}</p>
                    ${item.type === 'Photo' ? `<img src="${item.url}" style="max-width: 100%; height: auto;">` : `<video src="${item.url}" controls style="max-width: 100%; height: auto;"></video>`}
                `).join('')}
                <button class="text-button" onclick="navigate('home')">Back to Home: Return to the main page</button>
            `;
            locationMap.style.display = 'none';
            break;
        case 'report-lost':
            content.innerHTML = `
                <h2>Report Lost</h2>
                <p style="text-align: center;">Found Me? Thank You! Please Fill Out This Form to Help Me Get Back Home!</p>
                <input type="text" id="finder-name" placeholder="Your Name">
                <input type="text" id="finder-contact" placeholder="Your Contact Info">
                <input type="text" id="location" placeholder="Where You Found Me">
                <button onclick="submitReportLost()">Submit</button>
                <div style="display: flex; justify-content: center; gap: 16px;">
                    <div style="width: 50px; height: 50px; border-radius: 50%; background-color: gray;"></div>
                    <div style="width: 50px; height: 50px; border-radius: 50%; background-color: gray;"></div>
                </div>
            `;
            locationMap.style.display = 'none';
            break;
        case 'account':
            const subPage = window.location.hash.split('#')[1] || (isLoggedIn ? 'view' : 'login');
            if (isLoggedIn && subPage === 'view') {
                content.innerHTML = `
                    <h2>Account</h2>
                    <strong>User Information</strong>
                    <p>Name: ${userData.name || 'Not set'}</p>
                    <p>Email: ${userData.email}</p>
                    <p>Phone: ${userData.phone || 'Not set'}</p>
                    <p>Address: ${userData.address || 'Not set'}</p>
                    <strong>Dog Information</strong>
                    <p>Name: ${dogData.name}</p>
                    <p>Description: ${dogData.description}</p>
                    <p>Age: ${dogData.age}</p>
                    <p>Weight: ${dogData.weight}</p>
                    <p>Coat: ${dogData.coat}</p>
                    <p>Sex: ${dogData.sex}</p>
                    <p>Eye Color: ${dogData.eyeColor}</p>
                    <p>Neutered: ${dogData.neutered}</p>
                    <p>Breed: ${dogData.breed}</p>
                    <p>Personality: ${dogData.personality}</p>
                    <p>Loves: ${dogData.loves}</p>
                    <p>Routine: ${dogData.routine}</p>
                    <p>Training: ${dogData.training}</p>
                    <p>Quirks: ${dogData.quirks}</p>
                    <button onclick="navigate('logout')">Logout</button>
                `;
            } else if (!isLoggedIn) {
                switch (subPage) {
                    case 'login':
                        content.innerHTML = `
                            <h2>Account - Login</h2>
                            <input type="text" id="email" placeholder="Email">
                            <input type="password" id="password" placeholder="Password">
                            <button onclick="login()">Login</button>
                            <button class="text-button" onclick="navigate('account#register')">Register</button>
                            <button class="text-button" onclick="navigate('account#reset-password')">Forgot Password?</button>
                        `;
                        break;
                    case 'register':
                        content.innerHTML = `
                            <h2>Account - Register</h2>
                            <input type="text" id="reg-email" placeholder="Email">
                            <input type="password" id="reg-password" placeholder="Password">
                            <input type="text" id="reg-name" placeholder="Name">
                            <input type="text" id="reg-phone" placeholder="Phone">
                            <input type="text" id="reg-address" placeholder="Address">
                            <input type="text" id="reg-device" placeholder="Device Name (e.g., Dad's Phone)">
                            <button onclick="register()">Register</button>
                            <button class="text-button" onclick="navigate('account#login')">Back to Login</button>
                        `;
                        break;
                    case 'reset-password':
                        content.innerHTML = `
                            <h2>Account - Reset Password</h2>
                            <input type="text" id="reset-email" placeholder="Enter your email">
                            <button onclick="resetPassword()">Send Reset Link</button>
                            <button class="text-button" onclick="navigate('account#login')">Back to Login</button>
                        `;
                        break;
                    default:
                        navigate('account#login');
                }
            }
            locationMap.style.display = 'none';
            break;
        case 'logout':
            logout();
            break;
        case 'location':
            const recentLocations = locationsData.filter(loc => {
                const locTime = new Date(loc.timestamp);
                const now = new Date();
                const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
                return loc.active && locTime >= twoHoursAgo && loc.latitude && loc.longitude && !isNaN(loc.latitude) && !isNaN(loc.longitude);
            });
            const mapUrl = recentLocations.length > 0
                ? `https://maps.google.com/maps?q=${recentLocations[0].latitude},${recentLocations[0].longitude}&z=15&output=embed`
                : `https://maps.google.com/maps?q=44.097371370963934,-70.16535158888728&z=15&output=embed`;
            content.innerHTML = `
                <h2>Location History</h2>
                <h3>Last Scanned Locations (Last 2 Hours)</h3>
                ${recentLocations.length > 0
                    ? recentLocations.map(loc => `
                        <p>Device: ${loc.deviceName || 'Unknown'}</p>
                        <p>Time: ${new Date(loc.timestamp).toLocaleString()}</p>
                        <p>Latitude: ${loc.latitude}, Longitude: ${loc.longitude}</p>
                    `).join('')
                    : '<p>No recent locations available.</p>'}
            `;
            locationMap.src = mapUrl;
            locationMap.style.display = 'block';
            console.log('Map URL set to:', mapUrl);
            break;
        case 'project-info':
            try {
                const readmeResponse = await fetch('READMEFIRST.md');
                if (readmeResponse.ok) {
                    const readmeText = await readmeResponse.text();
                    content.innerHTML = `<div>${readmeText.replace(/^\s*#+\s*/gm, '<h2>').replace(/\n/g, '<br>')}</div>`;
                    pageTitle.textContent = 'Project Info';
                } else {
                    content.innerHTML = '<p>Failed to load project info.</p>';
                }
            } catch (error) {
                console.error('Error fetching READMEFIRST.md:', error);
                content.innerHTML = '<p>Error loading project info. Please try again later.</p>';
            }
            locationMap.style.display = 'none';
            break;
    }
}

async function submitReportLost() {
    alert('Report feature is not available without a backend. Please contact the owner manually.');
    navigate('home');
}

async function saveChanges() {
    alert('Save feature is not available without a backend. Please update data manually via GitHub.');
    navigate('home');
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert('Please enter both email and password.');
        return;
    }

    try {
        const cacheBust = new Date().getTime();
        const usersResponse = await fetch(`/data/users.json?t=${cacheBust}`);
        const users = usersResponse.ok ? await usersResponse.json() : [];
        const user = users.find(u => u.email === email && u.password === password); // Placeholder; use hashing in production
        if (user) {
            isLoggedIn = true;
            userData = user;
            showLoggedInState();
            navigate('account#view');
        } else {
            alert('Invalid credentials.');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Failed to log in. Please try again later.');
    }
}

async function register() {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const name = document.getElementById('reg-name').value;
    const phone = document.getElementById('reg-phone').value;
    const address = document.getElementById('reg-address').value;
    const device = document.getElementById('reg-device').value;

    if (!email || !password || !name || !phone || !address || !device) {
        alert('All fields are required.');
        return;
    }

    try {
        const cacheBust = new Date().getTime();
        const usersResponse = await fetch(`/data/users.json?t=${cacheBust}`);
        const users = usersResponse.ok ? await usersResponse.json() : [];
        if (users.find(u => u.email === email)) {
            alert('Email already registered.');
            return;
        }

        const newUser = {
            _id: crypto.randomUUID(),
            username: name,
            password: password, // Placeholder; hash in production
            email: email,
            name: name,
            phone: phone,
            address: address,
            device: device
        };

        users.push(newUser);
        await fetch('/data/users.json', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(users)
        });
        alert('Registration successful. Please log in.');
        navigate('account#login');
    } catch (error) {
        console.error('Registration error:', error);
        alert('Failed to register. Please try again later.');
    }
}

async function resetPassword() {
    const email = document.getElementById('reset-email').value;
    if (!email) {
        alert('Please enter an email.');
        return;
    }

    try {
        const cacheBust = new Date().getTime();
        const usersResponse = await fetch(`/data/users.json?t=${cacheBust}`);
        const users = usersResponse.ok ? await usersResponse.json() : [];
        if (users.find(u => u.email === email)) {
            alert('Password reset link would be sent if backend were implemented. Contact support.');
        } else {
            alert('No account found with that email.');
        }
        navigate('account#login');
    } catch (error) {
        console.error('Reset password error:', error);
        alert('Failed to process reset. Please try again later.');
    }
}

async function logout() {
    isLoggedIn = false;
    userData = null;
    showLoggedOutState();
    await fetchData();
    navigate('account#login');
}

window.addEventListener('hashchange', () => {
    const page = window.location.hash.replace('#', '') || 'account';
    navigate(page);
});

fetchData();

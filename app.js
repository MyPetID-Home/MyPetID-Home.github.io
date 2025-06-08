let isLoggedIn = false;
let userData = null;
let dogData = null;
let locationsData = [];

async function fetchData() {
    const urlParams = new URLSearchParams(window.location.search);
    const tagId = urlParams.get('tag') || '04:6C:E3:0F:BE:2A:81';

    if (!tagId) {
        document.getElementById('content').innerHTML = '<p>No dog tag ID provided. Please scan a valid QR code or NFC task.</p>';
        return;
    }

    // Load static data from GitHub Pages
    try {
        const dogsResponse = await fetch('/data/dogs.json');
        const dogs = await dogsResponse.json();
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

        const usersResponse = await fetch('/data/users.json');
        const users = await usersResponse.json();
        userData = users.find(user => user._id === dogData.ownerId) || null;

        const locationsResponse = await fetch('/data/locations.json');
        locationsData = await locationsResponse.json();
    } catch (error) {
        console.error('Error fetching static data:', error);
        document.getElementById('content').innerHTML = '<p>Failed to load data. Please check back later.</p>';
        return;
    }

    if (userData) {
        isLoggedIn = true;
        showLoggedInState();
    }

    navigate(window.location.hash.replace('#', '') || 'home');
}

function showLoggedInState() {
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'block';
    document.getElementById('registerBtn').style.display = 'none';
    document.getElementById('accountBtn').style.display = 'block';
}

function showLoggedOutState() {
    document.getElementById('loginBtn').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('registerBtn').style.display = 'block';
    document.getElementById('accountBtn').style.display = 'none';
}

function toggleDrawer() {
    const drawer = document.getElementById('drawer');
    drawer.style.display = drawer.style.display === 'flex' ? 'none' : 'flex';
}

function navigate(page) {
    const content = document.getElementById('content');
    const pageTitle = document.getElementById('page-title');
    const profilePic = document.getElementById('profile-pic');
    const locationMap = document.getElementById('location-map');
    toggleDrawer();

    window.location.hash = page;
    pageTitle.textContent = page.charAt(0).toUpperCase() + page.split('-').join(' ').slice(1);

    if (page === 'account' || page === 'login' || page === 'register' || page === 'reset-password' || page === 'logout') {
        profilePic.style.backgroundColor = 'gray';
        profilePic.style.backgroundImage = 'none';
        locationMap.style.display = 'none';
    } else {
        profilePic.style.backgroundImage = `url("${dogData.photoUrl}")`;
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
            if (!isLoggedIn) {
                content.innerHTML = `<p>Please log in to view your account.</p><button onclick="navigate('login')">Login</button>`;
            } else {
                content.innerHTML = `
                    <h2>Account View</h2>
                    <strong>User Information</strong>
                    <p>Name: ${userData.name || 'Not set'}</p>
                    <p>Email: ${userData.email}</p>
                    <p>Phone: ${userData.phone || 'Not set'}</p>
                    <p>Address: ${userData.address || 'Not set'}</p>
                    <strong>Dog Information</strong>
                    <input type="text" id="dog-name" value="${dogData.name}">
                    <input type="text" id="dog-description" value="${dogData.description}">
                    <input type="text" id="dog-age" value="${dogData.age}">
                    <input type="text" id="dog-weight" value="${dogData.weight}">
                    <input type="text" id="dog-coat" value="${dogData.coat}">
                    <input type="text" id="dog-sex" value="${dogData.sex}">
                    <input type="text" id="dog-eyeColor" value="${dogData.eyeColor}">
                    <input type="text" id="dog-neutered" value="${dogData.neutered}">
                    <input type="text" id="dog-breed" value="${dogData.breed}">
                    <input type="text" id="dog-personality" value="${dogData.personality}">
                    <input type="text" id="dog-loves" value="${dogData.loves}">
                    <input type="text" id="dog-routine" value="${dogData.routine}">
                    <input type="text" id="dog-training" value="${dogData.training}">
                    <input type="text" id="dog-quirks" value="${dogData.quirks}">
                    <button onclick="saveChanges()">Save Changes</button>
                `;
            }
            locationMap.style.display = 'none';
            break;
        case 'login':
            if (isLoggedIn) {
                content.innerHTML = `
                    <h2>Welcome, ${userData.email}</h2>
                    <button onclick="navigate('account')">Go to Account</button>
                    <button onclick="navigate('home')">View Pet Profile</button>
                `;
            } else {
                content.innerHTML = `
                    <h2>Login</h2>
                    <input type="text" id="email" placeholder="Email">
                    <input type="password" id="password" placeholder="Password">
                    <button onclick="login()">Login</button>
                    <button class="text-button" onclick="navigate('register')">Register</button>
                    <button class="text-button" onclick="navigate('reset-password')">Forgot Password?</button>
                `;
            }
            locationMap.style.display = 'none';
            break;
        case 'register':
            content.innerHTML = `
                <h2>Register</h2>
                <input type="text" id="reg-email" placeholder="Email">
                <input type="password" id="reg-password" placeholder="Password">
                <input type="text" id="reg-name" placeholder="Name">
                <input type="text" id="reg-phone" placeholder="Phone">
                <input type="text" id="reg-address" placeholder="Address">
                <input type="text" id="reg-device" placeholder="Device Name (e.g., Dad's Phone)">
                <button onclick="register()">Register</button>
            `;
            locationMap.style.display = 'none';
            break;
        case 'reset-password':
            content.innerHTML = `
                <h2>Reset Password</h2>
                <input type="text" id="reset-email" placeholder="Enter your email">
                <button onclick="resetPassword()">Send Reset Link</button>
            `;
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
                return loc.active && locTime >= twoHoursAgo;
            });
            const mapUrl = recentLocations.length > 0
                ? `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2865.320840040887!2d${recentLocations[0].longitude}!3d${recentLocations[0].latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1748825673378!5m2!1sen!2sus`
                : `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2865.320840040887!2d-70.16535158888728!3d44.097371370963934!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4cb26c6c7f43bbdf%3A0xdb822f84329516f9!2s37%20Fisher%20Ave%2C%20Lewiston%2C%20ME%2004240!5e0!3m2!1sen!2sus!4v1748825673378!5m2!1sen!2sus`;
            content.innerHTML = `
                <h2>Location History</h2>
                <h3>Last Scanned Locations (Last 2 Hours)</h3>
                ${recentLocations.length > 0
                    ? recentLocations.map(loc => `
                        <p>Device: ${loc.deviceName}</p>
                        <p>Time: ${new Date(loc.timestamp).toLocaleString()}</p>
                        <p>Latitude: ${loc.latitude}, Longitude: ${loc.longitude}</p>
                    `).join('')
                    : '<p>No recent locations available.</p>'}
            `;
            locationMap.src = mapUrl;
            locationMap.style.display = 'block';
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
    alert('Login feature is not available without a backend. Please use static data.');
    navigate('home');
}

async function register() {
    alert('Registration is not available without a backend. Please contact the owner to add a user.');
    navigate('login');
}

async function resetPassword() {
    alert('Password reset is not available without a backend.');
    navigate('login');
}

async function logout() {
    isLoggedIn = false;
    userData = null;
    showLoggedOutState();
    await fetchData();
    navigate('home');
}

window.addEventListener('hashchange', () => {
    const page = window.location.hash.replace('#', '') || 'home';
    navigate(page);
});

fetchData();

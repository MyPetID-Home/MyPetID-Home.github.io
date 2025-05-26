let isLoggedIn = false;
let userData = null;
let dogData = null;
let locationsData = [];

async function fetchData() {
    const urlParams = new URLSearchParams(window.location.search);
    const tagId = urlParams.get('tag') || '04:6C:E3:0F:BE:2A:81';

    if (!tagId) {
        document.getElementById('content').innerHTML = '<p>No dog tag ID provided. Please scan a valid QR code or NFC tag.</p>';
        return;
    }

    try {
        const userResponse = await fetch('https://mypetid-map-69b6f0c23e33.herokuapp.com/api/user-data', {
            credentials: 'include'
        });
        if (userResponse.ok) {
            const data = await userResponse.json();
            userData = data.user;
            dogData = data.dog;
            isLoggedIn = true;
            showLoggedInState();
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
    }

    let dataLoaded = false;
    if (!dogData) {
        try {
            const dogResponse = await fetch(`https://mypetid-map-69b6f0c23e33.herokuapp.com/api/dog/${tagId}`);
            if (dogResponse.ok) {
                dogData = await dogResponse.json();
                dataLoaded = true;
            } else {
                document.getElementById('content').innerHTML = '<p>Dog not found. Check the tag ID or try again.</p>';
            }
        } catch (error) {
            console.error('Error fetching dog data:', error);
            document.getElementById('content').innerHTML = '<p>Error fetching dog data. Please try again later.</p>';
        }
    }

    try {
        const locationDogId = dogData ? dogData._id : tagId;
        const locationResponse = await fetch(`https://mypetid-map-69b6f0c23e33.herokuapp.com/api/locations/${locationDogId}`);
        if (locationResponse.ok) {
            locationsData = await locationResponse.json();
        } else {
            locationsData = [];
            document.getElementById('content').innerHTML += '<p>No locations found for this dog.</p>';
        }
    } catch (error) {
        console.error('Error fetching location data:', error);
        locationsData = [];
        document.getElementById('content').innerHTML += '<p>Error fetching location data. Please try again later.</p>';
    }

    if (!dataLoaded && !dogData) {
        try {
            const readmeResponse = await fetch('READMEFIRST.md');
            if (readmeResponse.ok) {
                const readmeText = await readmeResponse.text();
                document.getElementById('content').innerHTML = `<div>${readmeText.replace(/^\s*#+\s*/gm, '<h2>').replace(/\n/g, '<br>')}</div>`;
                document.getElementById('page-title').textContent = 'My Pet ID Static Info';
                return;
            }
        } catch (error) {
            console.error('Error fetching READMEFIRST.md:', error);
            document.getElementById('content').innerHTML = '<p>Failed to load data or static content. Please try again later.</p>';
            return;
        }
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
    if (!dogData && page !== 'login' && page !== 'register' && page !== 'reset-password' && page !== 'logout') {
        document.getElementById('content').innerHTML = '<p>Dog data not loaded yet. Please wait or check static info.</p>';
        return;
    }

    const content = document.getElementById('content');
    const pageTitle = document.getElementById('page-title');
    const profilePic = document.getElementById('profile-pic');
    toggleDrawer();

    window.location.hash = page;
    pageTitle.textContent = page.charAt(0).toUpperCase() + page.split('-').join(' ').slice(1);

    if (page === 'account' || page === 'login' || page === 'register' || page === 'reset-password' || page === 'logout') {
        profilePic.style.backgroundColor = 'gray';
        profilePic.style.backgroundImage = 'none';
    } else {
        profilePic.style.backgroundImage = `url("${dogData.photoUrl || 'https://via.placeholder.com/100'}")`;
        profilePic.style.backgroundSize = 'cover';
    }

    try {
        switch (page) {
            case 'home':
                const recentLocation = locationsData.find(loc => loc.active);
                const mapUrl = recentLocation
                    ? `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d2865.2493525638047!2d${recentLocation.longitude}!3d${recentLocation.latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1747449999425!5m2!1sen!2sus`
                    : `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d2865.2493525638047!2d-79.3832!3d43.6532!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1747449999425!5m2!1sen!2sus`;
                content.innerHTML = `
                    <h2>${dogData.name}</h2>
                    <p>${dogData.description}</p>
                    <p>Age: ${dogData.age}</p>
                    <p>Weight: ${dogData.weight}</p>
                    <p>Coat: ${dogData.coat}</p>
                    <p>Coat Color: ${dogData.coatColor}</p>
                    <p>Sex: ${dogData.sex}</p>
                    <p>Eye Color: ${dogData.eyeColor}</p>
                    <p>Neutered: ${dogData.neutered}</p>
                    <div class="section">
                        <button onclick="navigate('medical')">Medical Info</button>
                        <button onclick="navigate('contact')">Contact Info</button>
                        <button onclick="navigate('report-lost')">Report Lost</button>
                        <button onclick="navigate('location')">Last Scanned Location</button>
                    </div>
                `;
                break;
            case 'contact':
                content.innerHTML = `
                    <h2>Contact Information</h2>
                    <div class="contact-item"><img src="https://via.placeholder.com/50" alt="Boy"><span>Boy<br>(${userData ? userData.phone || '(207) 440-7812' : '(207) 440-7812'})</span></div>
                    <div class="contact-item"><img src="https://via.placeholder.com/50" alt="Dad"><span>Dad<br>(${userData ? userData.phone || '(518) 610-3096' : '(518) 610-3096'})</span></div>
                    <p>Email: ${userData ? userData.email : 'real_cak3d@yahoo.com'}</p>
                    <p>Address: ${userData ? userData.address || 'Not set' : 'Not set'}</p>
                    <div class="section">
                        <img src="https://img.icons8.com/ios-filled/50/000000/clipboard.png" alt="Report Lost">
                        <p>Report Lost<br>Fill out this quick form so my owners can have all the information needed.</p>
                        <button class="text-button" onclick="navigate('report-lost')">View</button>
                    </div>
                    <div class="section">
                        <img src="https://img.icons8.com/ios-filled/50/000000/document.png" alt="Medical Info">
                        <p>Medical Information<br>All my up to date shots and checks with my Vet</p>
                        <button class="text-button" onclick="navigate('medical')">View</button>
                    </div>
                `;
                break;
            case 'location':
                const recentLocation = locationsData.find(loc => loc.active);
                const locationMapUrl = recentLocation
                    ? `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d2865.2493525638047!2d${recentLocation.longitude}!3d${recentLocation.latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1747449999425!5m2!1sen!2sus`
                    : `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d2865.2493525638047!2d-79.3832!3d43.6532!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1747449999425!5m2!1sen!2sus`;
                content.innerHTML = `
                    <h2>Last Scanned Location</h2>
                    <p>Device: ${recentLocation ? recentLocation.deviceName : 'Unknown'}</p>
                    <p>Time: ${recentLocation ? new Date(recentLocation.timestamp).toLocaleString() : 'Not available'}</p>
                    <p>Latitude: ${recentLocation ? recentLocation.latitude : '43.6532'}</p>
                    <p>Longitude: ${recentLocation ? recentLocation.longitude : '-79.3832'}</p>
                    <div class="location-map">
                        <iframe src="${locationMapUrl}" width="400" height="300" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
                    </div>
                `;
                break;
            case 'medical':
                content.innerHTML = `
                    <h2>Medical Information</h2>
                    <p>Recent Shots: ${dogData.medicalInfo.shots}</p>
                    <p>Medications: ${dogData.medicalInfo.medications}</p>
                    <p>Vaccinations: ${dogData.medicalInfo.vaccinations}</p>
                    <p>Checkups: ${dogData.medicalInfo.checkups}</p>
                    <p>Allergies: ${dogData.medicalInfo.allergies}</p>
                    <button class="text-button" onclick="navigate('about')">View About Me</button>
                `;
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
                    <button class="text-button" onclick="navigate('socials')">View Socials</button>
                `;
                break;
            case 'socials':
                content.innerHTML = `
                    <h2>Socials</h2>
                    <div style="display: flex; justify-content: center; gap: 1rem; margin: 1rem 0;">
                        <a href="${dogData.socials.youtube}"><img src="https://img.icons8.com/ios-filled/50/000000/youtube-play.png" alt="YouTube"></a>
                        <a href="${dogData.socials.facebook}"><img src="https://img.icons8.com/ios-filled/50/000000/facebook.png" alt="Facebook"></a>
                        <a href="${dogData.socials.instagram}"><img src="https://img.icons8.com/ios-filled/50/000000/instagram.png" alt="Instagram"></a>
                    </div>
                    <iframe src="https://www.youtube.com/embed/${new URL(dogData.socials.youtube).searchParams.get('v')}" title="YouTube video" allowfullscreen></iframe>
                    <div class="section">
                        <strong>Throw me a Bone!</strong>
                        <p>All proceeds cover food, supplies, and medical costs as needed to ensure ${dogData.name} receives proper nutrition and care.</p>
                        <input type="text" id="donation-amount" placeholder="$ Custom Amount">
                        <button onclick="window.location.href='${dogData.socials.donationLink}'">Woof!</button>
                    </div>
                    <div class="testimonial">
                        <img src="https://via.placeholder.com/50" alt="Dad">
                        <p>${dogData.testimonials[0].text} -${dogData.testimonials[0].author}</p>
                    </div>
                    <button class="text-button" onclick="navigate('gallery')">View Gallery</button>
                `;
                break;
            case 'gallery':
                content.innerHTML = `
                    <h2>Gallery</h2>
                    ${dogData.gallery && Array.isArray(dogData.gallery) ? dogData.gallery.map(item => `
                        <div class="gallery-item">
                            <img src="${item.url || 'https://via.placeholder.com/100'}" alt="${item.description || 'Gallery Image'}">
                        </div>
                    `).join('') : '<p>No gallery images available.</p>'}
                    <button class="text-button" onclick="navigate('home')">Back to Home</button>
                `;
                break;
            case 'report-lost':
                content.innerHTML = `
                    <h2>Report Lost</h2>
                    <p>Found Me? Thank You! Please Fill Out This Form to Help Me Get Back Home!</p>
                    <input type="text" id="finder-name" placeholder="Your Name">
                    <input type="text" id="finder-contact" placeholder="Your Contact Info">
                    <input type="text" id="location" placeholder="Where You Found Me">
                    <button onclick="submitReportLost()">Submit</button>
                `;
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
                        <input type="text" id="dog-name" value="${dogData.name || ''}">
                        <input type="text" id="dog-description" value="${dogData.description || ''}">
                        <input type="text" id="dog-age" value="${dogData.age || ''}">
                        <input type="text" id="dog-weight" value="${dogData.weight || ''}">
                        <input type="text" id="dog-coat" value="${dogData.coat || ''}">
                        <input type="text" id="dog-coatColor" value="${dogData.coatColor || ''}">
                        <input type="text" id="dog-sex" value="${dogData.sex || ''}">
                        <input type="text" id="dog-eyeColor" value="${dogData.eyeColor || ''}">
                        <input type="text" id="dog-neutered" value="${dogData.neutered || ''}">
                        <input type="text" id="dog-breed" value="${dogData.breed || ''}">
                        <input type="text" id="dog-personality" value="${dogData.personality || ''}">
                        <input type="text" id="dog-loves" value="${dogData.loves || ''}">
                        <input type="text" id="dog-routine" value="${dogData.routine || ''}">
                        <input type="text" id="dog-training" value="${dogData.training || ''}">
                        <input type="text" id="dog-quirks" value="${dogData.quirks || ''}">
                        <input type="text" id="dog-photoUrl" value="${dogData.photoUrl || ''}">
                        <button onclick="saveChanges()">Save Changes</button>
                    `;
                }
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
                break;
            case 'reset-password':
                content.innerHTML = `
                    <h2>Reset Password</h2>
                    <input type="text" id="reset-email" placeholder="Enter your email">
                    <button onclick="resetPassword()">Send Reset Link</button>
                `;
                break;
            case 'logout':
                logout();
                break;
            default:
                content.innerHTML = `<p>Page not found: ${page}</p>`;
        }
    } catch (error) {
        content.innerHTML = `<p>Error loading page ${page}: ${error.message}</p>`;
    }
}

async function submitReportLost() {
    const finderName = document.getElementById('finder-name').value;
    const finderContact = document.getElementById('finder-contact').value;
    const location = document.getElementById('location').value;
    try {
        const response = await fetch('https://mypetid-map-69b6f0c23e33.herokuapp.com/api/report-lost', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dogId: dogData._id,
                finderName,
                finderContact,
                location
            })
        });
        if (response.ok) {
            alert('Report submitted successfully!');
            navigate('home');
        } else {
            alert('Failed to submit report.');
        }
    } catch (error) {
        alert('Error submitting report: ' + error.message);
    }
}

async function saveChanges() {
    if (!isLoggedIn || !userData || userData._id !== dogData.ownerId) {
        alert('You do not have permission to edit this profile.');
        return;
    }

    const updatedDog = {
        name: document.getElementById('dog-name').value,
        description: document.getElementById('dog-description').value,
        age: document.getElementById('dog-age').value,
        weight: document.getElementById('dog-weight').value,
        coat: document.getElementById('dog-coat').value,
        coatColor: document.getElementById('dog-coatColor').value,
        sex: document.getElementById('dog-sex').value,
        eyeColor: document.getElementById('dog-eyeColor').value,
        neutered: document.getElementById('dog-neutered').value,
        breed: document.getElementById('dog-breed').value,
        personality: document.getElementById('dog-personality').value,
        loves: document.getElementById('dog-loves').value,
        routine: document.getElementById('dog-routine').value,
        training: document.getElementById('dog-training').value,
        quirks: document.getElementById('dog-quirks').value,
        medicalInfo: dogData.medicalInfo,
        socials: dogData.socials,
        testimonials: dogData.testimonials,
        gallery: dogData.gallery,
        photoUrl: document.getElementById('dog-photoUrl').value,
        ownerId: dogData.ownerId,
        nfcTagId: dogData.nfcTagId
    };

    try {
        const response = await fetch(`https://mypetid-map-69b6f0c23e33.herokuapp.com/api/dog/${dogData._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedDog),
            credentials: 'include'
        });
        if (response.ok) {
            dogData = await response.json();
            alert('Changes saved successfully!');
            navigate('home');
        } else {
            alert('Failed to save changes.');
        }
    } catch (error) {
        alert('Error saving changes: ' + error.message);
    }
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        const response = await fetch('https://mypetid-map-69b6f0c23e33.herokuapp.com/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });
        const data = await response.json();
        if (response.ok) {
            isLoggedIn = true;
            userData = data.user;
            dogData = data.dog;
            showLoggedInState();
            navigate('home');
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Error logging in: ' + error.message);
    }
}

async function register() {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const name = document.getElementById('reg-name').value;
    const phone = document.getElementById('reg-phone').value;
    const address = document.getElementById('reg-address').value;
    const device = document.getElementById('reg-device').value;
    try {
        const response = await fetch('https://mypetid-map-69b6f0c23e33.herokuapp.com/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, phone, address, device })
        });
        if (response.ok) {
            alert('Registration successful! Please log in.');
            navigate('login');
        } else {
            alert('Failed to register.');
        }
    } catch (error) {
        alert('Error registering: ' + error.message);
    }
}

async function resetPassword() {
    const email = document.getElementById('reset-email').value;
    try {
        const response = await fetch('https://mypetid-map-69b6f0c23e33.herokuapp.com/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (response.ok) {
            alert('Password reset link sent to your email (implementation pending).');
            navigate('login');
        } else {
            alert('Failed to send reset link.');
        }
    } catch (error) {
        alert('Error sending reset link: ' + error.message);
    }
}

async function logout() {
    try {
        const response = await fetch('https://mypetid-map-69b6f0c23e33.herokuapp.com/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        if (response.ok) {
            isLoggedIn = false;
            userData = null;
            showLoggedOutState();
            await fetchData();
            navigate('home');
        } else {
            alert('Failed to log out.');
        }
    } catch (error) {
        alert('Error logging out: ' + error.message);
    }
}

window.addEventListener('hashchange', () => {
    const page = window.location.hash.replace('#', '') || 'home';
    navigate(page);
});

fetchData();

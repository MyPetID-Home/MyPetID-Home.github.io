let isLoggedIn = false;
let userData = null;
let dogData = null;

async function fetchData() {
    const urlParams = new URLSearchParams(window.location.search);
    const tagId = urlParams.get('tag');
    const userId = urlParams.get('userId');

    if (!tagId) {
        document.getElementById('content').innerHTML = '<p>No dog tag ID provided. Please scan a valid QR code or NFC tag.</p>';
        return;
    }

    // Fetch user data if logged in
    if (userId) {
        try {
            const response = await fetch('https://mypetid-backend.herokuapp.com/api/user-data', {
                credentials: 'include' // Include cookies for authentication
            });
            if (response.ok) {
                const data = await response.json();
                userData = data.user;
                dogData = data.dog;
                isLoggedIn = true;
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }

    // Fetch dog data if not logged in or user fetch fails
    if (!dogData) {
        try {
            const response = await fetch(`https://mypetid-backend.herokuapp.com/api/dog/${tagId}`);
            if (response.ok) {
                dogData = await response.json();
            } else {
                document.getElementById('content').innerHTML = '<p>Dog not found.</p>';
                return;
            }
        } catch (error) {
            document.getElementById('content').innerHTML = `<p>Error fetching dog data: ${error.message}</p>`;
            return;
        }
    }

    navigate(window.location.hash.replace('#', '') || 'home');
}

function toggleDrawer() {
    const drawer = document.getElementById('drawer');
    drawer.style.display = drawer.style.display === 'flex' ? 'none' : 'flex';
}

function navigate(page) {
    if (!dogData) {
        document.getElementById('content').innerHTML = '<p>Dog data not loaded yet. Please wait.</p>';
        return;
    }

    const content = document.getElementById('content');
    const pageTitle = document.getElementById('page-title');
    const profilePic = document.getElementById('profile-pic');
    toggleDrawer();

    window.location.hash = page;
    pageTitle.textContent = page.charAt(0).toUpperCase() + page.split('-').join(' ').slice(1);

    if (page === 'account') {
        profilePic.style.backgroundColor = 'gray';
        profilePic.style.backgroundImage = 'none';
    } else {
        profilePic.style.backgroundImage = `url(${dogData.photoUrl})`;
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
            `;
            break;
        case 'contact':
            content.innerHTML = `
                <h2>Contact Information</h2>
                <p>Email: ${userData ? userData.email : 'clydedog416@gmail.com'}</p>
                <p>Phone: ${userData ? userData.phone : '(416) 555-1234'}</p>
                <p>Address: ${userData ? userData.address : '123 Bone Street, Toronto, Ontario, M5V 2T4, Canada'}</p>
                <button onclick="navigate('report-lost')">Report Lost</button>
                <button onclick="navigate('medical')">Medical Info</button>
            `;
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
                <button class="text-button" onclick="navigate('about')">View</button>
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
                <div style="display: flex; align-items: center; justify-content: center;">
                    <strong>My Socials</strong>
                    <span style="margin-left: 8px;">☰</span>
                </div>
                <p style="text-align: center;">Take a look at my Socials to see all my crazy journeys my owners have posted!</p>
                <button class="text-button" onclick="navigate('socials')">View</button>
            `;
            break;
        case 'socials':
            content.innerHTML = `
                <h2>Socials</h2>
                <p>YouTube: ${dogData.socials.youtube}</p>
                <p>Instagram: ${dogData.socials.instagram}</p>
                <p>Facebook: ${dogData.socials.facebook}</p>
                <p>TikTok: ${dogData.socials.tiktok}</p>
                <p>Twitter: ${dogData.socials.twitter}</p>
                <p>Custom Link 1: ${dogData.socials.customLink1}</p>
                <p>Custom Link 2: ${dogData.socials.customLink2}</p>
                <button class="text-button" onclick="navigate('donation')">Donation: ${dogData.socials.donationLink}</button>
                <p>Testimonials: See what others have to say about me!</p>
                ${dogData.testimonials.map(t => `<p>${t.text} - ${t.author}</p>`).join('')}
                <button class="text-button" onclick="navigate('gallery')">View Gallery: Check out my photos and videos!</button>
            `;
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
            break;
        case 'account':
            if (!isLoggedIn) {
                content.innerHTML = `<p>Please log in to view your account.</p><button onclick="navigate('login')">Login</button>`;
            } else {
                content.innerHTML = `
                    <h2>Account View</h2>
                    <strong>User Information</strong>
                    <p>Name: ${userData.name}</p>
                    <p>Email: ${userData.email}</p>
                    <p>Phone: ${userData.phone}</p>
                    <p>Address: ${userData.address}</p>
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
            break;
        case 'login':
            content.innerHTML = `
                <h2>Login</h2>
                <input type="text" id="email" placeholder="Email">
                <input type="password" id="password" placeholder="Password">
                <button onclick="login()">Login</button>
                <button class="text-button" onclick="navigate('register')">Register</button>
            `;
            break;
        case 'register':
            content.innerHTML = `
                <h2>Register</h2>
                <input type="text" id="reg-email" placeholder="Email">
                <input type="password" id="reg-password" placeholder="Password">
                <input type="text" id="reg-name" placeholder="Name">
                <input type="text" id="reg-phone" placeholder="Phone">
                <input type="text" id="reg-address" placeholder="Address">
                <button onclick="register()">Register</button>
            `;
            break;
    }
}

async function submitReportLost() {
    const finderName = document.getElementById('finder-name').value;
    const finderContact = document.getElementById('finder-contact').value;
    const location = document.getElementById('location').value;
    try {
        const response = await fetch('https://mypetid-backend.herokuapp.com/api/report-lost', {
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
    const updatedDog = {
        name: document.getElementById('dog-name').value,
        description: document.getElementById('dog-description').value,
        age: document.getElementById('dog-age').value,
        weight: document.getElementById('dog-weight').value,
        coat: document.getElementById('dog-coat').value,
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
        photoUrl: dogData.photoUrl
    };

    try {
        const response = await fetch(`https://mypetid-backend.herokuapp.com/api/dog/${dogData._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedDog),
            credentials: 'include'
        });
        if (response.ok) {
            dogData = await response.json();
            alert('Changes saved successfully!');
            navigate('home');
        } else {
            alert('Failed to save changes. Please log in.');
        }
    } catch (error) {
        alert('Error saving changes: ' + error.message);
    }
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        const response = await fetch('https://mypetid-backend.herokuapp.com/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });
        const data = await response.json();
        if (response.ok) {
            isLoggedIn = true;
            await fetchData(); // Refresh data after login
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
    try {
        const response = await fetch('https://mypetid-backend.herokuapp.com/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, phone, address })
        });
        if (response.ok) {
            alert('Registration successful');
            navigate('login');
        } else {
            alert('Failed to register');
        }
    } catch (error) {
        alert('Error registering: ' + error.message);
    }
}

async function logout() {
    try {
        const response = await fetch('https://mypetid-backend.herokuapp.com/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        if (response.ok) {
            isLoggedIn = false;
            userData = null;
            await fetchData(); // Refresh data to show default dog profile
            navigate('home');
        } else {
            alert('Failed to log out');
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

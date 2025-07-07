// DOM elements
const pet = document.getElementById('pet');
const petIdParam = 'pet';
const registrationForm = document.getElementById('registrationForm');
const petProfile = document.getElementById('petProfile');
const mapContainer = document.getElementById('mapContainer');
const backToProfile = document.getElementById('backToProfile');
const reportFoundButton = document.getElementById('reportFoundButton');
const mapDiv = document.getElementById('map');
const ownerPhotoDiv = document.getElementById('ownerPhoto');
const addTestimonialButton = document.getElementById('addTestimonialButton');
const testimonialModal = document.getElementById('testimonialModal');
const testimonialForm = document.getElementById('testimonialForm');
const closeModal = document.getElementById('closeModal');
const galleryContainer = document.getElementById('galleryContainer');
const medicalDocumentsContainer = document.getElementById('medicalDocumentsContainer');
const socialsContainer = document.getElementById('socialsContainer');
const petNameSpan = document.getElementById('petName');
const petDescriptionSpan = document.getElementById('petDescription');
const petBreedSpan = document.getElementById('petBreed');
const petAgeSpan = document.getElementById('petAge');
const petWeightSpan = document.getElementById('petWeight');
const petCoatSpan = document.getElementById('petCoat');
const petCoatColorSpan = document.getElementById('petCoatColor');
const petSexSpan = document.getElementById('petSex');
const petEyeColorSpan = document.getElementById('petEyeColor');
const petNeuteredSpan = document.getElementById('petNeutered');
const petPersonalitySpan = document.getElementById('petPersonality');
const petLovesSpan = document.getElementById('petLoves');
const petRoutineSpan = document.getElementById('petRoutine');
const petTrainingSpan = document.getElementById('petTraining');
const petQuirksSpan = document.getElementById('petQuirks');
const testimonialsList = document.getElementById('testimonialsList');
const medicalShotsSpan = document.getElementById('medicalShots');
const medicalMedicationsSpan = document.getElementById('medicalMedications');
const medicalVaccinationsSpan = document.getElementById('medicalVaccinations');
const medicalCheckupsSpan = document.getElementById('medicalCheckups');
const medicalAllergiesSpan = document.getElementById('medicalAllergies');

// State variables
let pets = [];
let map;
let currentPetId = null;
let locations = [];

// Load pets data
async function loadPets() {
    try {
        const response = await fetch('data/dogs.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const petsData = await response.json();
        
        // Ensure pets is always an array
        if (!Array.isArray(petsData)) {
            console.error('Expected array but got:', typeof petsData);
            return [];
        }
        
        pets = petsData;
        return pets;
    } catch (error) {
        console.error('Error loading pets:', error);
        pets = []; // Set to empty array on error
        return [];
    }
}

// Load locations data
async function loadLocations() {
    try {
        const response = await fetch('data/locations.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const locationsData = await response.json();
        
        // Ensure locations is always an array
        if (!Array.isArray(locationsData)) {
            console.error('Expected locations array but got:', typeof locationsData);
            return [];
        }
        
        locations = locationsData;
        return locations;
    } catch (error) {
        console.error('Error loading locations:', error);
        locations = []; // Set to empty array on error
        return [];
    }
}

// Get URL parameters
function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Display pet profile
function displayPetProfile(petData) {
    if (!petData) {
        console.error('No pet data provided');
        return;
    }

    // Hide registration form and show profile
    if (registrationForm) registrationForm.style.display = 'none';
    if (petProfile) petProfile.style.display = 'block';

    // Update pet information
    if (petNameSpan) petNameSpan.textContent = petData.name || 'Unknown';
    if (petDescriptionSpan) petDescriptionSpan.textContent = petData.description || 'No description available';
    if (petBreedSpan) petBreedSpan.textContent = petData.breed || 'Unknown';
    if (petAgeSpan) petAgeSpan.textContent = petData.age || 'Unknown';
    if (petWeightSpan) petWeightSpan.textContent = petData.weight || 'Unknown';
    if (petCoatSpan) petCoatSpan.textContent = petData.coat || 'Unknown';
    if (petCoatColorSpan) petCoatColorSpan.textContent = petData.coatColor || 'Unknown';
    if (petSexSpan) petSexSpan.textContent = petData.sex || 'Unknown';
    if (petEyeColorSpan) petEyeColorSpan.textContent = petData.eyeColor || 'Unknown';
    if (petNeuteredSpan) petNeuteredSpan.textContent = petData.neutered || 'Unknown';
    if (petPersonalitySpan) petPersonalitySpan.textContent = petData.personality || 'Unknown';
    if (petLovesSpan) petLovesSpan.textContent = petData.loves || 'Unknown';
    if (petRoutineSpan) petRoutineSpan.textContent = petData.routine || 'Unknown';
    if (petTrainingSpan) petTrainingSpan.textContent = petData.training || 'Unknown';
    if (petQuirksSpan) petQuirksSpan.textContent = petData.quirks || 'Unknown';

    // Update medical information
    if (petData.medicalInfo) {
        if (medicalShotsSpan) medicalShotsSpan.textContent = petData.medicalInfo.shots || 'None listed';
        if (medicalMedicationsSpan) medicalMedicationsSpan.textContent = petData.medicalInfo.medications || 'None listed';
        if (medicalVaccinationsSpan) medicalVaccinationsSpan.textContent = petData.medicalInfo.vaccinations || 'None listed';
        if (medicalCheckupsSpan) medicalCheckupsSpan.textContent = petData.medicalInfo.checkups || 'None listed';
        if (medicalAllergiesSpan) medicalAllergiesSpan.textContent = petData.medicalInfo.allergies || 'None listed';
    }

    // Display owner photo
    if (ownerPhotoDiv && petData.photoUrl) {
        ownerPhotoDiv.innerHTML = `<img src="${petData.photoUrl}" alt="Owner Photo" class="owner-photo">`;
    }

    // Display testimonials
    displayTestimonials(petData.testimonials || []);

    // Display gallery
    displayGallery(petData.gallery || []);

    // Display medical documents
    displayMedicalDocuments(petData.medicalInfo?.documents || []);

    // Display social links
    displaySocialLinks(petData.socials || {});

    currentPetId = petData._id;
}

// Display testimonials
function displayTestimonials(testimonials) {
    if (!testimonialsList) return;

    if (!Array.isArray(testimonials) || testimonials.length === 0) {
        testimonialsList.innerHTML = '<p>No testimonials yet.</p>';
        return;
    }

    testimonialsList.innerHTML = testimonials.map(testimonial => `
        <div class="testimonial">
            <p>"${testimonial.text || 'No text provided'}"</p>
            <small>- ${testimonial.author || 'Anonymous'}</small>
        </div>
    `).join('');
}

// Display gallery
function displayGallery(gallery) {
    if (!galleryContainer) return;

    if (!Array.isArray(gallery) || gallery.length === 0) {
        galleryContainer.innerHTML = '<p>No photos available.</p>';
        return;
    }

    galleryContainer.innerHTML = gallery.map(item => `
        <div class="gallery-item">
            <img src="${item.url || ''}" alt="${item.description || 'Pet photo'}" class="gallery-image">
            <p class="gallery-description">${item.description || 'No description'}</p>
        </div>
    `).join('');
}

// Display medical documents
function displayMedicalDocuments(documents) {
    if (!medicalDocumentsContainer) return;

    if (!Array.isArray(documents) || documents.length === 0) {
        medicalDocumentsContainer.innerHTML = '<p>No medical documents available.</p>';
        return;
    }

    medicalDocumentsContainer.innerHTML = documents.map(doc => `
        <div class="medical-document">
            <a href="${doc}" target="_blank" rel="noopener noreferrer">
                <img src="${doc}" alt="Medical Document" class="medical-doc-image">
            </a>
        </div>
    `).join('');
}

// Display social links
function displaySocialLinks(socials) {
    if (!socialsContainer) return;

    const socialLinks = [];
    
    if (socials.youtube) {
        socialLinks.push(`<a href="${socials.youtube}" target="_blank" rel="noopener noreferrer" class="social-link youtube">YouTube</a>`);
    }
    if (socials.instagram) {
        socialLinks.push(`<a href="${socials.instagram}" target="_blank" rel="noopener noreferrer" class="social-link instagram">Instagram</a>`);
    }
    if (socials.facebook) {
        socialLinks.push(`<a href="${socials.facebook}" target="_blank" rel="noopener noreferrer" class="social-link facebook">Facebook</a>`);
    }
    if (socials.donationLink) {
        socialLinks.push(`<a href="${socials.donationLink}" target="_blank" rel="noopener noreferrer" class="social-link donation">Donate</a>`);
    }

    if (socialLinks.length === 0) {
        socialsContainer.innerHTML = '<p>No social links available.</p>';
    } else {
        socialsContainer.innerHTML = socialLinks.join('');
    }
}

// Initialize map
function initMap() {
    if (!mapDiv) return;

    // Default location (Toronto)
    const defaultLocation = { lat: 43.6532, lng: -79.3832 };
    
    map = new google.maps.Map(mapDiv, {
        zoom: 10,
        center: defaultLocation,
    });

    // Add markers for pet locations
    if (Array.isArray(locations) && locations.length > 0) {
        const petLocations = locations.filter(location => location.dogId === currentPetId);
        
        petLocations.forEach(location => {
            if (location.latitude && location.longitude) {
                const marker = new google.maps.Marker({
                    position: { lat: location.latitude, lng: location.longitude },
                    map: map,
                    title: `Location from ${location.deviceName || 'Unknown device'} at ${location.timestamp || 'Unknown time'}`,
                });

                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div>
                            <h3>Pet Location</h3>
                            <p>Device: ${location.deviceName || 'Unknown'}</p>
                            <p>Time: ${location.timestamp ? new Date(location.timestamp).toLocaleString() : 'Unknown'}</p>
                            <p>Status: ${location.active ? 'Active' : 'Inactive'}</p>
                        </div>
                    `,
                });

                marker.addListener('click', () => {
                    infoWindow.open(map, marker);
                });
            }
        });

        // Center map on most recent location
        if (petLocations.length > 0) {
            const mostRecent = petLocations.reduce((latest, current) => 
                new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
            );
            
            if (mostRecent.latitude && mostRecent.longitude) {
                map.setCenter({ lat: mostRecent.latitude, lng: mostRecent.longitude });
            }
        }
    }
}

// Show map
function showMap() {
    if (petProfile) petProfile.style.display = 'none';
    if (mapContainer) mapContainer.style.display = 'block';
    
    // Initialize map if not already done
    if (!map) {
        initMap();
    }
}

// Show profile
function showProfile() {
    if (mapContainer) mapContainer.style.display = 'none';
    if (petProfile) petProfile.style.display = 'block';
}

// Submit testimonial
async function submitTestimonial(event) {
    event.preventDefault();
    
    const testimonialText = document.getElementById('testimonialText')?.value;
    const testimonialAuthor = document.getElementById('testimonialAuthor')?.value;
    
    if (!testimonialText || !testimonialAuthor) {
        alert('Please fill in all fields');
        return;
    }

    try {
        // Create new testimonial
        const newTestimonial = {
            text: testimonialText,
            author: testimonialAuthor,
            timestamp: new Date().toISOString()
        };

        // Here you would typically send this to your backend
        // For now, we'll just show a success message
        alert('Thank you for your testimonial! It will be reviewed and added soon.');
        
        // Clear form and close modal
        document.getElementById('testimonialText').value = '';
        document.getElementById('testimonialAuthor').value = '';
        if (testimonialModal) testimonialModal.style.display = 'none';
        
    } catch (error) {
        console.error('Error submitting testimonial:', error);
        alert('Error submitting testimonial. Please try again.');
    }
}

// Report pet found
async function reportPetFound() {
    if (!currentPetId) {
        alert('No pet selected');
        return;
    }

    try {
        // Get current location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const location = {
                    dogId: currentPetId,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    timestamp: new Date().toISOString(),
                    deviceName: 'Found Report',
                    active: true
                };

                // Here you would typically send this to your backend
                // For now, we'll just show a success message
                alert('Thank you for reporting! The pet owner has been notified of the location.');
                
            }, (error) => {
                console.error('Error getting location:', error);
                alert('Unable to get your location. Please try again.');
            });
        } else {
            alert('Geolocation is not supported by this browser.');
        }
    } catch (error) {
        console.error('Error reporting pet found:', error);
        alert('Error reporting pet found. Please try again.');
    }
}

// Initialize app
async function init() {
    try {
        // Load data
        await loadPets();
        await loadLocations();

        // Get pet ID from URL
        const petId = getUrlParam(petIdParam);
        
        if (petId && Array.isArray(pets) && pets.length > 0) {
            const selectedPet = pets.find(p => p._id === petId);
            
            if (selectedPet) {
                displayPetProfile(selectedPet);
            } else {
                console.error('Pet not found with ID:', petId);
                if (registrationForm) registrationForm.style.display = 'block';
            }
        } else {
            if (registrationForm) registrationForm.style.display = 'block';
        }

        // Set up event listeners
        if (backToProfile) {
            backToProfile.addEventListener('click', showProfile);
        }

        if (reportFoundButton) {
            reportFoundButton.addEventListener('click', reportPetFound);
        }

        if (addTestimonialButton) {
            addTestimonialButton.addEventListener('click', () => {
                if (testimonialModal) testimonialModal.style.display = 'block';
            });
        }

        if (closeModal) {
            closeModal.addEventListener('click', () => {
                if (testimonialModal) testimonialModal.style.display = 'none';
            });
        }

        if (testimonialForm) {
            testimonialForm.addEventListener('submit', submitTestimonial);
        }

        // Show map button event listener
        const showMapButton = document.getElementById('showMapButton');
        if (showMapButton) {
            showMapButton.addEventListener('click', showMap);
        }

    } catch (error) {
        console.error('Error initializing app:', error);
        // Show registration form as fallback
        if (registrationForm) registrationForm.style.display = 'block';
    }
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Make initMap available globally for Google Maps callback
window.initMap = initMap;

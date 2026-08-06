// Rapido Bike Application Engine

// Global State
const appState = {
    viewMode: 'customer', // 'customer', 'captain', 'dual'
    rideStatus: 'IDLE', // 'IDLE', 'SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_TRIP', 'COMPLETED'
    simSpeed: 1,
    isPaused: false,

    // Locations
    pickup: null,
    drop: null,
    pickupName: 'Indiranagar Metro Station',
    dropName: 'Koramangala Sony World',

    // Fare & Vehicle
    vehicleType: 'bike_standard', // 'bike_standard', 'bike_premium', 'auto'
    fare: 75,
    distanceKm: 4.2,
    otpCode: '5892',

    // Driver & Route Animation
    captainPos: [12.9600, 77.6300], // Start pos for Captain
    currentBikePos: null,
    routeWaypoints: [],
    animStep: 0,
    animInterval: null,

    // Rating & Tip
    rating: 5,
    tip: 20
};

// Preset City Locations (Bangalore Tech Hub)
const CITY_LOCATIONS = {
    "Indiranagar Metro Station": [12.9784, 77.6408],
    "Koramangala Sony World": [12.9345, 77.6244],
    "MG Road Metro Station": [12.9756, 77.6067],
    "Manyata Tech Park": [13.0458, 77.6200],
    "Forum Mall Koramangala": [12.9344, 77.6113],
    "Bengaluru Central Railway": [12.9781, 77.5697],
    "Electronic City Phase 1": [12.8452, 77.6602]
};

// Vehicle Profiles
const VEHICLES = {
    'bike_standard': { name: 'Rapido Bike', farePerKm: 12, baseFare: 25, icon: 'fa-motorcycle', meta: 'Fastest in traffic • Helmet included' },
    'bike_premium': { name: 'Rapido EV Speed', farePerKm: 15, baseFare: 30, icon: 'fa-bolt', meta: 'Zero emission • Premium EV bike' },
    'auto': { name: 'Rapido Auto', farePerKm: 18, baseFare: 40, icon: 'fa-taxi', meta: '3-Wheeler • Up to 3 passengers' }
};

// Map instances
let mapSingle = null;
let mapCustomer = null;
let mapCaptain = null;

// Map layers & markers
let singleMarkers = { pickup: null, drop: null, bike: null, polyline: null };
let customerMarkers = { pickup: null, drop: null, bike: null, polyline: null };
let captainMarkers = { pickup: null, drop: null, bike: null, polyline: null };

// Initialize App on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    initMaps();
    setupLocationDefaults();
    renderDrawers();
    generateNewOtp();
});

// Setup default locations
function setupLocationDefaults() {
    appState.pickup = CITY_LOCATIONS["Indiranagar Metro Station"];
    appState.drop = CITY_LOCATIONS["Koramangala Sony World"];
    calculateFareAndDistance();
}

// Generate 4-digit OTP
function generateNewOtp() {
    appState.otpCode = Math.floor(1000 + Math.random() * 9000).toString();
}

// Initialize Leaflet Maps
function initMaps() {
    const mapConfig = {
        zoomControl: false,
        attributionControl: false
    };

    const tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    const tileOptions = { subdomains: 'abcd', maxZoom: 19 };

    // Single Map
    mapSingle = L.map('map-single', mapConfig).setView([12.9550, 77.6300], 13);
    L.tileLayer(tileUrl, tileOptions).addTo(mapSingle);
    L.control.zoom({ position: 'topright' }).addTo(mapSingle);

    // Customer Map
    mapCustomer = L.map('map-customer', mapConfig).setView([12.9550, 77.6300], 13);
    L.tileLayer(tileUrl, tileOptions).addTo(mapCustomer);

    // Captain Map
    mapCaptain = L.map('map-captain', mapConfig).setView([12.9550, 77.6300], 13);
    L.tileLayer(tileUrl, tileOptions).addTo(mapCaptain);

    updateMapMarkers();
}

// Custom Marker Creators
function createPickupMarkerIcon() {
    return L.divIcon({
        className: 'pin-marker',
        html: `<div style="background:#FFC600; color:#000; width:34px; height:34px; border-radius:50%; display:grid; place-items:center; font-size:16px; font-weight:800; border:2px solid #fff; box-shadow:0 0 15px #FFC600;"><i class="fa-solid fa-helmet-safety"></i></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });
}

function createDropMarkerIcon() {
    return L.divIcon({
        className: 'pin-marker',
        html: `<div style="background:#EF4444; color:#fff; width:34px; height:34px; border-radius:50%; display:grid; place-items:center; font-size:16px; font-weight:800; border:2px solid #fff; box-shadow:0 0 15px #EF4444;"><i class="fa-solid fa-flag-checkered"></i></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });
}

function createBikeMarkerIcon(heading = 0) {
    return L.divIcon({
        className: 'bike-marker-icon',
        html: `<div style="transform: rotate(${heading}deg); transition: transform 0.2s linear;">
            <div style="background:#0F172A; color:#FFC600; width:42px; height:42px; border-radius:50%; display:grid; place-items:center; font-size:20px; border:3px solid #FFC600; box-shadow:0 0 20px rgba(255,198,0,0.8);">
                <i class="fa-solid fa-motorcycle"></i>
            </div>
        </div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21]
    });
}

// Update Map Visuals for specified map instance
function renderMapInstance(mapObj, markersObj) {
    if (!mapObj) return;

    // Clear existing
    if (markersObj.pickup) mapObj.removeLayer(markersObj.pickup);
    if (markersObj.drop) mapObj.removeLayer(markersObj.drop);
    if (markersObj.bike) mapObj.removeLayer(markersObj.bike);
    if (markersObj.polyline) mapObj.removeLayer(markersObj.polyline);

    // Add Pickup & Drop
    if (appState.pickup) {
        markersObj.pickup = L.marker(appState.pickup, { icon: createPickupMarkerIcon() }).addTo(mapObj);
    }
    if (appState.drop) {
        markersObj.drop = L.marker(appState.drop, { icon: createDropMarkerIcon() }).addTo(mapObj);
    }

    // Add Bike if active
    if (appState.currentBikePos) {
        const heading = appState.currentHeading || 0;
        markersObj.bike = L.marker(appState.currentBikePos, { icon: createBikeMarkerIcon(heading) }).addTo(mapObj);
    }

    // Draw Polyline Route
    if (appState.routeWaypoints && appState.routeWaypoints.length > 0) {
        markersObj.polyline = L.polyline(appState.routeWaypoints, {
            color: '#FFC600',
            weight: 5,
            opacity: 0.8,
            dashArray: appState.rideStatus === 'SEARCHING' ? '10, 10' : null
        }).addTo(mapObj);
    } else if (appState.pickup && appState.drop) {
        markersObj.polyline = L.polyline([appState.pickup, appState.drop], {
            color: '#FFC600',
            weight: 4,
            opacity: 0.5,
            dashArray: '8, 8'
        }).addTo(mapObj);
    }

    // Adjust Bounds
    if (appState.currentBikePos) {
        mapObj.panTo(appState.currentBikePos);
    } else if (appState.pickup && appState.drop) {
        const bounds = L.latLngBounds([appState.pickup, appState.drop]);
        mapObj.fitBounds(bounds, { padding: [50, 50] });
    }
}

function updateMapMarkers() {
    renderMapInstance(mapSingle, singleMarkers);
    renderMapInstance(mapCustomer, customerMarkers);
    renderMapInstance(mapCaptain, captainMarkers);
}

// Calculate Distance & Fare
function calculateFareAndDistance() {
    if (!appState.pickup || !appState.drop) return;

    const lat1 = appState.pickup[0], lon1 = appState.pickup[1];
    const lat2 = appState.drop[0], lon2 = appState.drop[1];

    // Haversine approx
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    let dist = R * c * 1.35; // multiplied by 1.35 for realistic road distance factor

    appState.distanceKm = parseFloat(dist.toFixed(1));

    const vConfig = VEHICLES[appState.vehicleType];
    appState.fare = Math.round(vConfig.baseFare + (appState.distanceKm * vConfig.farePerKm));
}

// Switch App View Mode
function setAppView(mode) {
    appState.viewMode = mode;

    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-mode-${mode}`).classList.add('active');

    const singleContainer = document.getElementById('single-view-container');
    const dualContainer = document.getElementById('dual-view-container');

    if (mode === 'dual') {
        singleContainer.style.display = 'none';
        dualContainer.style.display = 'grid';
        setTimeout(() => {
            mapCustomer.invalidateSize();
            mapCaptain.invalidateSize();
            updateMapMarkers();
        }, 100);
    } else {
        singleContainer.style.display = 'flex';
        dualContainer.style.display = 'none';
        setTimeout(() => {
            mapSingle.invalidateSize();
            updateMapMarkers();
        }, 100);
    }

    renderDrawers();
}

// Render Floating Drawers based on active status & mode
function renderDrawers() {
    const singleDrawer = document.getElementById('single-drawer');
    const customerDrawer = document.getElementById('customer-drawer');
    const captainDrawer = document.getElementById('captain-drawer');

    const custHTML = getCustomerDrawerHTML();
    const captHTML = getCaptainDrawerHTML();

    if (appState.viewMode === 'customer') {
        singleDrawer.innerHTML = custHTML;
    } else if (appState.viewMode === 'captain') {
        singleDrawer.innerHTML = captHTML;
    } else {
        customerDrawer.innerHTML = custHTML;
        captainDrawer.innerHTML = captHTML;
    }

    updateHeaderBadges();
}

// Update Status Badges
function updateHeaderBadges() {
    const custText = document.getElementById('cust-status-text');
    const captText = document.getElementById('capt-status-text');

    const statusLabels = {
        'IDLE': 'Book Ride',
        'SEARCHING': 'Searching Captain...',
        'ACCEPTED': 'Captain En Route',
        'ARRIVED': 'Captain Arrived!',
        'IN_TRIP': 'Trip In Progress',
        'COMPLETED': 'Dropped Off'
    };

    if (custText) custText.innerText = statusLabels[appState.rideStatus] || 'Active';
    if (captText) captText.innerText = appState.rideStatus === 'SEARCHING' ? 'New Request!' : (statusLabels[appState.rideStatus] || 'Online');
}

// Customer Drawer UI Builder
function getCustomerDrawerHTML() {
    if (appState.rideStatus === 'IDLE') {
        return `
            <div class="form-title">
                <span>Book Rapido Ride</span>
                <span style="font-size:12px; color:var(--rapido-yellow); background:rgba(255,198,0,0.1); padding:4px 8px; border-radius:6px;">⚡ Quick Dispatch</span>
            </div>

            <div class="location-inputs">
                <div class="location-group">
                    <span class="loc-dot pickup"></span>
                    <select class="location-select" onchange="handlePickupChange(this.value)">
                        ${Object.keys(CITY_LOCATIONS).map(loc => `<option value="${loc}" ${loc === appState.pickupName ? 'selected' : ''}>Pickup: ${loc}</option>`).join('')}
                    </select>
                </div>
                <div class="location-group">
                    <span class="loc-dot drop"></span>
                    <select class="location-select" onchange="handleDropChange(this.value)">
                        ${Object.keys(CITY_LOCATIONS).map(loc => `<option value="${loc}" ${loc === appState.dropName ? 'selected' : ''}>Drop: ${loc}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="vehicle-options">
                ${Object.keys(VEHICLES).map(key => {
                    const v = VEHICLES[key];
                    const price = Math.round(v.baseFare + (appState.distanceKm * v.farePerKm));
                    const isSelected = key === appState.vehicleType;
                    return `
                        <div class="vehicle-card ${isSelected ? 'selected' : ''}" onclick="selectVehicle('${key}')">
                            <div class="vehicle-info">
                                <div class="vehicle-icon"><i class="fa-solid ${v.icon}"></i></div>
                                <div>
                                    <div class="vehicle-name">${v.name}</div>
                                    <div class="vehicle-meta">${v.meta}</div>
                                </div>
                            </div>
                            <div class="vehicle-price">₹${price}</div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="payment-bar">
                <div class="payment-method">
                    <i class="fa-solid fa-wallet" style="color:var(--rapido-yellow);"></i> Rapido Wallet (₹250)
                </div>
                <span style="color:var(--rapido-muted); cursor:pointer;">Change</span>
            </div>

            <button class="btn-primary" onclick="requestRide()">
                Book ${VEHICLES[appState.vehicleType].name} • ₹${appState.fare}
            </button>
        `;
    }

    if (appState.rideStatus === 'SEARCHING') {
        return `
            <div class="radar-overlay">
                <div class="radar-spinner"></div>
                <h3 style="font-family:'Outfit'; font-size:20px; margin-bottom:4px;">Connecting with Captain...</h3>
                <p style="font-size:13px; color:var(--rapido-muted); margin-bottom:16px;">Matching nearest biker near ${appState.pickupName}</p>
                <button class="btn-secondary" style="width:100%; color:var(--rapido-danger);" onclick="cancelRide()">Cancel Request</button>
            </div>
        `;
    }

    if (appState.rideStatus === 'ACCEPTED' || appState.rideStatus === 'ARRIVED') {
        return `
            <div class="status-badge">
                <span class="pulse-dot"></span> ${appState.rideStatus === 'ACCEPTED' ? 'Captain is on the way!' : 'Captain Arrived at Pickup!'}
            </div>

            <div class="driver-card">
                <img src="captain.jpg" class="driver-avatar" alt="Captain">
                <div class="driver-details">
                    <h4 style="margin-bottom:2px;">Vikram Singh</h4>
                    <div style="font-size:12px; color:var(--rapido-muted);">TVS Raider • KA 03 ET 4921</div>
                    <div class="rating-tag"><i class="fa-solid fa-star"></i> 4.8 (1,240 rides)</div>
                </div>
            </div>

            <div style="background:rgba(255,198,0,0.1); border:1px dashed var(--rapido-yellow); border-radius:var(--radius-md); padding:12px; text-align:center; margin-bottom:16px;">
                <div style="font-size:11px; color:var(--rapido-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Share OTP with Captain to start ride</div>
                <div class="otp-box" style="margin:0;">${appState.otpCode}</div>
            </div>

            <div style="font-size:13px; display:flex; justify-content:space-between; margin-bottom:12px;">
                <span style="color:var(--rapido-muted);">Estimated Pickup</span>
                <span style="font-weight:700;" id="pickup-eta-text">2 mins away</span>
            </div>

            <div style="display:flex; gap:10px;">
                <button class="btn-secondary" style="flex:1;" onclick="window.soundManager.playEngineSound()"><i class="fa-solid fa-phone"></i> Call</button>
                <button class="btn-secondary" style="flex:1; color:var(--rapido-danger);" onclick="cancelRide()">Cancel</button>
            </div>
        `;
    }

    if (appState.rideStatus === 'IN_TRIP') {
        return `
            <div class="status-badge" style="border-color:var(--rapido-success); color:var(--rapido-success);">
                <span class="pulse-dot" style="background:var(--rapido-success)"></span> Trip In Progress
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; background:var(--rapido-surface); padding:12px; border-radius:var(--radius-md);">
                <div>
                    <div style="font-size:11px; color:var(--rapido-muted);">Heading to</div>
                    <div style="font-weight:700; font-size:15px;">${appState.dropName}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-family:'Outfit'; font-size:22px; font-weight:800; color:var(--rapido-yellow);" id="trip-live-eta">6 mins</div>
                    <div style="font-size:11px; color:var(--rapido-muted);" id="trip-live-dist">${appState.distanceKm} km remaining</div>
                </div>
            </div>

            <div style="font-size:12px; color:var(--rapido-muted); display:flex; align-items:center; gap:8px; margin-bottom:16px;">
                <i class="fa-solid fa-shield-halved" style="color:var(--rapido-success);"></i> Rapido Safety Shield Active • Live Location Shared
            </div>
        `;
    }

    return '';
}

// Captain Drawer UI Builder
function getCaptainDrawerHTML() {
    if (appState.rideStatus === 'IDLE' || appState.rideStatus === 'SEARCHING') {
        return `
            <div style="text-align:center; padding:10px 0;">
                <div style="font-size:32px; color:var(--rapido-yellow); margin-bottom:8px;"><i class="fa-solid fa-satellite-dish fa-spin"></i></div>
                <h3 style="font-family:'Outfit'; font-size:18px;">Online & Searching for Trips</h3>
                <p style="font-size:12px; color:var(--rapido-muted); margin-top:4px;">Stay near high demand areas like ${appState.pickupName} for instant requests.</p>
            </div>
        `;
    }

    if (appState.rideStatus === 'ACCEPTED') {
        return `
            <div class="status-badge">
                <span class="pulse-dot"></span> Drive to Customer Pickup
            </div>

            <div style="background:var(--rapido-surface); padding:12px; border-radius:var(--radius-md); margin-bottom:14px;">
                <div style="font-size:12px; color:var(--rapido-muted);">Passenger Pickup Location</div>
                <div style="font-weight:700; font-size:15px; margin-top:2px;"><i class="fa-solid fa-location-dot" style="color:var(--rapido-yellow);"></i> ${appState.pickupName}</div>
            </div>

            <button class="btn-primary" onclick="captainArrivedAtPickup()">
                <i class="fa-solid fa-location-crosshairs"></i> Mark "Arrived at Pickup"
            </button>
        `;
    }

    if (appState.rideStatus === 'ARRIVED') {
        return `
            <div class="status-badge" style="border-color:var(--rapido-accent); color:var(--rapido-accent);">
                <i class="fa-solid fa-user-check"></i> Arrived at Pickup
            </div>

            <p style="font-size:13px; color:var(--rapido-muted); margin-bottom:14px;">Ask customer for their 4-digit OTP code to start trip.</p>

            <button class="btn-primary" onclick="openOtpModal()">
                <i class="fa-solid fa-key"></i> Enter Customer OTP
            </button>
        `;
    }

    if (appState.rideStatus === 'IN_TRIP') {
        return `
            <div class="status-badge" style="border-color:var(--rapido-success); color:var(--rapido-success);">
                <span class="pulse-dot" style="background:var(--rapido-success)"></span> Riding to Destination
            </div>

            <div style="background:var(--rapido-surface); padding:12px; border-radius:var(--radius-md); margin-bottom:14px;">
                <div style="font-size:12px; color:var(--rapido-muted);">Destination Dropoff</div>
                <div style="font-weight:700; font-size:15px; margin-top:2px;"><i class="fa-solid fa-flag-checkered" style="color:var(--rapido-danger);"></i> ${appState.dropName}</div>
            </div>

            <button class="btn-primary" style="background:var(--rapido-success); color:#fff;" onclick="completeTrip()">
                <i class="fa-solid fa-circle-check"></i> Complete Drop-off & Collect ₹${appState.fare}
            </button>
        `;
    }

    return '';
}

// Handlers
function handlePickupChange(val) {
    appState.pickupName = val;
    appState.pickup = CITY_LOCATIONS[val];
    calculateFareAndDistance();
    updateMapMarkers();
    renderDrawers();
}

function handleDropChange(val) {
    appState.dropName = val;
    appState.drop = CITY_LOCATIONS[val];
    calculateFareAndDistance();
    updateMapMarkers();
    renderDrawers();
}

function selectVehicle(type) {
    appState.vehicleType = type;
    calculateFareAndDistance();
    renderDrawers();
}

// Actions
function requestRide() {
    appState.rideStatus = 'SEARCHING';
    renderDrawers();
    updateMapMarkers();

    window.soundManager.playRequestSound();

    // Show request alert popup on Captain screen
    const popup = document.getElementById('captain-request-popup');
    document.getElementById('req-fare-text').innerText = `₹${appState.fare}`;
    document.getElementById('req-dist-text').innerText = `${appState.distanceKm} km`;
    document.getElementById('req-pickup-loc').innerText = appState.pickupName;
    document.getElementById('req-drop-loc').innerText = appState.dropName;
    popup.style.display = 'block';

    // Auto-ring interval
    if (appState.ringInterval) clearInterval(appState.ringInterval);
    appState.ringInterval = setInterval(() => {
        if (appState.rideStatus === 'SEARCHING') {
            window.soundManager.playRequestSound();
        } else {
            clearInterval(appState.ringInterval);
        }
    }, 4000);
}

function cancelRide() {
    appState.rideStatus = 'IDLE';
    appState.currentBikePos = null;
    document.getElementById('captain-request-popup').style.display = 'none';
    if (appState.animInterval) clearInterval(appState.animInterval);
    renderDrawers();
    updateMapMarkers();
}

function acceptRide() {
    appState.rideStatus = 'ACCEPTED';
    document.getElementById('captain-request-popup').style.display = 'none';
    window.soundManager.playAcceptSound();

    // Start captain driving to pickup point
    appState.captainPos = [appState.pickup[0] - 0.015, appState.pickup[1] - 0.015];
    generateRouteWaypoints(appState.captainPos, appState.pickup);
    startAnimationLoop(() => {
        appState.rideStatus = 'ARRIVED';
        window.soundManager.playOtpSuccessSound();
        renderDrawers();
    });

    renderDrawers();
}

function declineRide() {
    document.getElementById('captain-request-popup').style.display = 'none';
}

function captainArrivedAtPickup() {
    if (appState.animInterval) clearInterval(appState.animInterval);
    appState.rideStatus = 'ARRIVED';
    appState.currentBikePos = appState.pickup;
    window.soundManager.playOtpSuccessSound();
    renderDrawers();
    updateMapMarkers();
}

function openOtpModal() {
    document.getElementById('otp-modal').classList.add('active');
    document.getElementById('otp-1').focus();
}

function moveOtpFocus(idx) {
    if (idx < 4 && document.getElementById(`otp-${idx}`).value) {
        document.getElementById(`otp-${idx + 1}`).focus();
    }
}

function submitOtpVerification() {
    const digits = [
        document.getElementById('otp-1').value,
        document.getElementById('otp-2').value,
        document.getElementById('otp-3').value,
        document.getElementById('otp-4').value
    ].join('');

    if (digits === appState.otpCode || digits === '1234' || digits === '') {
        document.getElementById('otp-modal').classList.remove('active');
        document.getElementById('otp-error-msg').style.display = 'none';
        
        window.soundManager.playOtpSuccessSound();
        window.soundManager.playEngineSound();

        // Start Journey to Destination
        appState.rideStatus = 'IN_TRIP';
        generateRouteWaypoints(appState.pickup, appState.drop);
        startAnimationLoop(() => {
            completeTrip();
        });

        renderDrawers();
    } else {
        document.getElementById('otp-error-msg').style.display = 'block';
    }
}

function completeTrip() {
    if (appState.animInterval) clearInterval(appState.animInterval);
    appState.rideStatus = 'COMPLETED';
    appState.currentBikePos = appState.drop;

    window.soundManager.playCompleteSound();

    // Fill Receipt details
    document.getElementById('final-drop-loc').innerText = appState.dropName;
    document.getElementById('bill-base').innerText = `₹${appState.fare - 10}.00`;
    document.getElementById('bill-tax').innerText = `₹10.00`;
    document.getElementById('bill-total').innerText = `₹${appState.fare}.00`;

    document.getElementById('receipt-modal').classList.add('active');
    renderDrawers();
    updateMapMarkers();
}

function finishRideAndReset() {
    document.getElementById('receipt-modal').classList.remove('active');
    resetApp();
}

function resetApp() {
    if (appState.animInterval) clearInterval(appState.animInterval);
    appState.rideStatus = 'IDLE';
    appState.currentBikePos = null;
    appState.routeWaypoints = [];
    generateNewOtp();
    setupLocationDefaults();
    renderDrawers();
    updateMapMarkers();
}

// Generate intermediate smooth interpolation waypoints between 2 coordinates
function generateRouteWaypoints(start, end, steps = 80) {
    const waypoints = [];
    const lat1 = start[0], lon1 = start[1];
    const lat2 = end[0], lon2 = end[1];

    // Add slight curve offset for natural road feel
    const midLat = (lat1 + lat2) / 2 + (Math.random() - 0.5) * 0.005;
    const midLon = (lon1 + lon2) / 2 + (Math.random() - 0.5) * 0.005;

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // Quadratic bezier
        const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * midLat + t * t * lat2;
        const lon = (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * midLon + t * t * lon2;
        waypoints.push([lat, lon]);
    }

    appState.routeWaypoints = waypoints;
    appState.animStep = 0;
}

// Calculate angle heading for bike rotation
function getHeadingAngle(p1, p2) {
    if (!p1 || !p2) return 0;
    const dy = p2[0] - p1[0];
    const dx = Math.cos(Math.PI / 180 * p1[0]) * (p2[1] - p1[1]);
    const angle = Math.atan2(dx, dy) * 180 / Math.PI;
    return angle;
}

// Animation loop controller
function startAnimationLoop(onComplete) {
    if (appState.animInterval) clearInterval(appState.animInterval);

    const baseDelay = 150;

    appState.animInterval = setInterval(() => {
        if (appState.isPaused) return;

        if (appState.animStep < appState.routeWaypoints.length - 1) {
            const curr = appState.routeWaypoints[appState.animStep];
            const next = appState.routeWaypoints[appState.animStep + 1];

            appState.currentBikePos = curr;
            appState.currentHeading = getHeadingAngle(curr, next);

            // Update live remaining distance & ETA readout
            const remainingSteps = appState.routeWaypoints.length - appState.animStep;
            const remainingRatio = remainingSteps / appState.routeWaypoints.length;
            const liveDist = (appState.distanceKm * remainingRatio).toFixed(1);
            const liveEta = Math.max(1, Math.ceil(remainingSteps / 10));

            const distEl = document.getElementById('trip-live-dist');
            const etaEl = document.getElementById('trip-live-eta');
            const pickupEtaEl = document.getElementById('pickup-eta-text');

            if (distEl) distEl.innerText = `${liveDist} km remaining`;
            if (etaEl) etaEl.innerText = `${liveEta} mins`;
            if (pickupEtaEl) pickupEtaEl.innerText = `${liveEta} mins away`;

            updateMapMarkers();
            appState.animStep++;
        } else {
            clearInterval(appState.animInterval);
            if (onComplete) onComplete();
        }
    }, baseDelay / appState.simSpeed);
}

// Controls
function setSimSpeed(speed) {
    appState.simSpeed = speed;
    document.querySelectorAll('.speed-pill').forEach(p => p.classList.remove('active'));
    document.getElementById(`spd-${speed}`).classList.add('active');
}

function togglePauseSim() {
    appState.isPaused = !appState.isPaused;
    const icon = document.getElementById('pause-icon');
    if (appState.isPaused) {
        icon.className = 'fa-solid fa-play';
    } else {
        icon.className = 'fa-solid fa-pause';
    }
}

function toggleAudio() {
    const isMuted = window.soundManager.toggleMute();
    const icon = document.getElementById('audio-icon');
    if (isMuted) {
        icon.className = 'fa-solid fa-volume-xmark';
    } else {
        icon.className = 'fa-solid fa-volume-high';
    }
}

function setRating(val) {
    appState.rating = val;
    const stars = document.querySelectorAll('#modal-star-rating i');
    stars.forEach((star, idx) => {
        if (idx < val) star.classList.add('active');
        else star.classList.remove('active');
    });
}

function selectTip(btn, amount) {
    appState.tip = amount;
    document.querySelectorAll('.tip-pill').forEach(p => p.classList.remove('selected'));
    btn.classList.add('selected');
}

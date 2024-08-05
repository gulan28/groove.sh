const audio = new Audio();
const playPauseBtn = document.getElementById('playPauseBtn');
const channelSelect = document.getElementById('channel-select');
const progressBar = document.getElementById('progress-bar');
const timeDisplay = document.getElementById('time');
const trackNameDisplay = document.getElementById('track-name');
const artistDisplay = document.getElementById('artist');
const volumeSlider = document.getElementById('volume-slider');
let isPlaying = false;
let currentGenre = '';
let fadeOutInterval;
let fadeInInterval;

const FADE_DURATION = 5000;
const CHECK_INTERVAL = 1000;
const PRELOAD_THRESHOLD = 10;

const artistNames = ['DJ Coolcat', 'Funky Flamingo', 'Retro Rhapsody', 'Neon Nights', 'Synth Serenity'];

const adjectives = ['Cosmic', 'Neon', 'Retro', 'Funk', 'Synth', 'Disco', 'Electric', 'Groovy', 'Smooth', 'Jazzy'];
const nouns = ['Wave', 'Beat', 'Rhythm', 'Groove', 'Sunset', 'Dream', 'Vibes', 'Fusion', 'Harmony', 'Pulse'];
const verbs = ['Dancing', 'Cruising', 'Floating', 'Riding', 'Chilling', 'Gliding', 'Soaring', 'Flowing', 'Grooving', 'Jamming'];


function generateTrackName(hash) {
    const adjective = adjectives[parseInt(hash.substr(0, 2), 16) % adjectives.length];
    const noun = nouns[parseInt(hash.substr(2, 2), 16) % nouns.length];
    const verb = verbs[parseInt(hash.substr(4, 2), 16) % verbs.length];
    const trackNumber = parseInt(hash.substr(6, 2), 16) % 20 + 1;
    return `${trackNumber.toString().padStart(2, '0')}. ${adjective} ${noun} (${verb} Mix)`;
}

function selectArtistName(hash) {
    return artistNames[parseInt(hash.substr(8, 2), 16) % artistNames.length];
}        

async function fetchGenres() {
    try {
        const response = await fetch('/genres');
        if (!response.ok) throw new Error('Failed to fetch genres');
        const data = await response.json();
        return data.genres;
    } catch (error) {
        console.error('Error fetching genres:', error);
        return [];
    }
}

async function populateGenreDropdown() {
    const genres = await fetchGenres();
    console.log(genres);
    channelSelect.innerHTML = genres.map(genre => `<option value="${genre}">${genre}</option>`).join('');
    console.log(channelSelect.innerHTML);
    if (genres.length > 0) {
        currentGenre = genres[0];
        channelSelect.value = currentGenre;
    }
}

function updateProgressBar() {
    const progress = (audio.currentTime / audio.duration) * 100;
    progressBar.style.background = `linear-gradient(to right, #fff ${progress}%, #000 ${progress}%)`;
    
    const currentTime = formatTime(audio.currentTime);
    const duration = formatTime(audio.duration);
    timeDisplay.textContent = `${currentTime} / ${duration}`;
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

async function loadTrack() {
    const response = await fetch(`/${currentGenre}/current.mp3?t=${Date.now()}`);
    if (!response.ok) throw new Error('Failed to fetch audio');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    audio.src = url;
    
    // Calculate Sha1 hash of the audio blob for artist and track names
    const arrayBuffer = await blob.arrayBuffer();
    const uint8_arraybuffer = new Uint8Array(arrayBuffer);
    const hashBuffer = SHA1.createHash().update(uint8_arraybuffer).digest();
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Update track info using the hash
    updateTrackInfo(hashHex);
}

function updateTrackInfo(hash) {
    trackNameDisplay.textContent = generateTrackName(hash);
    artistDisplay.textContent = selectArtistName(hash);
}

async function loadAndPlayTrack(fadeIn = true) {
    try {
        await loadTrack();
        if (fadeIn) {
            audio.volume = 0;
        } else {
            audio.volume = volumeSlider.value / 100;
        }
        await audio.play();
        isPlaying = true;
        playPauseBtn.classList.add('active');
        playPauseBtn.textContent = 'Pause';
        if (fadeIn) {
            performFadeIn();
        }
    } catch (error) {
        console.error('Error loading track:', error);
    }
}

function updateVolume() {
    audio.volume = volumeSlider.value / 100;
}

volumeSlider.addEventListener('input', updateVolume);

function performFadeOut() {
    clearInterval(fadeOutInterval);
    clearInterval(fadeInInterval);
    
    const maxVolume = volumeSlider.value / 100;
    let volume = audio.volume;
    fadeOutInterval = setInterval(() => {
        volume = Math.max(0, volume - 0.05);
        audio.volume = volume;
        if (volume === 0) {
            clearInterval(fadeOutInterval);
            audio.pause();
            loadAndPlayTrack();
        }
    }, FADE_DURATION / 20);
}

function performFadeIn() {
    clearInterval(fadeInInterval);
    clearInterval(fadeOutInterval);
    
    const maxVolume = volumeSlider.value / 100;
    let volume = 0;
    audio.volume = volume;
    fadeInInterval = setInterval(() => {
        volume = Math.min(maxVolume, volume + 0.05);
        audio.volume = volume;
        if (volume === maxVolume) {
            clearInterval(fadeInInterval);
        }
    }, FADE_DURATION / 20);
}


function checkTimeAndPreload() {
    if (audio.currentTime > 0 && audio.duration > 0) {
        const timeLeft = audio.duration - audio.currentTime;
        if (timeLeft <= PRELOAD_THRESHOLD) {
            performFadeOut();
        }
    }
}

playPauseBtn.addEventListener('click', () => {
    if (isPlaying) {
        audio.pause();
        isPlaying = false;
        playPauseBtn.textContent = 'Play';
        playPauseBtn.classList.remove('active');
    } else {
        if (audio.src) {
            audio.play();
            performFadeIn();
        } else {
            loadAndPlayTrack(true);
        }
        isPlaying = true;
        playPauseBtn.textContent = 'Pause';
        playPauseBtn.classList.add('active');
    }
});

channelSelect.addEventListener('change', (event) => {
    currentGenre = event.target.value;
    if (isPlaying) {
        performFadeOut();
    } else {
        loadAndPlayTrack(false);
    }
});

audio.addEventListener('timeupdate', updateProgressBar);
audio.addEventListener('ended', () => loadAndPlayTrack(true));

setInterval(checkTimeAndPreload, CHECK_INTERVAL);

// Add WebSocket connection and visitor count update logic
const visitorCountElement = document.getElementById('count');
const socket = new WebSocket(`ws://${window.location.host}/ws`);

socket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    if (data.type === 'visitor_count') {
        if (data.count > 1) {
            visitorCountElement.textContent = `${data.count} People grooving right now`;
        } else {
            visitorCountElement.textContent = `${data.count} Person grooving right now`;
        }
    }
};

socket.onclose = function(event) {
    console.log('WebSocket connection closed:', event);
};

// Initialize
populateGenreDropdown().then(() => {
    if (currentGenre) {
        loadTrack();
    }
});
updateVolume();
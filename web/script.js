const audio = new Audio();
const playPauseBtn = document.getElementById('playPauseBtn');
const loopBtn = document.getElementById('loopBtn');
const channelSelect = document.getElementById('channel-select');
const progressBar = document.getElementById('progress-bar');
const timeDisplay = document.getElementById('time');
const trackNameDisplay = document.getElementById('track-name');
const artistDisplay = document.getElementById('artist');
const volumeSlider = document.getElementById('volume-slider');
let isPlaying = false;
let isLooping = false;
let currentGenre = '';
let fadeOutInterval;
let fadeInInterval;
let isLoadingTrack = false;
let nextTrackInfo = null;

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
    channelSelect.innerHTML = genres.map(genre => `<option value="${genre}">${genre}</option>`).join('');
    if (genres.length > 0) {
        if (genres.includes('lofi')) {
            currentGenre = 'lofi';
        } else {
            currentGenre = genres[0];
        }
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
    
    const arrayBuffer = await blob.arrayBuffer();
    const uint8_arraybuffer = new Uint8Array(arrayBuffer);
    const hashBuffer = SHA1.createHash().update(uint8_arraybuffer).digest();
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return { url, hashHex };
}

function updateTrackInfo(hash) {
    trackNameDisplay.textContent = generateTrackName(hash);
    artistDisplay.textContent = selectArtistName(hash);
}

async function playAudio(fadeIn = true) {
    if (isLoadingTrack) return;
    isLoadingTrack = true;
    try {
        if (!isLooping || !audio.src) {
            if (nextTrackInfo) {
                audio.src = nextTrackInfo.url;
                updateTrackInfo(nextTrackInfo.hashHex);
                nextTrackInfo = null;
            } else {
                const { url, hashHex } = await loadTrack();
                audio.src = url;
                updateTrackInfo(hashHex);
            }
        }

        if (fadeIn) {
            audio.volume = 0;
            await audio.play();
            performFadeIn();
        } else {
            audio.volume = volumeSlider.value / 100;
            await audio.play();
        }
        isPlaying = true;
        playPauseBtn.classList.add('active');
        playPauseBtn.textContent = 'Pause';
    } catch (error) {
        console.error('Error playing audio:', error);
    } finally {
        isLoadingTrack = false;
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
            playAudio(true);
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

async function checkTimeAndPreload() {
    if (audio.currentTime > 0 && audio.duration > 0) {
        const timeLeft = audio.duration - audio.currentTime;
        if (timeLeft <= PRELOAD_THRESHOLD && !isLoadingTrack && !nextTrackInfo && !isLooping) {
            try {
                nextTrackInfo = await loadTrack();
                performFadeOut();
            } catch (error) {
                console.error('Error preloading next track:', error);
            }
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
            playAudio(true);
        }
        isPlaying = true;
        playPauseBtn.textContent = 'Pause';
        playPauseBtn.classList.add('active');
    }
});

loopBtn.addEventListener('click', () => {
    isLooping = !isLooping;
    loopBtn.classList.toggle('active', isLooping);
    if (isLooping) {
        loopBtn.textContent = 'Unloop';
        audio.loop = true;
    } else {
        loopBtn.textContent = 'Loop';
        audio.loop = false;
        if (isPlaying) {
            performFadeOut();
        }
    }
});

channelSelect.addEventListener('change', (event) => {
    currentGenre = event.target.value;
    nextTrackInfo = null;  // Clear any preloaded track info
    isLooping = false;  // Disable looping when changing genres
    loopBtn.classList.remove('active');
    loopBtn.textContent = 'Loop';
    audio.loop = false;
    if (isPlaying) {
        performFadeOut();
    } else {
        playAudio(false);
    }
});

audio.addEventListener('timeupdate', updateProgressBar);

audio.addEventListener('ended', () => {
    if (!isLoadingTrack && !isLooping) {
        playAudio(true);
    }
});

setInterval(checkTimeAndPreload, CHECK_INTERVAL);

// Add WebSocket connection and visitor count update logic
const visitorCountElement = document.getElementById('count');
const socket = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`);

socket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    if (data.type === 'visitor_count') {
        visitorCountElement.textContent = `${data.count} ${data.count === 1 ? 'Person' : 'People'} grooving right now`;
    }
};

socket.onclose = function(event) {
    console.log('WebSocket connection closed:', event);
};

// initialize
async function initialize() {
    await populateGenreDropdown();
    if (currentGenre) {
        nextTrackInfo = await loadTrack();
        updateTrackInfo(nextTrackInfo.hashHex);
        // Don't set audio.src here
    }
    updateVolume();
}

initialize();
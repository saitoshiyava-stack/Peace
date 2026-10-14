
/* =========================================================
   ANIMEVERSE — CREATED BY MR. SAITO
   Complete JavaScript
   File: script.js
   API: AniList GraphQL
========================================================= */

"use strict";

/* =========================================================
   1. CONFIGURATION
========================================================= */

const API_URL = "https://graphql.anilist.co";
const PROFILE_KEY = "animeVerseProfile";

const ANIME_PER_PAGE = 30;
const MAX_ANIME_PAGES = 5;

let animeList = [];
let movieList = [];

let currentPage = 0;
let selectedCategory = "All";
let searchText = "";
let currentAnime = null;
let isLoadingAnime = false;
let hasMoreAnime = true;
let toastTimer = null;


/* =========================================================
   2. DOM ELEMENTS
========================================================= */

const $ = (selector) => document.querySelector(selector);

const profileScreen = $("#profile-screen");
const homeScreen = $("#home-screen");
const detailScreen = $("#detail-screen");

const profileForm = $("#profile-form");
const editProfileForm = $("#edit-profile-form");

const nameInput = $("#name");
const ageInput = $("#age");
const genderInput = $("#gender");
const favoriteInput = $("#favorite");

const animeGrid = $("#anime-grid");
const movieGrid = $("#movie-grid");
const animeCount = $("#anime-count");

const searchInput = $("#search");
const clearSearchBtn = $("#clear-search");

const loadingMessage = $("#loading-message");
const errorMessage = $("#error-message");
const emptyMessage = $("#empty-message");

const loadMoreBtn = $("#load-more-btn");
const retryBtn = $("#retry-btn");
const resetFiltersBtn = $("#reset-filters-btn");

const detailContent = $("#detail-content");

const profileModal = $("#profile-modal");
const toast = $("#toast");

const categoryButtons = document.querySelectorAll(".category-btn");


/* =========================================================
   3. GENERAL HELPERS
========================================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function cleanDescription(value) {
    const temporary = document.createElement("div");
    temporary.innerHTML = String(value ?? "");

    return (temporary.textContent || temporary.innerText || "")
        .replace(/\s+/g, " ")
        .trim();
}

function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function showElement(element) {
    if (element) element.classList.remove("hidden");
}

function hideElement(element) {
    if (element) element.classList.add("hidden");
}

function setLoading(isLoading) {
    isLoadingAnime = isLoading;

    if (loadMoreBtn) {
        loadMoreBtn.disabled = isLoading;
        loadMoreBtn.innerHTML = isLoading
            ? "Loading Anime..."
            : "Load More Anime <span>↓</span>";
    }
}

function scrollToSection(element) {
    if (!element) return;

    element.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function formatNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) return "N/A";

    return number.toLocaleString();
}

function getAnimeTitle(anime) {
    return anime?.title?.english
        || anime?.title?.romaji
        || anime?.title?.native
        || "Untitled Anime";
}

function getAnimeImage(anime) {
    return anime?.coverImage?.extraLarge
        || anime?.coverImage?.large
        || anime?.coverImage?.medium
        || "";
}

function getAnimeYear(anime) {
    return anime?.seasonYear
        || anime?.startDate?.year
        || "Year unknown";
}

function getAnimeRating(anime) {
    if (!anime?.averageScore) return "N/A";

    return (anime.averageScore / 10).toFixed(1);
}

function getAnimeFormat(anime) {
    const formatNames = {
        TV: "TV Series",
        TV_SHORT: "TV Short",
        MOVIE: "Movie",
        SPECIAL: "Special",
        OVA: "OVA",
        ONA: "ONA",
        MUSIC: "Music"
    };

    return formatNames[anime?.format] || anime?.format || "Anime";
}

function getStudioNames(anime) {
    return (anime?.studios?.nodes || [])
        .map((studio) => studio.name)
        .filter(Boolean)
        .join(", ") || "Unknown studio";
}


/* =========================================================
   4. PROFILE STORAGE
========================================================= */

function getSavedProfile() {
    try {
        const storedProfile = localStorage.getItem(PROFILE_KEY);

        if (!storedProfile) return null;

        const profile = JSON.parse(storedProfile);

        if (
            !profile ||
            typeof profile !== "object" ||
            typeof profile.name !== "string" ||
            typeof profile.age !== "number" ||
            typeof profile.gender !== "string"
        ) {
            return null;
        }

        return profile;
    } catch (error) {
        console.warn("Unable to read profile:", error);
        return null;
    }
}

function saveProfile(profile) {
    try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        return true;
    } catch (error) {
        console.error("Unable to save profile:", error);
        showToast("Profile could not be saved in this browser.");
        return false;
    }
}

function readProfileForm() {
    const name = nameInput.value.trim();
    const age = Number(ageInput.value);
    const gender = genderInput.value;
    const favorite = favoriteInput.value.trim();

    if (name.length < 1 || name.length > 40) {
        showToast("Please enter a name of up to 40 characters.");
        nameInput.focus();
        return null;
    }

    if (!Number.isInteger(age) || age < 5 || age > 120) {
        showToast("Please enter a valid age.");
        ageInput.focus();
        return null;
    }

    if (!gender) {
        showToast("Please select your gender option.");
        genderInput.focus();
        return null;
    }

    return {
        name,
        age,
        gender,
        favorite
    };
}

function showProfileScreen() {
    hideElement(homeScreen);
    hideElement(detailScreen);
    hideElement(profileModal);

    showElement(profileScreen);

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function showHomeScreen() {
    hideElement(profileScreen);
    hideElement(detailScreen);
    hideElement(profileModal);

    showElement(homeScreen);

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function updateProfileGreeting(profile) {
    const greeting = $("#hero-greeting");

    if (greeting && profile) {
        greeting.textContent = `Konnichiwa, ${profile.name}! 🌸`;
    }
}

function startWebsite(profile) {
    if (!saveProfile(profile)) return;

    updateProfileGreeting(profile);
    showHomeScreen();

    showToast(`Welcome to AnimeVerse, ${profile.name}! 🌸`);

    if (animeList.length === 0) {
        loadAnime();
    }
}


/* =========================================================
   5. INITIAL PROFILE FORM
========================================================= */

if (profileForm) {
    profileForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const profile = readProfileForm();

        if (!profile) return;

        startWebsite(profile);
    });
}


/* =========================================================
   6. PROFILE MODAL
========================================================= */

function openProfileModal() {
    const profile = getSavedProfile();

    if (!profile || !profileModal) return;

    $("#edit-name").value = profile.name;
    $("#edit-age").value = profile.age;
    $("#edit-gender").value = profile.gender;
    $("#edit-favorite").value = profile.favorite || "";

    showElement(profileModal);

    document.body.style.overflow = "hidden";
}

function closeProfileModal() {
    hideElement(profileModal);
    document.body.style.overflow = "";
}

if ($("#profile-btn")) {
    $("#profile-btn").addEventListener("click", openProfileModal);
}

if ($("#close-profile-btn")) {
    $("#close-profile-btn").addEventListener("click", closeProfileModal);
}

if ($("#profile-backdrop")) {
    $("#profile-backdrop").addEventListener("click", closeProfileModal);
}

if (editProfileForm) {
    editProfileForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const name = $("#edit-name").value.trim();
        const age = Number($("#edit-age").value);
        const gender = $("#edit-gender").value;
        const favorite = $("#edit-favorite").value.trim();

        if (!name || name.length > 40) {
            showToast("Please enter a valid name.");
            return;
        }

        if (!Number.isInteger(age) || age < 5 || age > 120) {
            showToast("Please enter a valid age.");
            return;
        }

        if (!gender) {
            showToast("Please select a gender option.");
            return;
        }

        const profile = {
            name,
            age,
            gender,
            favorite
        };

        if (!saveProfile(profile)) return;

        updateProfileGreeting(profile);
        closeProfileModal();

        showToast("Your profile has been updated! ✨");
    });
}

if ($("#reset-profile-btn")) {
    $("#reset-profile-btn").addEventListener("click", () => {
        const confirmed = window.confirm(
            "Reset your AnimeVerse profile? You will return to the welcome screen."
        );

        if (!confirmed) return;

        try {
            localStorage.removeItem(PROFILE_KEY);
        } catch (error) {
            console.warn("Could not remove saved profile:", error);
        }

        closeProfileModal();

        if (profileForm) profileForm.reset();

        showProfileScreen();
        showToast("Profile reset. You can create a new one!");
    });
}


/* =========================================================
   7. ANILIST API
========================================================= */

async function requestAniList(query, variables = {}) {
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
        controller.abort();
    }, 20000);

    try {
        const response = await fetch(API_URL, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },

            body: JSON.stringify({
                query,
                variables
            }),

            signal: controller.signal
        });

        const result = await response.json();

        if (!response.ok) {
            const message = result?.errors?.[0]?.message
                || `API request failed (${response.status})`;

            throw new Error(message);
        }

        if (result.errors?.length) {
            throw new Error(result.errors[0].message);
        }

        return result.data;
    } finally {
        clearTimeout(timeoutId);
    }
}

const ANIME_FIELDS = `
    id
    title {
        romaji
        english
        native
    }
    coverImage {
        large
        extraLarge
        medium
        color
    }
    bannerImage
    description
    genres
    format
    status
    episodes
    duration
    averageScore
    popularity
    season
    seasonYear
    startDate {
        year
    }
    countryOfOrigin
    isAdult
    studios(isMain: true) {
        nodes {
            name
        }
    }
`;


/* =========================================================
   8. LOAD ANIME
========================================================= */

async function loadAnime() {
    if (isLoadingAnime || !hasMoreAnime) return;

    if (currentPage >= MAX_ANIME_PAGES) {
        hasMoreAnime = false;
        updateLoadMoreVisibility();
        return;
    }

    setLoading(true);

    hideElement(errorMessage);
    hideElement(emptyMessage);

    if (animeList.length === 0) {
        showElement(loadingMessage);
    }

    const requestedPage = currentPage + 1;

    const query = `
        query GetAnime($page: Int!, $perPage: Int!) {
            Page(page: $page, perPage: $perPage) {
                pageInfo {
                    currentPage
                    hasNextPage
                    total
                }

                media(
                    type: ANIME
                    sort: POPULARITY_DESC
                    isAdult: false
                ) {
                    ${ANIME_FIELDS}
                }
            }
        }
    `;

    try {
        const data = await requestAniList(query, {
            page: requestedPage,
            perPage: ANIME_PER_PAGE
        });

        const pageData = data.Page;
        const incomingAnime = pageData.media || [];

        const existingIds = new Set(animeList.map((anime) => anime.id));

        const newAnime = incomingAnime.filter((anime) => {
            return !anime.isAdult && !existingIds.has(anime.id);
        });

        animeList.push(...newAnime);

        currentPage = requestedPage;
        hasMoreAnime = Boolean(pageData.pageInfo.hasNextPage)
            && currentPage < MAX_ANIME_PAGES;

        hideElement(loadingMessage);
        hideElement(errorMessage);

        renderAnime();
        updateLoadMoreVisibility();
        updateHeroPoster();

        if (animeList.length === 0) {
            showElement(emptyMessage);
        }
    } catch (error) {
        console.error("Anime loading error:", error);

        hideElement(loadingMessage);

        if (animeList.length === 0) {
            showElement(errorMessage);
        } else {
            showToast("Couldn't load more anime. Please try again.");
        }

        hasMoreAnime = true;
    } finally {
        setLoading(false);
    }
}

function updateLoadMoreVisibility() {
    if (!loadMoreBtn) return;

    if (!hasMoreAnime) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = "You've explored this collection ✨";
        loadMoreBtn.classList.add("hidden");
        return;
    }

    loadMoreBtn.classList.remove("hidden");
    loadMoreBtn.disabled = isLoadingAnime;
    loadMoreBtn.innerHTML = isLoadingAnime
        ? "Loading Anime..."
        : "Load More Anime <span>↓</span>";
}

if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", loadAnime);
}

if (retryBtn) {
    retryBtn.addEventListener("click", () => {
        if (!isLoadingAnime) {
            loadAnime();
        }
    });
}


/* =========================================================
   9. SEARCH AND CATEGORY FILTERS
========================================================= */

function getFilteredAnime() {
    return animeList.filter((anime) => {
        const title = getAnimeTitle(anime).toLowerCase();

        const englishTitle = (anime.title?.english || "").toLowerCase();
        const romajiTitle = (anime.title?.romaji || "").toLowerCase();
        const nativeTitle = (anime.title?.native || "").toLowerCase();

        const genres = (anime.genres || []).join(" ").toLowerCase();

        const matchesSearch = !searchText
            || title.includes(searchText)
            || englishTitle.includes(searchText)
            || romajiTitle.includes(searchText)
            || nativeTitle.includes(searchText)
            || genres.includes(searchText);

        const matchesCategory = selectedCategory === "All"
            || (anime.genres || []).some((genre) => {
                return genre.toLowerCase() === selectedCategory.toLowerCase();
            });

        return matchesSearch && matchesCategory;
    });
}

function updateAnimeCount(count) {
    if (!animeCount) return;

    animeCount.textContent = formatNumber(count);
}

if (searchInput) {
    searchInput.addEventListener("input", () => {
        searchText = searchInput.value.trim().toLowerCase();

        if (clearSearchBtn) {
            clearSearchBtn.classList.toggle(
                "visible",
                searchInput.value.length > 0
            );
        }

        renderAnime();
    });
}

if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
        searchInput.value = "";
        searchText = "";

        clearSearchBtn.classList.remove("visible");

        renderAnime();
        searchInput.focus();
    });
}

categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
        selectedCategory = button.dataset.category || "All";

        categoryButtons.forEach((item) => {
            item.classList.toggle("active", item === button);
        });

        renderAnime();
    });
});

if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", () => {
        selectedCategory = "All";
        searchText = "";

        if (searchInput) searchInput.value = "";

        if (clearSearchBtn) {
            clearSearchBtn.classList.remove("visible");
        }

        categoryButtons.forEach((button) => {
            button.classList.toggle(
                "active",
                button.dataset.category === "All"
            );
        });

        renderAnime();
    });
}


/* =========================================================
   10. ANIME CARD RENDERING
========================================================= */

function createAnimeCard(anime) {
    const card = document.createElement("article");

    card.className = "anime-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `View ${getAnimeTitle(anime)}`);

    const title = getAnimeTitle(anime);
    const image = getAnimeImage(anime);
    const rating = getAnimeRating(anime);
    const format = getAnimeFormat(anime);
    const year = getAnimeYear(anime);

    const genres = (anime.genres || []).slice(0, 2);

    const imageHTML = image
        ? `<img class="anime-card-image"
                src="${escapeHTML(image)}"
                alt="${escapeHTML(title)} poster"
                loading="lazy">`
        : `<div class="anime-card-fallback">🌸</div>`;

    card.innerHTML = `
        <div class="anime-card-image-wrap">
            ${imageHTML}

            <div class="anime-card-overlay"></div>

            <span class="anime-type-badge">
                ${escapeHTML(format)}
            </span>

            <span class="anime-rating">
                ★ ${escapeHTML(rating)}
            </span>
        </div>

        <div class="anime-card-body">
            <h3 class="anime-card-title">
                ${escapeHTML(title)}
            </h3>

            <div class="anime-card-meta">
                <span>${escapeHTML(String(year))}</span>
                <span>${anime.episodes ? `${escapeHTML(anime.episodes)} eps` : "Episodes N/A"}</span>
            </div>

            <div class="anime-card-genres">
                ${genres.map((genre) => `
                    <span class="anime-genre-chip">
                        ${escapeHTML(genre)}
                    </span>
                `).join("")}
            </div>
        </div>
    `;

    card.addEventListener("click", () => openAnimeDetails(anime));

    card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openAnimeDetails(anime);
        }
    });

    const img = card.querySelector("img");

    if (img) {
        img.addEventListener("error", () => {
            const wrapper = card.querySelector(".anime-card-image-wrap");

            if (wrapper) {
                const fallback = document.createElement("div");
                fallback.className = "anime-card-fallback";
                fallback.textContent = "🌸";

                img.replaceWith(fallback);
            }
        }, { once: true });
    }

    return card;
}

function renderAnime() {
    if (!animeGrid) return;

    animeGrid.replaceChildren();

    const filteredAnime = getFilteredAnime();

    updateAnimeCount(filteredAnime.length);

    hideElement(loadingMessage);

    if (filteredAnime.length === 0) {
        showElement(emptyMessage);
    } else {
        hideElement(emptyMessage);

        const fragment = document.createDocumentFragment();

        filteredAnime.forEach((anime) => {
            fragment.appendChild(createAnimeCard(anime));
        });

        animeGrid.appendChild(fragment);
    }

    if (searchText || selectedCategory !== "All") {
        loadMoreBtn?.classList.add("hidden");
    } else {
        updateLoadMoreVisibility();
    }
}


/* =========================================================
   11. RANDOM ANIME
========================================================= */

function pickRandomAnime() {
    if (animeList.length === 0) {
        showToast("Loading anime first. Please wait! 🌸");

        if (!isLoadingAnime) loadAnime();

        return;
    }

    const availableAnime = getFilteredAnime();

    if (availableAnime.length === 0) {
        showToast("No anime found with these filters.");
        return;
    }

    const randomIndex = Math.floor(Math.random() * availableAnime.length);
    const anime = availableAnime[randomIndex];

    openAnimeDetails(anime);
}

if ($("#random-anime-btn")) {
    $("#random-anime-btn").addEventListener("click", pickRandomAnime);
}


/* =========================================================
   12. ANIME DETAIL PAGE
========================================================= */

function openAnimeDetails(anime) {
    if (!anime || !detailContent) return;

    currentAnime = anime;

    const title = getAnimeTitle(anime);
    const image = getAnimeImage(anime);

    const description = cleanDescription(anime.description)
        || "No synopsis is available for this anime yet.";

    const genres = anime.genres || [];

    const statusNames = {
        FINISHED: "Finished",
        RELEASING: "Currently Airing",
        NOT_YET_RELEASED: "Not Yet Released",
        CANCELLED: "Cancelled",
        HIATUS: "On Hiatus"
    };

    const status = statusNames[anime.status] || "Unknown";

    const season = anime.season
        ? `${anime.season} ${anime.seasonYear || ""}`.trim()
        : String(anime.seasonYear || "Unknown");

    detailContent.innerHTML = `
        <div class="detail-hero">

            <div class="detail-poster">
                ${image
                    ? `<img src="${escapeHTML(image)}"
                            alt="${escapeHTML(title)} poster">`
                    : `<div class="anime-card-fallback">🌸</div>`
                }
            </div>

            <div class="detail-information">

                <p class="eyebrow">ANIMEVERSE DISCOVERY</p>

                <h1 class="detail-title">
                    ${escapeHTML(title)}
                </h1>

                ${anime.title?.native
                    ? `<p class="detail-native-title">
                            ${escapeHTML(anime.title.native)}
                       </p>`
                    : ""
                }

                <div class="detail-rating-row">
                    <span class="detail-pill detail-rating">
                        ★ ${escapeHTML(getAnimeRating(anime))}/10
                    </span>

                    <span class="detail-pill">
                        ${escapeHTML(getAnimeFormat(anime))}
                    </span>

                    <span class="detail-pill">
                        ${escapeHTML(status)}
                    </span>
                </div>

                <section class="detail-section">
                    <h3>Synopsis</h3>
                    <p class="detail-synopsis">
                        ${escapeHTML(description)}
                    </p>
                </section>

                <section class="detail-section">
                    <h3>Anime Information</h3>

                    <div class="detail-meta-grid">

                        <div class="detail-meta-item">
                            <span>Episodes</span>
                            <strong>${anime.episodes ?? "Unknown"}</strong>
                        </div>

                        <div class="detail-meta-item">
                            <span>Year / Season</span>
                            <strong>${escapeHTML(season)}</strong>
                        </div>

                        <div class="detail-meta-item">
                            <span>Episode Duration</span>
                            <strong>${anime.duration ? `${anime.duration} minutes` : "Unknown"}</strong>
                        </div>

                        <div class="detail-meta-item">
                            <span>Popularity</span>
                            <strong>${formatNumber(anime.popularity)}</strong>
                        </div>

                        <div class="detail-meta-item">
                            <span>Studio</span>
                            <strong>${escapeHTML(getStudioNames(anime))}</strong>
                        </div>

                        <div class="detail-meta-item">
                            <span>Country</span>
                            <strong>${escapeHTML(anime.countryOfOrigin || "Unknown")}</strong>
                        </div>

                    </div>
                </section>

                <section class="detail-section">
                    <h3>Genres</h3>

                    <div class="detail-genres">
                        ${genres.length
                            ? genres.map((genre) => `
                                <span>${escapeHTML(genre)}</span>
                              `).join("")
                            : "<span>Genres unavailable</span>"
                        }
                    </div>
                </section>

                <section class="detail-section">
                    <button type="button"
                            class="secondary-btn"
                            id="detail-back-home-btn">
                        ← Back to AnimeVerse
                    </button>
                </section>

            </div>
        </div>
    `;

    hideElement(profileScreen);
    hideElement(homeScreen);
    showElement(detailScreen);

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    const detailBackButton = $("#detail-back-home-btn");

    if (detailBackButton) {
        detailBackButton.addEventListener("click", showHomeScreen);
    }

    const detailImage = detailContent.querySelector(".detail-poster img");

    if (detailImage) {
        detailImage.addEventListener("error", () => {
            detailImage.alt = "Poster unavailable";
            detailImage.style.display = "none";
        }, { once: true });
    }
}

if ($("#back-btn")) {
    $("#back-btn").addEventListener("click", showHomeScreen);
}


/* =========================================================
   13. HERO POSTER
========================================================= */

function updateHeroPoster() {
    const container = $("#heroCharacterPoster");

    if (!container || animeList.length === 0) return;

    const featuredAnime = animeList.find((anime) => getAnimeImage(anime));

    if (!featuredAnime) return;

    const image = getAnimeImage(featuredAnime);
    const title = getAnimeTitle(featuredAnime);

    container.innerHTML = `
        <div class="hero-glow"></div>

        <img
            class="hero-character-image"
            src="${escapeHTML(image)}"
            alt="${escapeHTML(title)} poster"
        >

        <div class="floating-label label-top">
            ✨ Featured anime
        </div>

        <div class="floating-label label-bottom">
            🌸 ${escapeHTML(title.length > 25
                ? title.slice(0, 22) + "..."
                : title)}
        </div>
    `;

    const poster = container.querySelector("img");

    poster.addEventListener("error", () => {
        container.innerHTML = `
            <div class="hero-glow"></div>
            <div class="hero-poster-placeholder">
                <span class="hero-star">✦</span>
                <span class="hero-kanji">夢</span>
                <p>Your Anime Adventure</p>
                <span class="hero-star">✧</span>
            </div>
        `;
    }, { once: true });
}


/* =========================================================
   14. ANIME MOVIES
========================================================= */

async function loadMovies() {
    if (!movieGrid) return;

    movieGrid.innerHTML = `
        <div class="status-message">
            <div class="loading-spinner"></div>
            <p>Discovering anime movies...</p>
        </div>
    `;

    const query = `
        query GetAnimeMovies {
            Page(page: 1, perPage: 10) {
                media(
                    type: ANIME
                    format: MOVIE
                    sort: POPULARITY_DESC
                    isAdult: false
                ) {
                    ${ANIME_FIELDS}
                }
            }
        }
    `;

    try {
        const data = await requestAniList(query);

        movieList = (data.Page.media || []).filter((movie) => !movie.isAdult);

        renderMovies();
    } catch (error) {
        console.error("Movie loading error:", error);

        movieGrid.innerHTML = `
            <div class="status-message">
                <span class="status-icon">☁</span>
                <h3>Movies are taking a break</h3>
                <p>Please check your internet connection and refresh the page.</p>
            </div>
        `;
    }
}

function renderMovies() {
    if (!movieGrid) return;

    movieGrid.replaceChildren();

    if (movieList.length === 0) {
        movieGrid.innerHTML = `
            <div class="status-message">
                <span class="status-icon">🎬</span>
                <h3>No movies available right now</h3>
            </div>
        `;

        return;
    }

    const fragment = document.createDocumentFragment();

    movieList.forEach((movie) => {
        const card = document.createElement("article");

        card.className = "movie-card";
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `View ${getAnimeTitle(movie)}`);

        const title = getAnimeTitle(movie);
        const image = getAnimeImage(movie);

        card.innerHTML = `
            <div class="movie-poster-wrap">
                ${image
                    ? `<img class="movie-poster"
                            src="${escapeHTML(image)}"
                            alt="${escapeHTML(title)} poster"
                            loading="lazy">`
                    : `<div class="anime-card-fallback">🎬</div>`
                }
            </div>

            <div class="movie-card-body">
                <h3 class="movie-card-title">
                    ${escapeHTML(title)}
                </h3>

                <div class="movie-card-meta">
                    <span>${escapeHTML(String(getAnimeYear(movie)))}</span>
                    <span>★ ${escapeHTML(getAnimeRating(movie))}</span>
                </div>
            </div>
        `;

        card.addEventListener("click", () => openAnimeDetails(movie));

        card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openAnimeDetails(movie);
            }
        });

        const img = card.querySelector("img");

        if (img) {
            img.addEventListener("error", () => {
                const wrapper = card.querySelector(".movie-poster-wrap");

                if (!wrapper) return;

                const fallback = document.createElement("div");
                fallback.className = "anime-card-fallback";
                fallback.textContent = "🎬";

                img.replaceWith(fallback);
            }, { once: true });
        }

        fragment.appendChild(card);
    });

    movieGrid.appendChild(fragment);
}


/* =========================================================
   15. NAVIGATION
========================================================= */

function setActiveNavigation(activeId) {
    document.querySelectorAll(".nav-link").forEach((button) => {
        button.classList.toggle("active", button.id === activeId);
    });
}

function closeMobileMenu() {
    const navLinks = $(".nav-links");
    const menuButton = $("#menu-btn");

    if (navLinks) navLinks.classList.remove("open");

    if (menuButton) {
        menuButton.setAttribute("aria-expanded", "false");
    }
}

function navigateToSection(section, activeId) {
    showHomeScreen();
    closeMobileMenu();
    setActiveNavigation(activeId);

    setTimeout(() => {
        scrollToSection(section);
    }, 50);
}

if ($("#nav-home")) {
    $("#nav-home").addEventListener("click", () => {
        showHomeScreen();
        closeMobileMenu();
        setActiveNavigation("nav-home");
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

if ($("#nav-anime")) {
    $("#nav-anime").addEventListener("click", () => {
        navigateToSection($("#anime-section"), "nav-anime");
    });
}

if ($("#nav-movies")) {
    $("#nav-movies").addEventListener("click", () => {
        navigateToSection($("#movies-section"), "nav-movies");
    });
}

if ($("#nav-about")) {
    $("#nav-about").addEventListener("click", () => {
        navigateToSection($("#about"), "nav-about");
    });
}

if ($("#explore-btn")) {
    $("#explore-btn").addEventListener("click", () => {
        navigateToSection($("#anime-section"), "nav-anime");
    });
}

if ($("#home-logo")) {
    $("#home-logo").addEventListener("click", (event) => {
        event.preventDefault();

        showHomeScreen();
        closeMobileMenu();

        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

if ($("#footer-home")) {
    $("#footer-home").addEventListener("click", (event) => {
        event.preventDefault();

        showHomeScreen();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

if ($("#detail-home-logo")) {
    $("#detail-home-logo").addEventListener("click", (event) => {
        event.preventDefault();
        showHomeScreen();
    });
}

if ($("#back-to-top")) {
    $("#back-to-top").addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });
}


/* =========================================================
   16. MOBILE MENU
========================================================= */

if ($("#menu-btn")) {
    $("#menu-btn").addEventListener("click", () => {
        const navLinks = $(".nav-links");
        const menuButton = $("#menu-btn");

        if (!navLinks) return;

        const isOpen = navLinks.classList.toggle("open");

        menuButton.setAttribute("aria-expanded", String(isOpen));
    });
}


/* =========================================================
   17. KEYBOARD AND MODAL SUPPORT
========================================================= */

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        if (profileModal && !profileModal.classList.contains("hidden")) {
            closeProfileModal();
        }

        closeMobileMenu();
    }
});


/* =========================================================
   18. CURRENT YEAR
========================================================= */

const yearElement = $("#current-year");

if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}


/* =========================================================
   19. INITIALIZE WEBSITE
========================================================= */

function initializeWebsite() {
    const profile = getSavedProfile();

    if (profile) {
        updateProfileGreeting(profile);
        showHomeScreen();
    } else {
        showProfileScreen();
    }

    loadMovies();

    if (profile) {
        loadAnime();
    }
}

initializeWebsite();

/* ================= END OF ANIMEVERSE JS ================= */

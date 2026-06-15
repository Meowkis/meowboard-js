let h1Node = document.querySelector("h1");
h1Node.dataset.text = h1Node.innerText;

h1Node.addEventListener("mouseenter", function () {
    h1Node.innerText = "Welcome to Meowboard :з";
    h1Node.dataset.text = h1Node.innerText;
});

h1Node.addEventListener("mouseleave", function () {
    h1Node.innerText = "Welcome to Meowboard :3";
    h1Node.dataset.text = h1Node.innerText;
});

const main = document.querySelector("main");
const cards = document.querySelectorAll(".card");
const interactiveCards = Array.from(cards).filter((card) => {
    return card.dataset.cardType !== "audio";
});
const audioCards = Array.from(cards).filter((card) => {
    return card.dataset.cardType === "audio";
});

const languageToggleButton = document.querySelector("[data-language-toggle]");
const languageStatus = document.querySelector("[data-language-status]");
const musicToggleButton = document.querySelector("[data-music-toggle]");
const musicStatus = document.querySelector("[data-music-status]");

let isInStarState;
let areAudioCardsVisible = true;
let audioVisibilityTimer = null;
let hasRunAutoMusicClick = false;

function getCardsForLayout() {
    return areAudioCardsVisible ? Array.from(cards) : interactiveCards;
}

function updateAudioCardsVisibility() {
    clearTimeout(audioVisibilityTimer);

    if (areAudioCardsVisible) {
        audioCards.forEach((card) => {
            card.classList.remove("audio-card-hidden", "audio-card-hiding");
            card.classList.add("audio-card-entering");
            card.setAttribute("aria-hidden", "false");
        });

        setupInitialCardsLayout({
            cardsToLayout: getCardsForLayout(),
            animate: true,
            refreshVisuals: false
        });

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                audioCards.forEach((card) => {
                    card.classList.remove("audio-card-entering");
                });
            });
        });

        return;
    }

    audioCards.forEach((card) => {
        card.classList.remove("audio-card-entering");
        card.classList.add("audio-card-hiding");
        card.setAttribute("aria-hidden", "true");
    });

    setupInitialCardsLayout({
        cardsToLayout: getCardsForLayout(),
        animate: true,
        refreshVisuals: false
    });

    audioVisibilityTimer = setTimeout(() => {
        audioCards.forEach((card) => {
            card.classList.remove("audio-card-hiding");
            card.classList.add("audio-card-hidden");
        });
    }, 300);
}

async function animateMusicToggleClick() {
    if (
        hasRunAutoMusicClick
        || !musicToggleButton
        || audioCards.length === 0
    ) {
        return;
    }

    hasRunAutoMusicClick = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        if (areAudioCardsVisible) {
            musicToggleButton.click();
        }

        return;
    }

    const cursor = document.createElement("div");
    const targetRect = musicToggleButton.getBoundingClientRect();
    const startX = window.innerWidth * 0.5;
    const startY = window.innerHeight * 0.62;
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;

    cursor.className = "auto-cursor";
    cursor.setAttribute("aria-hidden", "true");
    document.body.append(cursor);

    cursor.style.transform = `translate3d(${startX}px, ${startY}px, 0)`;
    cursor.offsetHeight;

    requestAnimationFrame(() => {
        cursor.classList.add("visible");
        cursor.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
    });

    await new Promise((resolve) => setTimeout(resolve, 1100));

    musicToggleButton.classList.add("auto-click-target");
    cursor.classList.add("clicking");

    await new Promise((resolve) => setTimeout(resolve, 180));

    if (areAudioCardsVisible) {
        musicToggleButton.click();
    }

    await new Promise((resolve) => setTimeout(resolve, 260));

    musicToggleButton.classList.remove("auto-click-target");
    cursor.classList.add("leaving");

    setTimeout(() => cursor.remove(), 220);
}

function setupHeaderControls() {
    let currentLanguage = document.documentElement.lang || "en";

    languageToggleButton?.addEventListener("click", function () {
        currentLanguage = currentLanguage === "en" ? "ru" : "en";
        document.documentElement.lang = currentLanguage;

        languageStatus.textContent = currentLanguage === "ru"
            ? "English language"
            : "Русский язык";

        document.dispatchEvent(new CustomEvent("meowboard:languagechange", {
            detail: { language: currentLanguage }
        }));
    });

    musicToggleButton?.addEventListener("click", function () {
        areAudioCardsVisible = !areAudioCardsVisible;
        updateAudioCardsVisibility();

        musicToggleButton.setAttribute(
            "aria-pressed",
            String(!areAudioCardsVisible)
        );
        musicToggleButton.setAttribute(
            "aria-label",
            areAudioCardsVisible
                ? "Скрыть музыкальные карточки"
                : "Показать музыкальные карточки"
        );
        musicStatus.textContent = areAudioCardsVisible
            ? "Карточки видно"
            : "Карточки скрыты";
    });
}

function createEntryGate() {
    const gate = document.createElement("div");

    document.body.classList.add("board-locked");
    gate.classList.add("entry-gate");

    gate.innerHTML = `
        <div class="entry-box">
            <h2 class="entry-title">Meowboard is locked</h2>
            <p class="entry-text">Move the key to wake the board.</p>

            <div class="key-track">
                <div class="key-handle">⌁</div>
            </div>
        </div>
    `;

    document.body.append(gate);

    const track = gate.querySelector(".key-track");
    const handle = gate.querySelector(".key-handle");

    let isDraggingKey = false;
    let startPointerX = 0;
    let startHandleX = 0;
    let currentX = 0;

    function getMaxHandleX() {
        return track.offsetWidth - handle.offsetWidth - 12;
    }

    function setHandleX(x) {
        currentX = clamp(x, 0, getMaxHandleX());
        handle.style.transform = `translateX(${currentX}px)`;
    }

    function unlockBoard() {
        document.body.classList.remove("board-locked");
        gate.classList.add("hidden");

        playRandomBoardAudio();
        setupViewportMediaPlayback();
        scheduleRandomLinks();

        setTimeout(animateMusicToggleClick, 850);

        setTimeout(() => {
            gate.remove();
        }, 500);
    }

    handle.addEventListener("pointerdown", function (e) {
        isDraggingKey = true;

        startPointerX = e.clientX;
        startHandleX = currentX;

        handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener("pointermove", function (e) {
        if (!isDraggingKey) return;

        const deltaX = e.clientX - startPointerX;

        setHandleX(startHandleX + deltaX);
    });

    handle.addEventListener("pointerup", function (e) {
        if (!isDraggingKey) return;

        isDraggingKey = false;

        if (handle.hasPointerCapture(e.pointerId)) {
            handle.releasePointerCapture(e.pointerId);
        }

        const unlockProgress = currentX / getMaxHandleX();

        if (unlockProgress >= 0.85) {
            setHandleX(getMaxHandleX());
            unlockBoard();
        } else {
            handle.style.transition = "transform 0.25s ease";
            setHandleX(0);

            setTimeout(() => {
                handle.style.transition = "";
            }, 250);
        }
    });

    handle.addEventListener("pointercancel", function (e) {
        isDraggingKey = false;

        if (handle.hasPointerCapture(e.pointerId)) {
            handle.releasePointerCapture(e.pointerId);
        }

        handle.style.transition = "transform 0.25s ease";
        setHandleX(0);

        setTimeout(() => {
            handle.style.transition = "";
        }, 250);
    });
}

function playRandomBoardAudio() {
    const audios = Array.from(document.querySelectorAll(".audio-placeholder audio"));

    if (audios.length === 0) {
        return;
    }

    audios.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
    });

    const randomAudio = audios[Math.floor(random(0, audios.length))];

    randomAudio.volume = 0.45;

    const playPromise = randomAudio.play();

    if (playPromise) {
        playPromise.catch((error) => {
            console.warn("Audio play was blocked or failed:", error);
        });
    }
}

function setupViewportMediaPlayback() {
    const videos = Array.from(document.querySelectorAll("video"));

    if (videos.length === 0) {
        return;
    }

    if (mediaObserver) {
        mediaObserver.disconnect();
    }

    videos.forEach((video) => {
        video.muted = true;
        video.volume = 0;
        video.playsInline = true;
        video.loop = true;
        video.preload = "metadata";

        video.setAttribute("muted", "");
        video.setAttribute("playsinline", "");
        video.setAttribute("webkit-playsinline", "");

        video.pause();
    });

    mediaObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            const video = entry.target;
            video.dataset.viewportVisible = String(entry.isIntersecting);

            if (entry.isIntersecting && !document.hidden) {
                video.muted = true;
                video.volume = 0;

                const playPromise = video.play();

                if (playPromise) {
                    playPromise
                        .then(() => {
                            if (video.muted || video.volume === 0) {
                                video.dataset.viewportMutedAutoplay = "true";
                            }
                        })
                        .catch((error) => {
                            console.warn("Video play was blocked or failed:", error);
                        });
                } else if (video.muted || video.volume === 0) {
                    video.dataset.viewportMutedAutoplay = "true";
                }
            } else if (!entry.isIntersecting) {
                const wasMutedAutoplay = video.dataset.viewportMutedAutoplay === "true";
                const isMutedNow = video.muted || video.volume === 0;
                const isPlayingNow = !video.paused && !video.ended;

                if (wasMutedAutoplay && isMutedNow && isPlayingNow) {
                    video.pause();
                    video.dataset.viewportMutedAutoplay = "false";
                }
            }
        });
    }, {
        root: null,
        rootMargin: "100px 0px",
        threshold: 0.01
    });

    videos.forEach((video) => {
        mediaObserver.observe(video);
    });
}
document.documentElement.style.overflowY = "auto";
document.body.style.overflowY = "auto";
document.body.style.overflowX = "hidden";

main.style.position = "relative";
main.style.overflow = "hidden";

const linksLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
linksLayer.classList.add("links-layer");
main.prepend(linksLayer);

const starLinksLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
starLinksLayer.classList.add("star-links-layer");
main.append(starLinksLayer);

const activeLinks = [];

let maxZIndex = 1;
let starAnimationToken = 0;
let resizeTimer = null;
let mediaObserver = null;
let cardAnimationObserver = null;
let linksAnimationId = null;
let lastLinksUpdateTime = 0;
let randomLinksTimer = null;
let layoutTransitionTimer = null;

const linkUpdateInterval = 1000 / 30;
const layoutTransitionDuration = 700;

function setupViewportCardAnimations() {
    const cardsArray = Array.from(document.querySelectorAll(".card"));

    if (cardsArray.length === 0) {
        return;
    }

    if (cardAnimationObserver) {
        cardAnimationObserver.disconnect();
    }

    cardAnimationObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            const card = entry.target;

            if (entry.isIntersecting) {
                card.classList.remove("animation-paused");
            } else {
                card.classList.add("animation-paused");
            }
        });
    }, {
        root: null,
        rootMargin: "50px 0px",
        threshold: 0.01
    });

    cardsArray.forEach((card) => {
        cardAnimationObserver.observe(card);
    });
}

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(random(0, i + 1));

        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
}

function getCardSizeRange(card, maxAvailableWidth) {
    const isQuoteCard = card.querySelector(".quote-placeholder");

    const baseMinSize = isQuoteCard ? 240 : 250;
    const baseMaxSize = isQuoteCard ? 360 : 400;

    const cappedMaxSize = Math.max(120, Math.min(baseMaxSize, maxAvailableWidth));
    const cappedMinSize = Math.min(baseMinSize, cappedMaxSize);

    return {
        min: cappedMinSize,
        max: cappedMaxSize
    };
}

function setupCardVisuals(card, maxAvailableWidth) {
    const sizeRange = getCardSizeRange(card, maxAvailableWidth);
    const size = random(sizeRange.min, sizeRange.max);

    card.style.width = `${size}px`;

    card.style.setProperty("--float-x-1", `${random(-8, 8)}px`);
    card.style.setProperty("--float-y-1", `${random(-8, 8)}px`);
    card.style.setProperty("--float-x-2", `${random(-8, 8)}px`);
    card.style.setProperty("--float-y-2", `${random(-8, 8)}px`);

    card.style.setProperty("--rotate-1", `${random(-4, 4)}deg`);
    card.style.setProperty("--rotate-2", `${random(-4, 4)}deg`);

    card.style.animationDuration = `${random(2.5, 5)}s`;
    card.style.animationDelay = `${random(0, 2)}s`;
}


function setupInitialCardsLayout(options = {}) {
    const {
        cardsToLayout = getCardsForLayout(),
        animate = false,
        refreshVisuals = true
    } = options;

    const cardsArray = shuffleArray([...cardsToLayout]);

    const mainRect = main.getBoundingClientRect();

    const boardWidth = mainRect.width || window.innerWidth;

    const padding = clamp(boardWidth * 0.04, 18, 56);

    const minGap = clamp(boardWidth * 0.025, 22, 40);
    const maxGap = clamp(boardWidth * 0.095, 70, 150);

    const maxOverlapRatio = 0.35;

    const usableWidth = Math.max(120, boardWidth - padding * 2);

    cardsArray.forEach((card) => {
        if (card.inertiaAnimationId) {
            cancelAnimationFrame(card.inertiaAnimationId);
            card.inertiaAnimationId = null;
        }

        card.style.transition = animate ? "" : "none";
        card.style.transform = "";
        card.style.animationPlayState = "";
        card.classList.remove("dragging");
        card.classList.remove("inertia");
        card.classList.remove("forming-star");
        card.classList.toggle("repositioning", animate);

        if (refreshVisuals) {
            setupCardVisuals(card, usableWidth);
        }
    });

    if (animate) {
        main.classList.add("repositioning");
        main.offsetHeight;
    }

    const rows = [];

    let currentRow = {
        cards: [],
        width: 0,
        height: 0
    };

    cardsArray.forEach((card) => {
        const cardWidth = card.offsetWidth;
        const cardHeight = card.offsetHeight;

        const nextWidth = currentRow.cards.length === 0
            ? cardWidth
            : currentRow.width + minGap + cardWidth;

        if (currentRow.cards.length > 0 && nextWidth > usableWidth) {
            rows.push(currentRow);

            currentRow = {
                cards: [],
                width: 0,
                height: 0
            };
        }

        currentRow.cards.push(card);

        currentRow.width = currentRow.cards.length === 1
            ? cardWidth
            : currentRow.width + minGap + cardWidth;

        currentRow.height = Math.max(currentRow.height, cardHeight);
    });

    if (currentRow.cards.length > 0) {
        rows.push(currentRow);
    }

    let y = padding;

    rows.forEach((row) => {
        const rowExtraHeight = random(60, 150);
        const rowBandHeight = row.height + rowExtraHeight;

        const totalCardsWidth = row.cards.reduce((sum, card) => {
            return sum + card.offsetWidth;
        }, 0);

        const gaps = [];

        for (let i = 0; i < row.cards.length - 1; i++) {
            gaps.push(random(minGap, maxGap));
        }

        let totalGapsWidth = gaps.reduce((sum, gap) => {
            return sum + gap;
        }, 0);

        let rowWidth = totalCardsWidth + totalGapsWidth;

        if (rowWidth > usableWidth && gaps.length > 0) {
            const overflow = rowWidth - usableWidth;
            const compressionPerGap = overflow / gaps.length;

            const smallestCardWidth = Math.min(...row.cards.map((card) => {
                return card.offsetWidth;
            }));

            const maxNegativeGap = -smallestCardWidth * maxOverlapRatio;

            for (let i = 0; i < gaps.length; i++) {
                gaps[i] = Math.max(gaps[i] - compressionPerGap, maxNegativeGap);
            }

            totalGapsWidth = gaps.reduce((sum, gap) => {
                return sum + gap;
            }, 0);

            rowWidth = totalCardsWidth + totalGapsWidth;
        }

        if (rowWidth > usableWidth && gaps.length > 0) {
            const overflow = rowWidth - usableWidth;
            const extraCompressionPerGap = overflow / gaps.length;

            for (let i = 0; i < gaps.length; i++) {
                gaps[i] -= extraCompressionPerGap;
            }

            totalGapsWidth = gaps.reduce((sum, gap) => {
                return sum + gap;
            }, 0);

            rowWidth = totalCardsWidth + totalGapsWidth;
        }

        const freeSpace = Math.max(0, usableWidth - rowWidth);

        let x = padding + random(0, freeSpace);

        row.cards.forEach((card, index) => {
            const availableVerticalJitter = Math.max(0, rowBandHeight - card.offsetHeight);

            const verticalBias = random(-0.15, 0.15) * rowBandHeight;

            let cardY = y + random(0, availableVerticalJitter) + verticalBias;

            cardY = clamp(
                cardY,
                y,
                y + rowBandHeight - card.offsetHeight
            );

            const maxCardX = Math.max(padding, boardWidth - padding - card.offsetWidth);

            const cardX = clamp(
                x,
                padding,
                maxCardX
            );

            card.style.left = `${cardX}px`;
            card.style.top = `${cardY}px`;

            const isLastCard = index === row.cards.length - 1;

            if (!isLastCard) {
                x += card.offsetWidth + gaps[index];
            }
        });

        y += rowBandHeight + random(minGap * 0.4, maxGap * 0.8);
    });

    const contentHeight = y + padding;
    const minMainHeight = Math.max(300, window.innerHeight - main.getBoundingClientRect().top);

    main.style.height = `${Math.max(contentHeight, minMainHeight)}px`;

    if (!animate) {
        cardsArray.forEach((card) => {
            card.offsetHeight;
            card.style.transition = "";
        });

        return;
    }

    clearTimeout(layoutTransitionTimer);
    layoutTransitionTimer = setTimeout(() => {
        cards.forEach((card) => {
            card.classList.remove("repositioning");
        });
        main.classList.remove("repositioning");
    }, layoutTransitionDuration);
}
function getCardCenter(card, mainRect = main.getBoundingClientRect()) {
    const cardRect = card.getBoundingClientRect();

    return {
        x: cardRect.left - mainRect.left + cardRect.width / 2,
        y: cardRect.top - mainRect.top + cardRect.height / 2
    };
}

function getAdaptiveStarPoints(selectedCards) {
    const mainRect = main.getBoundingClientRect();

    const padding = Math.max(16, Math.min(mainRect.width, mainRect.height) * 0.04);

    const maxCardWidth = Math.max(...selectedCards.map((card) => card.offsetWidth));
    const maxCardHeight = Math.max(...selectedCards.map((card) => card.offsetHeight));

    const centerX = mainRect.width / 2;
    const centerY = window.scrollY + window.innerHeight / 2 - mainRect.top;

    const radiusX = mainRect.width / 2 - maxCardWidth / 2 - padding;
    const radiusY = window.innerHeight / 2 - maxCardHeight / 2 - padding;

    const radius = Math.max(40, Math.min(radiusX, radiusY));

    const points = [];

    for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + i * Math.PI * 2 / 5;

        points.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        });
    }

    return points;
}

function prepareCardForStarFlight(card) {
    if (card.inertiaAnimationId) {
        cancelAnimationFrame(card.inertiaAnimationId);
        card.inertiaAnimationId = null;
    }

    const mainRect = main.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    const currentX = cardRect.left - mainRect.left;
    const currentY = cardRect.top - mainRect.top;

    card.style.transition = "none";
    card.style.left = `${currentX}px`;
    card.style.top = `${currentY}px`;
    card.style.transform = "none";
    card.style.animationPlayState = "paused";

    card.classList.remove("dragging");
    card.classList.remove("inertia");
    card.classList.add("forming-star");

    card.style.zIndex = ++maxZIndex;

    card.offsetHeight;
}

function flyCardToStarPoint(card, centerX, centerY, moveTime) {
    prepareCardForStarFlight(card);

    const originalX = parseFloat(card.style.left) || 0;
    const originalY = parseFloat(card.style.top) || 0;

    const originalCenterX = originalX + card.offsetWidth / 2;
    const originalCenterY = originalY + card.offsetHeight / 2;

    let directionX = centerX - originalCenterX;
    let directionY = centerY - originalCenterY;

    let distance = Math.hypot(directionX, directionY);

    if (distance < 1) {
        const angle = random(0, Math.PI * 2);

        directionX = Math.cos(angle);
        directionY = Math.sin(angle);
        distance = 1;
    }

    const normalizedX = directionX / distance;
    const normalizedY = directionY / distance;

    const targetX = centerX - card.offsetWidth / 2;
    const targetY = centerY - card.offsetHeight / 2;

    card.style.transition = `
        left ${moveTime}ms cubic-bezier(0.65, 0, 1, 1),
        top ${moveTime}ms cubic-bezier(0.65, 0, 1, 1),
        scale 0.25s ease,
        box-shadow 0.25s ease
    `;

    requestAnimationFrame(() => {
        card.style.left = `${targetX}px`;
        card.style.top = `${targetY}px`;
    });

    const inertiaSpeed = 0.42;

    return {
        card,
        originalX,
        originalY,
        targetX,
        targetY,
        starCenterX: centerX,
        starCenterY: centerY,
        velocityX: normalizedX * inertiaSpeed,
        velocityY: normalizedY * inertiaSpeed
    };
}
function returnCardToOriginalPlace(flight, returnTime = 850, onComplete) {
    const card = flight.card;

    if (card.inertiaAnimationId) {
        cancelAnimationFrame(card.inertiaAnimationId);
        card.inertiaAnimationId = null;
    }

    card.classList.remove("inertia");
    card.classList.add("returning-home");

    card.style.transition = `
        left ${returnTime}ms cubic-bezier(0.75, 0, 1, 1),
        top ${returnTime}ms cubic-bezier(0.75, 0, 1, 1),
        scale 0.25s ease,
        box-shadow 0.25s ease
    `;

    requestAnimationFrame(() => {
        card.style.left = `${flight.originalX}px`;
        card.style.top = `${flight.originalY}px`;
    });

    setTimeout(() => {
        card.classList.remove("forming-star");
        card.classList.remove("inertia");
        card.classList.remove("returning-home");

        card.style.transition = "";
        card.style.transform = "";
        card.style.animationPlayState = "";
        if (typeof onComplete === "function") {
            onComplete();
        }
    
    }, returnTime);
}

function createStaticLineBetweenPoints(pointA, pointB, options = {}) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

    line.classList.add("link-line");

    if (options.className) {
        line.classList.add(options.className);
    }

    if (options.fadeTime) {
        line.style.transitionDuration = `${options.fadeTime}ms`;
    }

    const layer = options.layer ?? starLinksLayer;

    layer.appendChild(line);

    line.setAttribute("x1", pointA.x);
    line.setAttribute("y1", pointA.y);
    line.setAttribute("x2", pointB.x);
    line.setAttribute("y2", pointB.y);

    const visibleTime = options.visibleTime ?? 1800;
    const fadeTime = options.fadeTime ?? 1200;

    setTimeout(() => {
        line.classList.add("fading");

        setTimeout(() => {
            line.remove();
        }, fadeTime);
    }, visibleTime);
}

function startInertia(card, velocityX, velocityY, options = {}) {
    card.style.transition = "";

    card.classList.remove("forming-star");
    card.classList.add("inertia");

    let x = parseFloat(card.style.left) || 0;
    let y = parseFloat(card.style.top) || 0;

    let lastTime = performance.now();

    const friction = options.friction ?? 0.94;
    const bounce = options.bounce ?? 0.35;
    const minSpeed = options.minSpeed ?? 0.02;
    const maxSpeed = options.maxSpeed ?? 0.3;

    const speed = Math.hypot(velocityX, velocityY);

    if (speed > maxSpeed) {
        const scale = maxSpeed / speed;

        velocityX *= scale;
        velocityY *= scale;
    }

    function animate(now) {
        const deltaTime = now - lastTime;
        lastTime = now;

        const mainRect = main.getBoundingClientRect();

        const maxX = mainRect.width - card.offsetWidth;
        const maxY = mainRect.height - card.offsetHeight;

        x += velocityX * deltaTime;
        y += velocityY * deltaTime;

        if (x < 0) {
            x = 0;
            velocityX *= -bounce;
        }

        if (x > maxX) {
            x = maxX;
            velocityX *= -bounce;
        }

        if (y < 0) {
            y = 0;
            velocityY *= -bounce;
        }

        if (y > maxY) {
            y = maxY;
            velocityY *= -bounce;
        }

        const normalizedFriction = Math.pow(friction, deltaTime / 16.67);

        velocityX *= normalizedFriction;
        velocityY *= normalizedFriction;

        card.style.left = `${x}px`;
        card.style.top = `${y}px`;

       if (Math.abs(velocityX) < minSpeed && Math.abs(velocityY) < minSpeed) {
    card.classList.remove("inertia");
    card.inertiaAnimationId = null;

    if (options.restoreFloat) {
        card.style.transform = "";
        card.style.animationPlayState = "";
    }

    if (typeof options.onStop === "function") {
        options.onStop(card);
    }

    return;
}

        card.inertiaAnimationId = requestAnimationFrame(animate);
    }

    card.inertiaAnimationId = requestAnimationFrame(animate);
}

setupInitialCardsLayout();
setupViewportCardAnimations();

interactiveCards.forEach((card) => {
    let shiftX = 0;
    let shiftY = 0;

    let velocityX = 0;
    let velocityY = 0;

    let lastPointerX = 0;
    let lastPointerY = 0;
    let lastPointerTime = 0;

    card.addEventListener("pointerdown", function (e) {
        const interactiveMedia = e.target.closest(
            "video, iframe, audio, button, input, textarea, select, a"
        );

        if (interactiveMedia) {
            return;
        }

        if (card.inertiaAnimationId) {
            cancelAnimationFrame(card.inertiaAnimationId);
            card.inertiaAnimationId = null;
        }

        const mainRect = main.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();

        card.style.transition = "none";
        card.style.left = `${cardRect.left - mainRect.left}px`;
        card.style.top = `${cardRect.top - mainRect.top}px`;
        card.style.transform = "";
        card.style.animationPlayState = "";

        card.classList.remove("inertia");
        card.classList.remove("forming-star");

        shiftX = e.clientX - cardRect.left;
        shiftY = e.clientY - cardRect.top;

        velocityX = 0;
        velocityY = 0;

        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        lastPointerTime = performance.now();

        card.classList.add("dragging");
        card.style.zIndex = ++maxZIndex;

        card.setPointerCapture(e.pointerId);
    });

    card.addEventListener("pointermove", function (e) {
        if (!card.classList.contains("dragging")) return;

        const now = performance.now();
        const deltaTime = Math.max(1, now - lastPointerTime);

        velocityX = (e.clientX - lastPointerX) / deltaTime;
        velocityY = (e.clientY - lastPointerY) / deltaTime;

        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        lastPointerTime = now;

        const mainRect = main.getBoundingClientRect();

        let x = e.clientX - mainRect.left - shiftX;
        let y = e.clientY - mainRect.top - shiftY;

        const maxX = mainRect.width - card.offsetWidth;
        const maxY = mainRect.height - card.offsetHeight;

        x = clamp(x, 0, maxX);
        y = clamp(y, 0, maxY);

        card.style.left = `${x}px`;
        card.style.top = `${y}px`;
    });

    card.addEventListener("pointerup", function (e) {
        if (!card.classList.contains("dragging")) return;

        card.classList.remove("dragging");

        if (card.hasPointerCapture(e.pointerId)) {
            card.releasePointerCapture(e.pointerId);
        }

        startInertia(card, velocityX, velocityY);
    });

    card.addEventListener("pointercancel", function (e) {
        if (!card.classList.contains("dragging")) return;

        card.classList.remove("dragging");

        if (card.hasPointerCapture(e.pointerId)) {
            card.releasePointerCapture(e.pointerId);
        }

        startInertia(card, velocityX, velocityY);
    });
});

function createCustomLinkBetween(cardA, cardB, options = {}) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

    line.classList.add("link-line");

    if (options.className) {
        line.classList.add(options.className);
    }

    if (options.fadeTime) {
        line.style.transitionDuration = `${options.fadeTime}ms`;
    }

    const layer = options.layer ?? linksLayer;

    layer.appendChild(line);

    const link = {
        line,
        cardA,
        cardB
    };

    activeLinks.push(link);

    updateSingleLink(link);
    ensureLinksAnimation();

    const visibleTime = options.visibleTime ?? 1800;
    const fadeTime = options.fadeTime ?? 1200;

    setTimeout(() => {
        line.classList.add("fading");

        setTimeout(() => {
            line.remove();

            const index = activeLinks.indexOf(link);

            if (index !== -1) {
                activeLinks.splice(index, 1);
            }
        }, fadeTime);
    }, visibleTime);
}

function createLinkBetween(cardA, cardB) {
    createCustomLinkBetween(cardA, cardB, {
        visibleTime: random(300, 1400),
        fadeTime: 1200,
        layer: linksLayer
    });
}

function getRandomCards(count) {
    const cardsArray = [...interactiveCards];

    for (let i = cardsArray.length - 1; i > 0; i--) {
        const j = Math.floor(random(0, i + 1));

        [cardsArray[i], cardsArray[j]] = [cardsArray[j], cardsArray[i]];
    }

    return cardsArray.slice(0, count);
}

function createStarBetweenCards() {
    if (interactiveCards.length < 5) {
        isInStarState = false;
        return;
    }

    const currentToken = ++starAnimationToken;

    const selectedCards = getRandomCards(5);
    const starPoints = getAdaptiveStarPoints(selectedCards);

    const starOrder = [0, 2, 4, 1, 3, 0];

    const visibleTime = 2600;
    const fadeTime = 1400;
    const moveTime = 750;

    const starFlights = selectedCards.map((card, index) => {
        return flyCardToStarPoint(
            card,
            starPoints[index].x,
            starPoints[index].y,
            moveTime
        );
    });
    let returnedCardsCount = 0;

    setTimeout(() => {
        if (currentToken !== starAnimationToken) {
            return;
        }

        for (let i = 0; i < starOrder.length - 1; i++) {
            const pointA = starPoints[starOrder[i]];
            const pointB = starPoints[starOrder[i + 1]];

            createStaticLineBetweenPoints(pointA, pointB, {
                className: "star-line",
                visibleTime,
                fadeTime,
                layer: starLinksLayer
            });
        }

        starFlights.forEach((flight) => {
            startInertia(flight.card, flight.velocityX, flight.velocityY, {
                friction: 0.93,
                bounce: 0.2,
                minSpeed: 0.018,
                maxSpeed: 0.42,
                restoreFloat: false,

                onStop: () => {
                    if (currentToken !== starAnimationToken) {
                        return;
                    }

                    returnCardToOriginalPlace(flight, 850, () => {
                        returnedCardsCount++;

                        if (returnedCardsCount === starFlights.length) {
                            isInStarState = false;
                        }
                    });
                }
            });
        });
    }, moveTime);
}

function updateSingleLink(link, mainRect, centers) {
    const getCenter = (card) => {
        if (!centers) {
            return getCardCenter(card, mainRect);
        }

        if (!centers.has(card)) {
            centers.set(card, getCardCenter(card, mainRect));
        }

        return centers.get(card);
    };

    const pointA = getCenter(link.cardA);
    const pointB = getCenter(link.cardB);

    link.line.setAttribute("x1", pointA.x);
    link.line.setAttribute("y1", pointA.y);
    link.line.setAttribute("x2", pointB.x);
    link.line.setAttribute("y2", pointB.y);
}

function updateLinks(now) {
    if (activeLinks.length === 0) {
        linksAnimationId = null;
        lastLinksUpdateTime = 0;
        return;
    }

    if (!document.hidden && now - lastLinksUpdateTime >= linkUpdateInterval) {
        const mainRect = main.getBoundingClientRect();
        const centers = new Map();

        activeLinks.forEach((link) => {
            updateSingleLink(link, mainRect, centers);
        });

        lastLinksUpdateTime = now;
    }

    linksAnimationId = requestAnimationFrame(updateLinks);
}

function ensureLinksAnimation() {
    if (linksAnimationId === null) {
        linksAnimationId = requestAnimationFrame(updateLinks);
    }
}

function createRandomLink() {
    if (interactiveCards.length < 2) return;

    const firstIndex = Math.floor(random(0, interactiveCards.length));

    let secondIndex = Math.floor(random(0, interactiveCards.length));

    while (secondIndex === firstIndex) {
        secondIndex = Math.floor(random(0, interactiveCards.length));
    }

    createLinkBetween(
        interactiveCards[firstIndex],
        interactiveCards[secondIndex]
    );
}

function scheduleRandomLinks() {
    if (randomLinksTimer !== null) {
        return;
    }

    const delay = random(500, 5000);

    randomLinksTimer = setTimeout(() => {
        randomLinksTimer = null;

        if (!document.hidden) {
            createRandomLink();
        }

        scheduleRandomLinks();
    }, delay);
}



window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
        setupInitialCardsLayout({
            cardsToLayout: getCardsForLayout()
        });
        setupViewportCardAnimations();
    }, 250);
});

document.addEventListener("visibilitychange", function () {
    document.body.classList.toggle("page-hidden", document.hidden);

    document.querySelectorAll("video").forEach((video) => {
        const wasMutedAutoplay = video.dataset.viewportMutedAutoplay === "true";
        const isMutedNow = video.muted || video.volume === 0;

        if (document.hidden && wasMutedAutoplay && isMutedNow && !video.paused) {
            video.pause();
            video.dataset.pausedForPageVisibility = "true";
        }

        if (
            !document.hidden
            && video.dataset.pausedForPageVisibility === "true"
            && isMutedNow
            && video.dataset.viewportVisible === "true"
            && video.paused
        ) {
            video.dataset.pausedForPageVisibility = "false";
            video.play().catch((error) => {
                console.warn("Video playback could not resume:", error);
            });
        }
    });
});

setupHeaderControls();
createEntryGate();

h1Node.addEventListener("click", function () {
    if (!isInStarState) {
        isInStarState = true;
        createStarBetweenCards();
    }
});

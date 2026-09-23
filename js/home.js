// Home page (index.html) behaviour: footer hover, footer parallax, navbar anchoring,
// Lenis smooth scroll on desktop, and the dashed line / bus / altitude animations.
// Loaded at the end of <body>, so the DOM above it already exists.
document.addEventListener('DOMContentLoaded', () => {
    const footerColumns = document.querySelectorAll('.footer-column');

    footerColumns.forEach(column => {
        const heading = column.querySelector('h4');
        const list = column.querySelector('ul');

        if (heading && list) {
            list.addEventListener('mouseenter', () => {
                heading.classList.add('is-active');
            });

            list.addEventListener('mouseleave', () => {
                heading.classList.remove('is-active');
            });
        }
    });
});
document.addEventListener("DOMContentLoaded", () => {
    // Ensure GSAP and ScrollTrigger are loaded
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
        console.error("GSAP or ScrollTrigger not loaded!");
        return;
    }
    gsap.registerPlugin(ScrollTrigger);

    // Use GSAP's tool for responsive animations
    gsap.matchMedia().add({

        // Desktop screens (1025px and wider)
        isDesktop: "(min-width: 1025px)"

    }, (context) => {

        // The code inside this function will ONLY run on desktop.
        let { isDesktop } = context.conditions;

        if (isDesktop) {

            const footerParallaxTimeline = gsap.timeline({
                scrollTrigger: {
                    trigger: ".footer",
                    start: "top top",
                    end: "+=2000",
                    scrub: 2
                }
            });

            footerParallaxTimeline
                .fromTo(".layer-1", { y: 30 }, { y: 0 }, 0)
                .fromTo(".layer-2", { y: 70 }, { y: 0 }, 0)
                .fromTo(".layer-3", { y: 310 }, { y: 0 }, 0)
                .fromTo(".layer-5", { y: 340 }, { y: 0 }, 0)
                .fromTo(".footer-main-content", { y: 150 }, { y: -400, ease: "power1.out" }, 0);

            footerParallaxTimeline.fromTo(".layer-4 .figure-left",
                { x: "0" },
                {
                    x: "-100%",
                    ease: "none"
                },
                0
            );

            footerParallaxTimeline.fromTo(".layer-4 .figure-right",
                { x: "0" },
                {
                    x: "100%",
                    ease: "none"
                },
                0
            );
        }

        return () => {
            // GSAP's cleanup function automatically removes animations on browser resize.
        };
    });
});
document.addEventListener('DOMContentLoaded', () => {
    const logoImage = document.querySelector('.navbar .logo img');
    if (logoImage) {
        logoImage.addEventListener('click', () => {
            location.reload();
        });
    }
});
document.addEventListener("DOMContentLoaded", () => {
    const landingPageContainer = document.getElementById('landing-page-container');
    const navbar = document.querySelector('.navbar');
    const originalNavbarParent = navbar.parentElement; // Store its original home (<header>)
    const scrollToTopBtn = document.getElementById('scrollToBottomBtn');

    if (!landingPageContainer || !navbar) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                const isAnchored = navbar.classList.contains('navbar--anchored');

                if (!entry.isIntersecting && !isAnchored) {
                    // When scrolling past the landing page, ANCHOR the navbar
                    navbar.classList.add('navbar--anchored');
                    document.body.appendChild(navbar); // Move navbar to the <body>
                    scrollToTopBtn.classList.add('raised');
                } else if (entry.isIntersecting && isAnchored) {
                    // When scrolling back to the landing page, UN-ANCHOR it
                    navbar.classList.remove('navbar--anchored');
                    originalNavbarParent.appendChild(navbar); // Move it back to its original home
                    scrollToTopBtn.classList.remove('raised');
                }
            });
        },
        {
            rootMargin: "0px 0px -20px 0px",
            threshold: 0
        }
    );

    observer.observe(landingPageContainer);
});
    // 1. DEFINE VARIABLES IN GLOBAL SCOPE
    let lenis = null;

    // 2. ONLY LOAD/RUN IF ON DESKTOP
    // This prevents the script from even "thinking" on mobile
    // typeof guard: one file now, so a failed Lenis CDN load must not stop the rest of it
    if (window.innerWidth > 1024 && typeof Lenis !== "undefined") {
        
        // Initialize Lenis
        lenis = new Lenis({
            duration: 1.5,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            wheelMultiplier: 0.4,
            infinite: false,
        });

        // The animation loop only runs on Desktop
        function raf(time) {
            if (lenis) {
                lenis.raf(time);
                requestAnimationFrame(raf);
            }
        }
        requestAnimationFrame(raf);

        // Sync with your existing animations
        lenis.on('scroll', () => {
            if (typeof animationFrameId !== 'undefined' && !animationFrameId) {
                animationFrameId = requestAnimationFrame(runAnimations);
            }
        });
    } else {
        // MOBILE FALLBACK: 
        // Just use the standard native scroll for your Bus/Path animations
        window.addEventListener('scroll', () => {
            if (typeof animationFrameId !== 'undefined' && !animationFrameId) {
                animationFrameId = requestAnimationFrame(runAnimations);
            }
        }, { passive: true });
    }

    // 3. UNIFIED UI LOGIC (Safe for all devices)
    document.addEventListener('DOMContentLoaded', () => {
        const overlayButton = document.querySelector('.overlay-button');
        const scrollToTopBtn = document.getElementById('scrollToBottomBtn');
        const landingPage = document.getElementById('landing-page-container');

        // Scroll navigation that detects if Lenis is present
        const safeScroll = (target) => {
            if (lenis && window.innerWidth > 1024) {
                lenis.scrollTo(target, { duration: 1.5 });
            } else {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        };

        if (overlayButton && landingPage) {
            overlayButton.addEventListener('click', (e) => {
                e.preventDefault();
                safeScroll(landingPage);
            });
        }

        if (scrollToTopBtn && landingPage) {
            scrollToTopBtn.addEventListener('click', (e) => {
                e.preventDefault();
                safeScroll(landingPage);
            });
        }
    });
    // --- GLOBAL VARIABLES & INITIAL SETUP ---
    const CACHE_KEY = 'path_cache_v1';
    const CACHE_TTL = 86400000; // 24 hours
    const MIN_SPLASH_DURATION = 1200; // Minimum 1.2-second splash screen duration

    const landingPage = document.getElementById('landing-page-container');
    const scrollToTopBtn = document.getElementById('scrollToBottomBtn');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const topContentWrapper = document.querySelector('.top-content-wrapper');
    const dashedLineContainer = document.querySelector('.dashed-line');
    const svgTipCounter = document.getElementById('svg-tip-counter');
    const pathElement = document.getElementById('Line');
    const mobilePathElement = document.getElementById('mobile-line-path');
    const tabletPathElement = document.getElementById('tablet-line-path');
    const svgLine = document.querySelector(".dashed-line-center");
    const mobileSvgLine = document.getElementById('mobile-line-svg');
    const tabletSvgLine = document.getElementById('tablet-line-svg');
    const splashScreen = document.getElementById('splash-screen');
    const body = document.body;

    let pathTotalLength = 0;
    let mobilePathTotalLength = 0;
    let tabletPathTotalLength = 0;
    let checkpointsData = [];
    let animationFrameId = null;
    let lastRotationAngle = 90;

    let desktopPathCache = [];
    let mobilePathCache = [];
    let tabletPathCache = [];
    const CACHE_STEP = 3;

    // Tracks if the counter has been positioned for the first time
    let counterPositionedOnce = false;

    // --- CACHING UTILITY FUNCTIONS ---
    function loadPathCacheFromLocalStorage() {
        try {
            const cachedData = localStorage.getItem(CACHE_KEY);
            if (!cachedData) return false;

            const { data, timestamp } = JSON.parse(cachedData);
            if (Date.now() - timestamp > CACHE_TTL) {
                localStorage.removeItem(CACHE_KEY);
                return false;
            }

            // Restore available data
            desktopPathCache = data.desktop || [];
            mobilePathCache = data.mobile || [];
            tabletPathCache = data.tablet || [];

            const width = window.innerWidth;
            // VALIDATION: Only return true if the specific path needed for THIS device is ready
            if (width > 1024 && desktopPathCache.length > 0) {
                pathTotalLength = desktopPathCache.length * CACHE_STEP;
                return true;
            } 
            if (width <= 1024 && width > 600 && tabletPathCache.length > 0) {
                tabletPathTotalLength = tabletPathCache.length * CACHE_STEP;
                return true;
            }
            if (width <= 600 && mobilePathCache.length > 0) {
                mobilePathTotalLength = mobilePathCache.length * CACHE_STEP;
                return true;
            }
            return false; 
        } catch (e) { return false; }
    }

    function savePathCacheToLocalStorage() {
        const data = {
            desktop: desktopPathCache,
            mobile: mobilePathCache,
            tablet: tabletPathCache,
        };
        const cacheEntry = {
            data: data,
            timestamp: Date.now(),
        };
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry));
        } catch (e) {
            console.error('Error saving cache:', e);
        }
    }

    // --- CORE LOGIC FUNCTIONS ---
    function setupPathLengthsAndDasharrays() {
        const maskPath = document.getElementById('mask-path');
        const mobileMaskPath = document.getElementById('mobile-mask-path');
        const tabletMaskPath = document.getElementById('tablet-mask-path');

        if (pathElement && maskPath) {
            pathTotalLength = pathElement.getTotalLength();
            maskPath.style.strokeDasharray = pathTotalLength;
        }
        if (mobilePathElement && mobileMaskPath) {
            mobilePathTotalLength = mobilePathElement.getTotalLength();
            mobileMaskPath.style.strokeDasharray = mobilePathTotalLength;
        }
        if (tabletPathElement && tabletMaskPath) {
            tabletPathTotalLength = tabletPathElement.getTotalLength();
            tabletMaskPath.style.strokeDasharray = tabletPathTotalLength;
        }
    }

    function buildPathCache(path, pathLength) {
        if (!path || pathLength === 0) return [];

        const cache = [];
        for (let i = 0; i <= pathLength; i += CACHE_STEP) {
            const length = Math.min(i, pathLength);

            const currentPoint = path.getPointAtLength(length);
            const previousPoint = path.getPointAtLength(Math.max(0, length - 1));

            const angle = Math.atan2(currentPoint.y - previousPoint.y, currentPoint.x - previousPoint.x) * (180 / Math.PI);

            cache.push({ x: currentPoint.x, y: currentPoint.y, angle: angle + 90 });
        }
        return cache;
    }

    const counterTextElement = svgTipCounter ? svgTipCounter.querySelector('.counter-text') : null;
    const feetFormat = new Intl.NumberFormat('en-US');
    let lastCounterText = '';
    let pendingPopups = null;

    function updateMainCounter(currentIconYPosition) {
        if (!checkpointsData || checkpointsData.length === 0 || !svgTipCounter) return;

        let startCheckpoint = checkpointsData[0];
        let endCheckpoint = checkpointsData[0];

        for (let i = 0; i < checkpointsData.length - 1; i++) {
            if (currentIconYPosition >= checkpointsData[i].y && currentIconYPosition <= checkpointsData[i+1].y) {
                startCheckpoint = checkpointsData[i];
                endCheckpoint = checkpointsData[i+1];
                break;
            }
        }

        const scrollDistance = endCheckpoint.y - startCheckpoint.y;
        const altitudeRange = startCheckpoint.value - endCheckpoint.value;

        let progress = 0;
        if (scrollDistance > 0) {
            progress = (currentIconYPosition - startCheckpoint.y) / scrollDistance;
        }

        progress = Math.max(0, Math.min(1, progress));

        const currentValue = startCheckpoint.value - (progress * altitudeRange);

        // Only touch the DOM when the number changes: a text change forces layout and a repaint of the bus layer.
        const text = `${feetFormat.format(Math.round(Math.max(0, currentValue)))} ft`;
        if (counterTextElement && text !== lastCounterText) {
            counterTextElement.textContent = text;
            lastCounterText = text;
        }
    }

    function animateAltitude(element) {
        const finalValue = parseInt(element.dataset.finalValue, 10);
        if (isNaN(finalValue) || element.dataset.animated) return;
        element.dataset.animated = 'true';
        const startValue = parseInt(element.textContent.replace(/,/g, ''), 10);
        const duration = 1500;
        let startTime = null;
        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.floor(easedProgress * (finalValue - startValue) + startValue);
            element.textContent = currentValue.toLocaleString('en-US');
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                element.textContent = finalValue.toLocaleString('en-US');
            }
        }
        requestAnimationFrame(step);
    }

    function updateNavLayout() {
        const isMobile = window.innerWidth <= 600;
        const navLeft = document.querySelector('.nav-left');
        const navRight = document.querySelector('.nav-right');
        if (isMobile) {
            if (navRight && navRight.children.length > 0) {
                while (navRight.firstElementChild) {
                    navLeft.appendChild(navRight.firstElementChild);
                }
            }
            if (navRight) navRight.style.display = 'none';
        } else {
            if (navRight) navRight.style.display = 'flex';
        }
    }

    function positionDashedLine() {
        if (window.innerWidth <= 1024) return;
        const stateContainer1 = document.querySelector('.state-container-1');
        const stateContainer12 = document.querySelector('.state-container-12');
        if (!stateContainer1 || !stateContainer12 || !topContentWrapper || !dashedLineContainer) return;
        const topContentWrapperRect = topContentWrapper.getBoundingClientRect();
        const state1Rect = stateContainer1.getBoundingClientRect();
        const state12Rect = stateContainer12.getBoundingClientRect();
        const offset = 0;
        const actualDashedLineTop = (state1Rect.top - topContentWrapperRect.top) - offset;
        const state12MiddleY =(state12Rect.bottom);
        const actualDashedLineHeight = (state12MiddleY - state1Rect.top);
        dashedLineContainer.style.top = `${actualDashedLineTop}px`;
        dashedLineContainer.style.height = `${actualDashedLineHeight}px`;
    }

    function positionMobileDashedLine() {
        if (window.innerWidth > 1024) return;
        const firstSection = document.querySelector('.state-container-1');
        const lastSection = document.querySelector('.state-container-12');
        if (!firstSection || !lastSection || !dashedLineContainer) return;
        const bottomOffset = -40;
        const topPosition = firstSection.offsetTop;
        const bottomPosition = lastSection.offsetTop + lastSection.offsetHeight + bottomOffset;
        const containerHeight = bottomPosition - topPosition;
        dashedLineContainer.style.top = `${topPosition}px`;
        dashedLineContainer.style.height = `${containerHeight}px`;
    }

    /** CORRECTED FIX: Prevents counter drop by only making it visible once positioned. */
    function updateCounterPosition(progress, pathLength, svg, pathCache, svgRect, lineTop) {
        if (!svgTipCounter || pathLength === 0 || !svg) return 0;

        const isVisible = (progress > 0.01 && progress < 0.99);

        const clampedDrawLength = Math.max(0, Math.min(progress * pathLength, pathLength));

        const cacheIndex = Math.floor(clampedDrawLength / CACHE_STEP);
        const cachedData = pathCache[cacheIndex] || pathCache[pathCache.length - 1] || {x: 0, y: 0, angle: 90};

        const currentPoint = { x: cachedData.x, y: cachedData.y };
        let totalRotation = cachedData.angle;

        let angleDifference = totalRotation - lastRotationAngle;
        if (angleDifference > 180) totalRotation -= 360;
        else if (angleDifference < -180) totalRotation += 360;
        lastRotationAngle = totalRotation;

        let currentIconY = 0;

        if (svgRect.width > 0 && svgRect.height > 0) {
            const scaleY = svgRect.height / svg.viewBox.baseVal.height;
            const scaleX = svgRect.width / svg.viewBox.baseVal.width;
            const counterOffsetY = (svg !== svgLine) ? 30 : 0;

            const x = currentPoint.x * scaleX;
            const y = (currentPoint.y * scaleY) + counterOffsetY;

            svgTipCounter.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${totalRotation}deg)`;
            currentIconY = lineTop + (currentPoint.y * scaleY);

            // Fix for initial drop: Set flag only if the position is calculated off top/left
            if (!counterPositionedOnce) {
                if (x !== 0 || y !== 0) {
                    counterPositionedOnce = true;
                }
            }
        }

        // Only manage opacity once the counter has been positioned at least once
        if (counterPositionedOnce) {
            svgTipCounter.style.opacity = isVisible ? '1' : '0';
        }

        return currentIconY;
    }

    function animateDashedLine() {
        const maskPath = document.getElementById('mask-path');
        if (window.innerWidth <= 1024 || !maskPath || pathTotalLength === 0) return 0;
        const animationStartScrollY = topContentWrapper.offsetTop;
        const animationScrollHeight = topContentWrapper.scrollHeight - window.innerHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        let linearProgress = 1 - ((scrollTop - animationStartScrollY) / animationScrollHeight);
        linearProgress = Math.max(0, Math.min(1, linearProgress));
        const modifiedProgress = Math.pow(linearProgress, 0.95);
        maskPath.style.strokeDashoffset = pathTotalLength - (pathTotalLength * modifiedProgress);
        return modifiedProgress;
    }

    function animateMobileDashedLine(svgRect) {
        const mobileMaskPath = document.getElementById('mobile-mask-path');
        if (!mobileMaskPath || !mobilePathElement || mobilePathTotalLength === 0) return 0;
        const triggerPointY = window.innerHeight * 0.4;
        if (!svgRect || svgRect.height === 0) return 0;
        const progress = 1 - ((triggerPointY - svgRect.top) / svgRect.height);
        const clampedProgress = Math.max(0, Math.min(1, progress));
        mobileMaskPath.style.strokeDashoffset = mobilePathTotalLength - (mobilePathTotalLength * clampedProgress);
        return clampedProgress;
    }

    function animateTabletDashedLine(svgRect) {
        const tabletMaskPath = document.getElementById('tablet-mask-path');
        if (!tabletMaskPath || !tabletPathElement || tabletPathTotalLength === 0) return 0;
        const triggerPointY = window.innerHeight * 0.7;
        if (!svgRect || svgRect.height === 0) return 0;
        const progress = 1 - ((triggerPointY - svgRect.top) / svgRect.height);
        const clampedProgress = Math.max(0, Math.min(1, progress));
        tabletMaskPath.style.strokeDashoffset = tabletPathTotalLength - (tabletPathTotalLength * clampedProgress);
        return clampedProgress;
    }

    // Reads only. Shown popups drop out of the list, so this costs nothing once all are visible.
    function findPopupsToShow() {
        if (!pendingPopups) pendingPopups = [...document.querySelectorAll('.h2-popup:not(.visible)')];
        const triggerThreshold = window.innerHeight * 0.20;
        const toShow = [];
        pendingPopups = pendingPopups.filter(popup => {
            const h2 = popup.nextElementSibling;
            if (!h2) return false;
            const h2Rect = h2.getBoundingClientRect();
            if (h2Rect.bottom < 0 || h2Rect.top > window.innerHeight) return true;
            const h2TriggerPoint = h2Rect.top + (h2Rect.height * 0.6);
            if (h2TriggerPoint > triggerThreshold) {
                toShow.push(popup);
                return false;
            }
            return true;
        });
        return toShow;
    }

    function showPopups(popups) {
        popups.forEach(popup => {
            popup.classList.add('visible');
            const altitudeValueElement = popup.querySelector('.altitude-value');
            if (altitudeValueElement) {
                animateAltitude(altitudeValueElement);
            }
        });
    }

    let lastTouchY = 0;
    let isBouncingTop = false;
    let isBouncingBottom = false;
    const scrollBlockingKeys = ['ArrowUp', 'ArrowDown', ' ', 'PageUp', 'PageDown'];

    function handleOverscroll(event) {
        if (window.innerWidth > 1024 || body.classList.contains('noscroll') || isBouncingTop || isBouncingBottom) return;
        const touchY = event.touches[0].clientY;
        const isScrollingUp = touchY > lastTouchY;
        const atTop = window.pageYOffset === 0;
        if (atTop && isScrollingUp && topContentWrapper) {
            isBouncingTop = true; topContentWrapper.classList.add('pull-down-bounce-animation');
            setTimeout(() => { topContentWrapper.classList.remove('pull-down-bounce-animation'); isBouncingTop = false; }, 600);
        }
        const isScrollingDown = touchY < lastTouchY;
        const atBottom = Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight;
        if (atBottom && isScrollingDown && landingPage) {
            isBouncingBottom = true; landingPage.classList.add('push-up-bounce-animation');
            setTimeout(() => { landingPage.classList.remove('push-up-bounce-animation'); isBouncingBottom = false; }, 600);
        }
        lastTouchY = touchY;
    }

    function preventKeyboardJump(e) {
        if (scrollBlockingKeys.includes(e.key)) e.preventDefault();
    }

    function runAnimations() {
        animationFrameId = null;
        const screenWidth = window.innerWidth;
        let progress = 0;
        let currentIconY = 0;

        // All layout reads first, then all writes. A read after a write forces a synchronous
        // layout mid-frame, which WebKit (every iOS browser) pays for far more than Blink does.
        const svg = screenWidth > 1024 ? svgLine : (screenWidth > 600 ? tabletSvgLine : mobileSvgLine);
        const svgRect = svg ? svg.getBoundingClientRect() : null;
        const lineTop = dashedLineContainer ? dashedLineContainer.offsetTop : 0;
        const popupsToShow = findPopupsToShow();

        if (screenWidth > 1024) {
            progress = animateDashedLine();
            currentIconY = updateCounterPosition(progress, pathTotalLength, svgLine, desktopPathCache, svgRect, lineTop);
        }
        else if (screenWidth > 600) {
            progress = animateTabletDashedLine(svgRect);
            currentIconY = updateCounterPosition(progress, tabletPathTotalLength, tabletSvgLine, tabletPathCache, svgRect, lineTop);
        }
        else {
            progress = animateMobileDashedLine(svgRect);
            currentIconY = updateCounterPosition(progress, mobilePathTotalLength, mobileSvgLine, mobilePathCache, svgRect, lineTop);
        }

        updateMainCounter(currentIconY);
        showPopups(popupsToShow);
    }

    //function to display the scroll up prompt

/* 
function showScrollTutorial() {
    const tutorial = document.getElementById('scroll-tutorial');
    if (!tutorial) return;

    // --- COOLDOWN LOGIC (30 Minutes) ---
    const COOLDOWN_MS = 30 * 60 * 1000; // 30 mins in milliseconds
    const lastSeen = localStorage.getItem('tutorialLastSeen');
    const now = Date.now();

    // If seen recently (less than 30 mins ago), hide and exit
    if (lastSeen && (now - lastSeen < COOLDOWN_MS)) {
        tutorial.style.display = 'none';
        return;
    }

    // 1. Show the element
    tutorial.style.display = 'flex';
    
    // 2. Force a reflow and fade in
    setTimeout(() => {
        tutorial.style.opacity = '1';
    }, 100);

    const dismissTutorial = () => {
        tutorial.style.opacity = '0';
        setTimeout(() => {
            tutorial.style.display = 'none';
            document.body.classList.remove('noscroll');
            
            // --- UPDATE TIMESTAMP ON DISMISS ---
            localStorage.setItem('tutorialLastSeen', Date.now());
        }, 800);

        window.removeEventListener('wheel', dismissTutorial);
        window.removeEventListener('touchstart', dismissTutorial);
    };

    // 3. Grace period before listening for scroll
    setTimeout(() => {
        window.addEventListener('wheel', dismissTutorial, { passive: true, once: true });
        window.addEventListener('touchstart', dismissTutorial, { passive: true, once: true });
    }, 1000);

    // 4. Auto-dismiss after 4 seconds total
    setTimeout(dismissTutorial, 3000);
}
*/

    function scrollFinalize() {
        // Unlock body from splash screen state
        document.body.classList.remove('loading-active');

        if (landingPage) {
            // Move to bottom instantly
            landingPage.scrollIntoView({ behavior: 'instant' });
        }
    }

    // ----------------------------------------------------
    // --- CRITICAL FIX: Asynchronous Initialization ---
    // ----------------------------------------------------
function initializeHeavyContent(startTime) {
    const isCacheLoaded = loadPathCacheFromLocalStorage();
    const width = window.innerWidth;
    const splashImg = document.getElementById('splash-image');

    // 1. Existing Path Calculation Logic
    if (!isCacheLoaded) {
        if (width > 1024) {
            pathTotalLength = pathElement.getTotalLength();
            desktopPathCache = buildPathCache(pathElement, pathTotalLength);
        } else if (width > 600) {
            tabletPathTotalLength = tabletPathElement.getTotalLength();
            tabletPathCache = buildPathCache(tabletPathElement, tabletPathTotalLength);
        } else {
            mobilePathTotalLength = mobilePathElement.getTotalLength();
            mobilePathCache = buildPathCache(mobilePathElement, mobilePathTotalLength);
        }
        savePathCacheToLocalStorage();
    }

    // Apply DashArrays
    const m = document.getElementById('mask-path'), tm = document.getElementById('tablet-mask-path'), mm = document.getElementById('mobile-mask-path');
    if(m) m.style.strokeDasharray = (desktopPathCache.length * CACHE_STEP) || pathElement.getTotalLength();
    if(tm) tm.style.strokeDasharray = (tabletPathCache.length * CACHE_STEP) || tabletPathElement.getTotalLength();
    if(mm) mm.style.strokeDasharray = (mobilePathCache.length * CACHE_STEP) || mobilePathElement.getTotalLength();

    // Setup Checkpoints
    const containers = document.querySelectorAll('.state-container');
    checkpointsData = [];
    containers.forEach(c => {
        const val = c.querySelector('.altitude-value');
        if (val) checkpointsData.push({ y: c.offsetTop, value: parseInt(val.dataset.finalValue) });
    });
    if (containers.length > 0) {
        const last = containers[containers.length-1];
        checkpointsData.push({ y: last.offsetTop + last.offsetHeight, value: 0 });
    }
    checkpointsData.sort((a, b) => a.y - b.y);

    if (width <= 1024) positionMobileDashedLine(); else positionDashedLine();
    runAnimations();
    updateNavLayout();

    // 2. PROGRESSIVE COLOR LOGIC
    const elapsed = performance.now() - startTime;
    const delay = isCacheLoaded ? 800 : Math.max(1500, MIN_SPLASH_DURATION - elapsed);
    
    let progress = 0;
    const intervalTime = 50; // Update every 50ms
    const step = 100 / (delay / intervalTime);

    const progressInterval = setInterval(() => {
        progress += step;
        if (progress >= 100) {
            progress = 100;
            clearInterval(progressInterval);
        }
        if (splashImg) {
            // Update the CSS variable
            splashImg.style.setProperty('--load-progress', progress + '%');
        }
    }, intervalTime);

    // 3. Close Splash
    setTimeout(() => {
        clearInterval(progressInterval); // Ensure it's cleared
        if (splashImg) splashImg.style.setProperty('--load-progress', '100%');
        
        if (splashScreen) splashScreen.classList.add('hidden');
        scrollFinalize();
    }, delay);

    // Intersection Observer logic
    const isMobile = window.innerWidth <= 600;
    const observerOptions = { 
        root: null, 
        rootMargin: isMobile ? '0px 0px -10% 0px' : '0px 0px -25% 0px', 
        threshold: isMobile ? 0.2 : 0.6 
    };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => { 
            if (e.isIntersecting) { 
                e.target.classList.add('is-visible'); 
                observer.unobserve(e.target); 
            } 
        });
    }, observerOptions);
    containers.forEach(c => observer.observe(c)); 
}

// --- EVENT LISTENERS & INITIALIZATION ---
    window.onload = () => {
        const startTime = performance.now(); // Start timer immediately on load

        // CRITICAL: Apply the scroll lock immediately on load
        body.classList.add('loading-active');

        // 1. Synchronous setup of SVG lengths
        setupPathLengthsAndDasharrays();

        // 2. DEFER THE HEAVY WORK
        const delay = loadPathCacheFromLocalStorage() ? 5 : 50;
        setTimeout(() => initializeHeavyContent(startTime), delay);
    };

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 1024) {
            positionMobileDashedLine();
        } else {
            positionDashedLine();
        }
        runAnimations();
        updateNavLayout();
    });

    window.addEventListener('scroll', () => {
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(runAnimations);
        }

        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollableHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrollFraction = scrollableHeight > 0 ? (scrollTop / scrollableHeight) : 0;
        if (scrollFraction < 0.5) {
            scrollToTopBtn.classList.remove('is-hidden');
        } else {
            scrollToTopBtn.classList.add('is-hidden');
        }
    }, { passive: true });

    scrollToTopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (landingPage) landingPage.scrollIntoView({ behavior: 'smooth' });
    });

    const navbar = document.querySelector('.navbar');
    mobileMenuToggle.addEventListener('click', () => {
        navbar.classList.toggle('nav-open');
        body.classList.toggle('noscroll');
        document.documentElement.classList.toggle('noscroll');
        scrollToTopBtn.classList.toggle('is-hidden-by-nav');
        const isExpanded = navbar.classList.contains('nav-open');
        mobileMenuToggle.setAttribute('aria-expanded', isExpanded);
    });

    const overlayButton = document.querySelector('.overlay-button');
    if (overlayButton && landingPage) {
        overlayButton.addEventListener('click', (event) => {
            event.preventDefault();
            const targetScrollY = landingPage.offsetTop - window.innerHeight;
            window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
        });
    }

    window.addEventListener('touchstart', (e) => {
        if (window.innerWidth <= 1024) { lastTouchY = e.touches[0].clientY; }
    }, { passive: true });

    // Passive: a non-passive touchmove on window makes iOS wait for the main thread before every scroll step.
    // The native rubber-band this used to preventDefault is now off via overscroll-behavior-y in style4.css.
    window.addEventListener('touchmove', handleOverscroll, { passive: true });
    window.addEventListener('keydown', preventKeyboardJump, { passive: false });
    history.scrollRestoration = 'manual';

function getSectionIdForActivePage(sectionId) {
    const pageMeta = portfolioPageMeta[activePortfolioPage] || portfolioPageMeta.videos;

    if (sectionId === 'home') {
        return pageMeta.home;
    }

    if (sectionId === 'about') {
        return pageMeta.about;
    }

    return sectionId;
}

function scrollToSection(sectionId) {
    const resolvedSectionId = getSectionIdForActivePage(sectionId);
    const element = document.getElementById(resolvedSectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

let smoothScrollTargetY = null;
let smoothScrollFrame = null;
let smoothScrollEnabled = false;
let pendingPortfolioPageSwitch = null;
const SMOOTH_SCROLL_TOP_SNAP = 2;
const SMOOTH_SCROLL_BOTTOM_SNAP = 2;
const SMOOTH_SCROLL_EDGE_ZONE = 42;
const PORTFOLIO_PAGE_SWITCH_TOP_THRESHOLD = 18;
const NAVBAR_TOP_IDLE_THRESHOLD = 16;
const MUTE_ICON_SRC = 'media/images/icons/mute.png';
const VOLUME_ICON_SRC = 'media/images/icons/volume-on.png';

let carouselItems = [];
let carouselVideos = [];
let galleryVideos = [];
let totalCarouselItems = 0;
let carouselPosition = 0;
let carouselTrackElement = null;
let isCarouselDragging = false;
let carouselDragStartX = 0;
let carouselDragOffsetX = 0;
let suppressCarouselVideoClick = false;
let isMuted = true;
let currentVolume = 0.72;
let lastVolume = 0.72;

let siteLoaderElement = null;
let navbarElement = null;
let hamburgerButtonElement = null;
let menuOverlayElement = null;
let menuOverlayNavElement = null;
let menuOrbitElement = null;
let menuOverlayLinks = [];
let menuOverlayAboutLinkElement = null;
let menuOverlayAboutPanelElement = null;
let customCursorElement = null;
let contactWidgetElement = null;
let contactWidgetToggleElement = null;
let contactWidgetCloseElement = null;
let carouselContainerElement = null;
let volumeSliderElement = null;
let mouseTrailShellElement = null;
let mouseTrailLayerElement = null;
let portfolioPagesContainerElement = null;
let portfolioPages = [];
let portfolioPageLinkCards = [];
let imageLibraryShellElement = null;
let imageLibrarySidebarElement = null;
let imageLibraryContentElement = null;
let imageCategoryButtons = [];
let imageCategoryPanels = [];
let imageSectionButtons = [];
let imageComparisonElements = [];
let imageComparisonOptionButtons = [];
let imageRestorationOptionButtons = [];
let imageLibraryPinViewportTop = null;
let imageLibraryPinnedScrollFrame = null;
let imageLibraryContinuousPanelElement = null;
let imageLibraryContinuousHeadLabelElement = null;
let imageLibraryContinuousHeadTitleElement = null;
let imageLibraryContinuousGridElement = null;
let imageLibraryContinuousTrackElement = null;
let imageGalleryContinuousSections = [];
let imageGalleryContinuousSectionLookup = new Map();
let videoOverlayElement = null;
let videoOverlayPlayer = null;
let videoOverlayCloseButton = null;
let overlaySourceVideo = null;
let imageOverlayElement = null;
let imageOverlayImage = null;
let imageOverlayCloseButton = null;
let activePortfolioPage = 'videos';
let activeImageGalleryCategory = 'cinematic';
let isNavbarHovered = false;
let isNavbarScrollActive = false;
let navbarBlurTimeout = null;

const portfolioPageMeta = {
    videos: {
        subtitle: 'AI Creator Portfolio / Videos & Animation',
        home: 'home',
        about: 'about'
    },
    images: {
        subtitle: 'AI Creator Portfolio / Image Generation & Enhancement',
        home: 'home-images',
        about: 'about-images'
    },
    comfy: {
        subtitle: 'AI Creator Portfolio / Custom ComfyUI Workflows & Solutions',
        home: 'home-comfy',
        about: 'about-comfy'
    }
};

const MENU_PREVIEW_CONFIG = {
    videos: { activeClass: 'is-video-preview', linkSelector: '.menu-overlay-link-videos', hitAreaSelector: '.menu-video-preview-hitarea' },
    images: { activeClass: 'is-image-preview', linkSelector: '.menu-overlay-link-images', hitAreaSelector: '.menu-image-preview-hitarea' },
    comfy: { activeClass: 'is-comfy-preview', linkSelector: '.menu-overlay-link-comfy', hitAreaSelector: '.menu-comfy-preview-hitarea' }
};

function shouldHandleSmoothScroll(event) {
    if (!smoothScrollEnabled || !event) {
        return false;
    }

    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
        return false;
    }

    if (videoOverlayElement?.classList.contains('is-open') || imageOverlayElement?.classList.contains('is-open')) {
        return false;
    }

    if (document.body.classList.contains('menu-open')) {
        return false;
    }

    const interactiveAncestor = event.target instanceof Element
        ? event.target.closest('input:not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select, [contenteditable="true"], .volume-slider')
        : null;

    return !interactiveAncestor;
}

function completePendingPortfolioPageSwitchIfReady(scrollRoot) {
    if (!pendingPortfolioPageSwitch || !scrollRoot) {
        return false;
    }

    if (scrollRoot.scrollTop > PORTFOLIO_PAGE_SWITCH_TOP_THRESHOLD) {
        return false;
    }

    const nextPage = pendingPortfolioPageSwitch;
    pendingPortfolioPageSwitch = null;
    smoothScrollTargetY = null;
    smoothScrollFrame = null;
    scrollRoot.scrollTop = 0;
    switchPortfolioPage(nextPage, false);
    return true;
}

function stepSmoothScroll() {
    const scrollRoot = document.scrollingElement || document.documentElement;
    const maxScroll = Math.max(0, scrollRoot.scrollHeight - window.innerHeight);

    if (smoothScrollTargetY === null) {
        smoothScrollFrame = null;
        return;
    }

    if (smoothScrollTargetY >= maxScroll - SMOOTH_SCROLL_BOTTOM_SNAP && scrollRoot.scrollTop >= maxScroll - SMOOTH_SCROLL_BOTTOM_SNAP) {
        scrollRoot.scrollTop = maxScroll;
        smoothScrollTargetY = null;
        smoothScrollFrame = null;
        return;
    }

    if (smoothScrollTargetY <= SMOOTH_SCROLL_TOP_SNAP && scrollRoot.scrollTop <= SMOOTH_SCROLL_TOP_SNAP) {
        scrollRoot.scrollTop = 0;
        smoothScrollTargetY = null;
        smoothScrollFrame = null;
        completePendingPortfolioPageSwitchIfReady(scrollRoot);
        return;
    }

    const targetDelta = smoothScrollTargetY - scrollRoot.scrollTop;
    const distanceToTop = scrollRoot.scrollTop;
    const distanceToBottom = Math.max(0, maxScroll - scrollRoot.scrollTop);
    const isNearEdge = distanceToTop <= SMOOTH_SCROLL_EDGE_ZONE || distanceToBottom <= SMOOTH_SCROLL_EDGE_ZONE;
    const easing = isNearEdge ? 0.04 : 0.052;
    const minStep = isNearEdge ? 0.04 : 0.12;
    const delta = targetDelta * easing;

    if (Math.abs(delta) < minStep) {
        scrollRoot.scrollTop = Math.max(0, Math.min(maxScroll, smoothScrollTargetY));
        smoothScrollTargetY = null;
        smoothScrollFrame = null;
        completePendingPortfolioPageSwitchIfReady(scrollRoot);
        return;
    }

    scrollRoot.scrollTop += delta;
    if (completePendingPortfolioPageSwitchIfReady(scrollRoot)) {
        return;
    }

    smoothScrollFrame = window.requestAnimationFrame(stepSmoothScroll);
}

function handleSmoothWheel(event) {
    if (!shouldHandleSmoothScroll(event)) {
        return;
    }

    const deltaY = event.deltaY || (-event.wheelDelta) || 0;
    if (!deltaY) {
        return;
    }

    event.preventDefault();

    const scrollRoot = document.scrollingElement || document.documentElement;
    const maxScroll = Math.max(0, scrollRoot.scrollHeight - window.innerHeight);
    const nextTarget = (smoothScrollTargetY ?? scrollRoot.scrollTop) + (deltaY * 2.24);
    smoothScrollTargetY = Math.max(0, Math.min(maxScroll, nextTarget));

    if (deltaY < 0 && smoothScrollTargetY <= SMOOTH_SCROLL_TOP_SNAP) {
        smoothScrollTargetY = 0;
    }

    if (deltaY > 0 && smoothScrollTargetY >= maxScroll - SMOOTH_SCROLL_BOTTOM_SNAP) {
        smoothScrollTargetY = maxScroll;
    }

    if (!smoothScrollFrame) {
        smoothScrollFrame = window.requestAnimationFrame(stepSmoothScroll);
    }
}

function initSmoothScroll() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        smoothScrollEnabled = false;
        return;
    }

    smoothScrollEnabled = true;
    window.addEventListener('wheel', handleSmoothWheel, { passive: false });
}

function syncCustomCursor(event) {
    if (!(event instanceof MouseEvent) || !customCursorElement) {
        return;
    }

    customCursorElement.classList.add('is-visible');
    customCursorElement.style.left = `${event.clientX}px`;
    customCursorElement.style.top = `${event.clientY}px`;
}

function hideCustomCursor() {
    customCursorElement?.classList.remove('is-visible', 'is-pressed');
}

function setCustomCursorPressed(isPressed) {
    customCursorElement?.classList.toggle('is-pressed', isPressed);
}

function handleMouseTrailMove(event) {
    if (!mouseTrailLayerElement || !(event instanceof MouseEvent)) {
        return;
    }

    const rect = mouseTrailLayerElement.getBoundingClientRect();
    if (!rect.width || !rect.height) {
        return;
    }

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    mouseTrailLayerElement.style.setProperty('--trail-x', `${x}%`);
    mouseTrailLayerElement.style.setProperty('--trail-y', `${y}%`);
}

function syncNavbarThreshold() {
    if (!navbarElement) {
        return;
    }

    const isAtTop = window.scrollY <= NAVBAR_TOP_IDLE_THRESHOLD || isImageLibraryShellPinned();
    navbarElement.classList.toggle('is-initial-state', isAtTop);
    navbarElement.classList.toggle('is-collapsed', !isAtTop && !isNavbarScrollActive && !isNavbarHovered);
}

function scheduleNavbarBlurFade() {
    if (navbarBlurTimeout) {
        window.clearTimeout(navbarBlurTimeout);
    }

    navbarBlurTimeout = window.setTimeout(() => {
        isNavbarScrollActive = false;
        syncNavbarThreshold();
    }, 240);
}

function updateFloatingNavbar() {
    isNavbarScrollActive = window.scrollY > NAVBAR_TOP_IDLE_THRESHOLD && !isImageLibraryShellPinned();
    syncNavbarThreshold();
    if (isNavbarScrollActive) {
        scheduleNavbarBlurFade();
    }
}

function closeContactWidget() {
    if (!contactWidgetElement || !contactWidgetToggleElement) {
        return;
    }

    contactWidgetElement.classList.remove('is-open');
    contactWidgetToggleElement.setAttribute('aria-expanded', 'false');
    document.getElementById('contactWidgetPanel')?.setAttribute('aria-hidden', 'true');
}

function openContactWidget() {
    if (!contactWidgetElement || !contactWidgetToggleElement) {
        return;
    }

    contactWidgetElement.classList.add('is-open');
    contactWidgetToggleElement.setAttribute('aria-expanded', 'true');
    document.getElementById('contactWidgetPanel')?.setAttribute('aria-hidden', 'false');
}

function toggleContactWidget() {
    if (!contactWidgetElement) {
        return;
    }

    if (contactWidgetElement.classList.contains('is-open')) {
        closeContactWidget();
    } else {
        openContactWidget();
    }
}

function handleContactWidgetOutsideClick(event) {
    if (!contactWidgetElement?.classList.contains('is-open') || !(event.target instanceof Node)) {
        return;
    }

    if (contactWidgetElement.contains(event.target)) {
        return;
    }

    closeContactWidget();
}

function clearMenuPreviewState() {
    return;
}

function setMenuPreview(previewKey, isActive) {
    return;
}

function resetMenuOverlayAboutParallax() {
    if (!menuOverlayNavElement) {
        return;
    }

    menuOverlayNavElement.style.setProperty('--about-image-shift-x', '0px');
    menuOverlayNavElement.style.setProperty('--about-image-shift-y', '0px');
    menuOverlayNavElement.style.setProperty('--about-text-shift-x', '0px');
    menuOverlayNavElement.style.setProperty('--about-text-shift-y', '0px');
}

function setMenuOverlayEngaged(isEngaged) {
    menuOverlayNavElement?.classList.toggle('is-engaged', isEngaged);
}

function closeMenuOverlay() {
    if (!menuOverlayElement || !hamburgerButtonElement) {
        return;
    }

    clearMenuPreviewState();
    menuOverlayNavElement?.classList.remove('is-about-mode');
    menuOverlayAboutPanelElement?.setAttribute('aria-hidden', 'true');
    resetMenuOverlayAboutParallax();
    menuOverlayElement.classList.remove('is-open');
    menuOverlayElement.setAttribute('aria-hidden', 'true');
    hamburgerButtonElement.classList.remove('is-active');
    hamburgerButtonElement.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
}

function openMenuOverlay() {
    if (!menuOverlayElement || !hamburgerButtonElement) {
        return;
    }

    clearMenuPreviewState();
    menuOverlayNavElement?.classList.remove('is-about-mode');
    menuOverlayAboutPanelElement?.setAttribute('aria-hidden', 'true');
    menuOverlayElement.classList.add('is-open');
    menuOverlayElement.setAttribute('aria-hidden', 'false');
    hamburgerButtonElement.classList.add('is-active');
    hamburgerButtonElement.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-open');
    setMenuOverlayEngaged(true);
}

function toggleMenuOverlay() {
    if (!menuOverlayElement) {
        return;
    }

    if (menuOverlayElement.classList.contains('is-open')) {
        closeMenuOverlay();
    } else {
        openMenuOverlay();
    }
}

function updateMenuOverlayProximity(clientX, clientY) {
    if (!menuOverlayElement || !menuOrbitElement || !menuOverlayElement.classList.contains('is-open')) {
        return;
    }

    const orbitRect = menuOrbitElement.getBoundingClientRect();
    const centerX = orbitRect.left + orbitRect.width / 2;
    const centerY = orbitRect.top + orbitRect.height / 2;
    const distance = Math.hypot(clientX - centerX, clientY - centerY);

    setMenuOverlayEngaged(distance <= 600);
}

function updateMenuOverlayAboutParallax(event) {
    if (!menuOverlayNavElement || !menuOverlayNavElement.classList.contains('is-about-mode') || !(event instanceof MouseEvent)) {
        return;
    }

    const rect = menuOverlayNavElement.getBoundingClientRect();
    if (!rect.width || !rect.height) {
        return;
    }

    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    menuOverlayNavElement.style.setProperty('--about-image-shift-x', `${x * 8}px`);
    menuOverlayNavElement.style.setProperty('--about-image-shift-y', `${y * 8}px`);
    menuOverlayNavElement.style.setProperty('--about-text-shift-x', `${x * 3}px`);
    menuOverlayNavElement.style.setProperty('--about-text-shift-y', `${y * 3}px`);
}

function toggleMenuOverlayAbout() {
    if (!menuOverlayNavElement || !menuOverlayAboutPanelElement) {
        return;
    }

    const willOpen = !menuOverlayNavElement.classList.contains('is-about-mode');
    menuOverlayNavElement.classList.toggle('is-about-mode', willOpen);
    menuOverlayAboutPanelElement.setAttribute('aria-hidden', String(!willOpen));
    if (!willOpen) {
        resetMenuOverlayAboutParallax();
    }
}

function closeMenuOverlayAbout() {
    if (!menuOverlayNavElement?.classList.contains('is-about-mode')) {
        return false;
    }

    menuOverlayNavElement.classList.remove('is-about-mode');
    menuOverlayAboutPanelElement?.setAttribute('aria-hidden', 'true');
    resetMenuOverlayAboutParallax();
    return true;
}

function handleMenuOverlayBackgroundClick(event) {
    if (!menuOverlayElement?.classList.contains('is-open') || !(event.target instanceof Node)) {
        return;
    }

    if (menuOverlayNavElement?.contains(event.target)) {
        return;
    }

    if (!closeMenuOverlayAbout()) {
        closeMenuOverlay();
    }
}

function ensureVideoOverlay() {
    if (videoOverlayElement) {
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'media-overlay';
    overlay.id = 'videoOverlay';
    overlay.innerHTML = `
        <div class="media-overlay-inner">
            <button class="media-overlay-close" type="button" aria-label="Close video overlay">X</button>
            <video playsinline controls controlslist="nofullscreen nodownload noremoteplayback" disablepictureinpicture preload="metadata"></video>
        </div>
    `;

    document.body.appendChild(overlay);
    videoOverlayElement = overlay;
    videoOverlayPlayer = overlay.querySelector('video');
    videoOverlayCloseButton = overlay.querySelector('.media-overlay-close');

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeVideoOverlay();
        }
    });
    videoOverlayCloseButton?.addEventListener('click', closeVideoOverlay);
}

function getVideoSource(video) {
    if (!(video instanceof HTMLVideoElement)) {
        return '';
    }

    const source = video.querySelector('source');
    return source?.getAttribute('src') || source?.dataset.src || video.currentSrc || '';
}

function hydrateLazyVideo(video) {
    if (!(video instanceof HTMLVideoElement)) {
        return false;
    }

    const source = video.querySelector('source');
    const deferredSource = source?.dataset.src;
    if (!source || !deferredSource || source.getAttribute('src')) {
        return false;
    }

    video.classList.add('is-loading-source');
    source.setAttribute('src', deferredSource);
    video.load();
    video.addEventListener('canplay', () => {
        video.classList.remove('is-loading-source');
        video.classList.add('is-source-ready');
    }, { once: true });
    return true;
}

function playLazyVideo(video) {
    hydrateLazyVideo(video);
    return video.play().catch(() => undefined);
}

function initViewportLazyAutoplayVideos() {
    const lazyAutoplayVideos = Array.from(document.querySelectorAll('video[data-lazy-video][autoplay][muted][loop]'))
        .filter((video) => !video.closest('.carousel-item'));

    if (!lazyAutoplayVideos.length) {
        return;
    }

    if (!('IntersectionObserver' in window)) {
        lazyAutoplayVideos.forEach((video) => playLazyVideo(video));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            const video = entry.target;
            if (!(video instanceof HTMLVideoElement)) {
                return;
            }

            if (entry.isIntersecting) {
                playLazyVideo(video);
            } else {
                video.pause();
            }
        });
    }, {
        rootMargin: '420px 0px',
        threshold: 0.01
    });

    lazyAutoplayVideos.forEach((video) => observer.observe(video));
}

function openVideoOverlay(video) {
    if (!(video instanceof HTMLVideoElement) || !videoOverlayElement || !videoOverlayPlayer) {
        return;
    }

    const source = getVideoSource(video);
    if (!source) {
        return;
    }

    overlaySourceVideo = video;
    video.pause();
    videoOverlayPlayer.controls = true;
    videoOverlayPlayer.controlsList?.add('nofullscreen');
    videoOverlayPlayer.controlsList?.add('nodownload');
    videoOverlayPlayer.controlsList?.add('noremoteplayback');
    videoOverlayPlayer.disablePictureInPicture = true;
    videoOverlayPlayer.preload = 'metadata';
    videoOverlayPlayer.src = source;
    videoOverlayPlayer.poster = video.getAttribute('poster') || '';
    videoOverlayPlayer.load();
    videoOverlayElement.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    videoOverlayPlayer.play().catch(() => undefined);
}

function closeVideoOverlay() {
    if (!videoOverlayElement || !videoOverlayPlayer) {
        return;
    }

    videoOverlayElement.classList.remove('is-open');
    videoOverlayPlayer.pause();
    videoOverlayPlayer.removeAttribute('src');
    videoOverlayPlayer.load();
    document.body.style.overflow = '';
    if (overlaySourceVideo?.closest('.carousel-item') && activePortfolioPage === 'videos') {
        playLazyVideo(overlaySourceVideo);
    }
    overlaySourceVideo = null;
}

function ensureImageOverlay() {
    if (imageOverlayElement) {
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'media-overlay';
    overlay.id = 'imageOverlay';
    overlay.innerHTML = `
        <div class="media-overlay-inner">
            <button class="media-overlay-close" type="button" aria-label="Close image overlay">X</button>
            <img alt="">
        </div>
    `;

    document.body.appendChild(overlay);
    imageOverlayElement = overlay;
    imageOverlayImage = overlay.querySelector('img');
    imageOverlayCloseButton = overlay.querySelector('.media-overlay-close');

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeImageOverlay();
        }
    });

    imageOverlayCloseButton?.addEventListener('click', closeImageOverlay);
    overlay.addEventListener('mousemove', updateImageOverlayParallax, { passive: true });
    overlay.addEventListener('mouseleave', resetImageOverlayParallax);
}

function updateImageOverlayParallax(event) {
    if (!imageOverlayElement?.classList.contains('is-open') || !imageOverlayElement || !(event instanceof MouseEvent)) {
        return;
    }

    const rect = imageOverlayElement.getBoundingClientRect();
    if (!rect.width || !rect.height) {
        return;
    }

    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    imageOverlayElement.style.setProperty('--overlay-image-shift-x', `${x * 10}px`);
    imageOverlayElement.style.setProperty('--overlay-image-shift-y', `${y * 10}px`);
}

function resetImageOverlayParallax() {
    imageOverlayElement?.style.setProperty('--overlay-image-shift-x', '0px');
    imageOverlayElement?.style.setProperty('--overlay-image-shift-y', '0px');
}

function openImageOverlay(image) {
    if (!(image instanceof HTMLImageElement) || !imageOverlayElement || !imageOverlayImage) {
        return;
    }

    imageOverlayImage.src = image.currentSrc || image.src;
    imageOverlayImage.alt = image.alt || '';
    imageOverlayElement.classList.add('is-open');
    document.body.style.overflow = 'hidden';
}

function closeImageOverlay() {
    if (!imageOverlayElement || !imageOverlayImage) {
        return;
    }

    imageOverlayElement.classList.remove('is-open');
    imageOverlayImage.removeAttribute('src');
    imageOverlayImage.alt = '';
    resetImageOverlayParallax();
    document.body.style.overflow = '';
}

function updateCarousel() {
    if (!carouselItems.length || !carouselContainerElement) {
        return;
    }

    const activeIndex = ((carouselPosition % totalCarouselItems) + totalCarouselItems) % totalCarouselItems;
    const containerWidth = carouselContainerElement.getBoundingClientRect().width;
    const gap = 19;
    const itemWidth = containerWidth * 0.68;
    const translateX = -((itemWidth + gap) * activeIndex) + ((containerWidth - itemWidth) / 2) + carouselDragOffsetX;
    if (carouselTrackElement) {
        carouselTrackElement.style.transform = `translate3d(${translateX}px, 0, 0)`;
    }

    carouselItems.forEach((item, index) => {
        item.classList.toggle('is-active', index === activeIndex);
    });

    playCurrentCarouselVideo();
}

function openCarouselItemVideo(item) {
    if (!(item instanceof Element)) {
        return;
    }

    const video = item.querySelector('video');
    if (video instanceof HTMLVideoElement) {
        openVideoOverlay(video);
    }
}

function endCarouselDrag(pointerId = null) {
    if (!carouselContainerElement) {
        return;
    }

    if (pointerId !== null) {
        try {
            carouselContainerElement.releasePointerCapture(pointerId);
        } catch {}
    }

    const threshold = Math.max(56, carouselContainerElement.getBoundingClientRect().width * 0.08);
    if (carouselDragOffsetX <= -threshold) {
        carouselPosition += 1;
    } else if (carouselDragOffsetX >= threshold) {
        carouselPosition -= 1;
    }

    isCarouselDragging = false;
    carouselDragStartX = 0;
    carouselDragOffsetX = 0;
    carouselContainerElement.classList.remove('is-dragging');
    updateCarousel();

    window.setTimeout(() => {
        suppressCarouselVideoClick = false;
    }, 0);
}

function initCarouselDrag() {
    if (!carouselContainerElement || !carouselTrackElement) {
        return;
    }

    carouselContainerElement.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
        }

        isCarouselDragging = true;
        carouselDragStartX = event.clientX;
        carouselDragOffsetX = 0;
        suppressCarouselVideoClick = false;
        carouselContainerElement.classList.add('is-dragging');
        carouselContainerElement.setPointerCapture(event.pointerId);
    });

    carouselContainerElement.addEventListener('pointermove', (event) => {
        if (!isCarouselDragging) {
            return;
        }

        carouselDragOffsetX = event.clientX - carouselDragStartX;
        if (Math.abs(carouselDragOffsetX) > 6) {
            suppressCarouselVideoClick = true;
        }
        updateCarousel();
    });

    carouselContainerElement.addEventListener('pointerup', (event) => {
        if (!isCarouselDragging) {
            return;
        }
        const draggedEnoughToSuppressClick = suppressCarouselVideoClick;
        const pointerTarget = event.target instanceof Element ? event.target.closest('.carousel-item') : null;
        endCarouselDrag(event.pointerId);
        if (!draggedEnoughToSuppressClick) {
            openCarouselItemVideo(pointerTarget);
        }
    });

    carouselContainerElement.addEventListener('pointercancel', (event) => {
        if (!isCarouselDragging) {
            return;
        }
        endCarouselDrag(event.pointerId);
    });

    carouselContainerElement.addEventListener('lostpointercapture', () => {
        if (!isCarouselDragging) {
            return;
        }
        endCarouselDrag();
    });
}

function playCurrentCarouselVideo() {
    const activeIndex = ((carouselPosition % totalCarouselItems) + totalCarouselItems) % totalCarouselItems;
    carouselVideos.forEach((video, index) => {
        video.muted = isMuted;
        video.volume = isMuted ? 0 : currentVolume;
        if (index === activeIndex && activePortfolioPage === 'videos') {
            playLazyVideo(video);
        } else {
            video.pause();
        }
    });
}

function moveCarousel(direction) {
    if (!totalCarouselItems) {
        return;
    }

    carouselPosition += direction;
    updateCarousel();
}

function syncMuteButtonState() {
    const muteBtn = document.getElementById('muteBtn');
    const muteIcon = muteBtn?.querySelector('.mute-btn-icon');
    const isSoundOn = !isMuted && currentVolume > 0;

    muteBtn?.setAttribute('aria-pressed', String(isMuted));
    muteBtn?.setAttribute('aria-label', isSoundOn ? 'Mute sound' : 'Unmute sound');

    if (muteIcon instanceof HTMLImageElement) {
        muteIcon.src = isSoundOn ? VOLUME_ICON_SRC : MUTE_ICON_SRC;
    }
}

function toggleMute() {
    isMuted = !isMuted;
    if (!isMuted && currentVolume <= 0) {
        currentVolume = lastVolume || 0.72;
        if (volumeSliderElement) {
            volumeSliderElement.value = String(Math.round(currentVolume * 100));
        }
    }

    carouselVideos.forEach((video) => {
        video.muted = isMuted;
        video.volume = isMuted ? 0 : currentVolume;
    });

    syncMuteButtonState();
}

window.moveCarousel = moveCarousel;
window.toggleMute = toggleMute;

function updatePortfolioSubtitle() {
    const subtitle = document.querySelector('.navbar-subtitle');
    if (!subtitle) {
        return;
    }

    subtitle.textContent = (portfolioPageMeta[activePortfolioPage] || portfolioPageMeta.videos).subtitle;
}

function updatePortfolioPageLinks() {
    portfolioPageLinkCards.forEach((card) => {
        const isSelected = card.getAttribute('data-portfolio-page-link') === activePortfolioPage;
        card.classList.toggle('is-selected', isSelected);
        card.setAttribute('aria-pressed', String(isSelected));
    });
}

function syncActivePortfolioPageAttribute() {
    document.body.dataset.activePortfolioPage = activePortfolioPage;
}

function syncPortfolioPagesHeight(animate = false) {
    if (!portfolioPagesContainerElement) {
        return;
    }

    const activePageElement = portfolioPages.find((page) => page.classList.contains('is-active'));
    if (!activePageElement) {
        portfolioPagesContainerElement.style.height = '';
        return;
    }

    const nextHeight = activePageElement.scrollHeight;
    if (!animate) {
        portfolioPagesContainerElement.style.height = `${nextHeight}px`;
        window.setTimeout(() => {
            portfolioPagesContainerElement.style.height = 'auto';
        }, 40);
        return;
    }

    const currentHeight = portfolioPagesContainerElement.getBoundingClientRect().height;
    portfolioPagesContainerElement.style.height = `${currentHeight}px`;
    window.requestAnimationFrame(() => {
        portfolioPagesContainerElement.style.height = `${nextHeight}px`;
    });
    window.setTimeout(() => {
        portfolioPagesContainerElement.style.height = 'auto';
    }, 520);
}

function switchPortfolioPage(pageKey, shouldScrollToTop = true) {
    if (!portfolioPageMeta[pageKey]) {
        return;
    }

    activePortfolioPage = pageKey;
    syncActivePortfolioPageAttribute();
    portfolioPages.forEach((page) => {
        const isActive = page.getAttribute('data-portfolio-page') === pageKey;
        page.classList.toggle('is-active', isActive);
        page.classList.toggle('is-leaving', !isActive);
        page.setAttribute('aria-hidden', String(!isActive));
    });

    syncPortfolioPagesHeight(true);
    updatePortfolioSubtitle();
    updatePortfolioPageLinks();
    imageLibraryPinViewportTop = null;
    scheduleImageLibraryPinnedScrollSync();

    if (pageKey === 'videos') {
        window.setTimeout(() => {
            playCurrentCarouselVideo();
        }, 120);
    } else {
        carouselVideos.forEach((video) => video.pause());
    }

    if (shouldScrollToTop) {
        scrollToSection('home');
    }
}

function switchPortfolioPageFromNavigation(pageKey) {
    if (!portfolioPageMeta[pageKey]) {
        return;
    }

    const scrollRoot = document.scrollingElement || document.documentElement;
    const currentTop = scrollRoot.scrollTop;

    if (currentTop <= PORTFOLIO_PAGE_SWITCH_TOP_THRESHOLD) {
        pendingPortfolioPageSwitch = null;
        switchPortfolioPage(pageKey, false);
        return;
    }

    pendingPortfolioPageSwitch = pageKey;
    smoothScrollTargetY = 0;
    if (!smoothScrollFrame) {
        smoothScrollFrame = window.requestAnimationFrame(stepSmoothScroll);
    }
}

function getImageGalleryCategoryOrder() {
    return imageCategoryButtons
        .map((button) => button.getAttribute('data-image-category'))
        .filter(Boolean);
}

function getImageGalleryPanelByKey(categoryKey) {
    return imageCategoryPanels.find((panel) => panel.getAttribute('data-gallery-category') === categoryKey) ?? null;
}

function resetImageGalleryContinuousState() {
    imageGalleryContinuousSections = [];
    imageGalleryContinuousSectionLookup = new Map();
}

function refreshImageGalleryContinuousSectionState() {
    if (!imageLibraryContinuousTrackElement) {
        resetImageGalleryContinuousState();
        return [];
    }

    imageGalleryContinuousSections = Array.from(
        imageLibraryContinuousTrackElement.querySelectorAll('.image-library-category-section')
    ).map((section) => ({
        categoryKey: section.getAttribute('data-gallery-category') || '',
        element: section,
        label: section.getAttribute('data-gallery-label') || 'Photo / Visual Gallery',
        heading: section.getAttribute('data-gallery-heading') || ''
    })).filter((entry) => entry.categoryKey);

    imageGalleryContinuousSectionLookup = new Map(
        imageGalleryContinuousSections.map((entry) => [entry.categoryKey, entry])
    );

    return imageGalleryContinuousSections;
}

function getImageGalleryContinuousSection(categoryKey) {
    if (!imageGalleryContinuousSectionLookup.size) {
        refreshImageGalleryContinuousSectionState();
    }

    return imageGalleryContinuousSectionLookup.get(categoryKey) ?? null;
}

function getActiveImageLibraryHead() {
    return imageLibraryContinuousPanelElement?.querySelector('.image-library-panel-head') ?? null;
}

function fitActiveImageLibraryTitle() {
    const head = getActiveImageLibraryHead();
    const title = head?.querySelector('h2');
    if (!(title instanceof HTMLElement) || !(head instanceof HTMLElement)) {
        return;
    }

    title.style.removeProperty('font-size');
    if (window.innerWidth <= 640) {
        return;
    }

    const computed = window.getComputedStyle(title);
    let nextSize = parseFloat(computed.fontSize) || 40;
    const minSize = window.innerWidth <= 980 ? 22 : 24;
    const headWidth = head.clientWidth || 0;

    if (!headWidth) {
        return;
    }

    title.style.fontSize = `${nextSize}px`;
    while (title.scrollWidth > headWidth && nextSize > minSize) {
        nextSize -= 0.5;
        title.style.fontSize = `${nextSize}px`;
    }
}

function buildContinuousImageLibrary() {
    if (!imageLibraryContentElement || !imageCategoryPanels.length) {
        return;
    }

    imageLibraryContinuousPanelElement?.remove();
    resetImageGalleryContinuousState();

    const categoryOrder = getImageGalleryCategoryOrder();
    const categoryMeta = categoryOrder.map((categoryKey) => {
        const panel = getImageGalleryPanelByKey(categoryKey);
        const heading = panel?.querySelector('.image-library-panel-head h2')?.textContent?.trim() || '';
        const label = panel?.querySelector('.image-library-panel-head .image-library-panel-label')?.textContent?.trim() || 'Photo / Visual Gallery';
        const cards = Array.from(panel?.querySelectorAll('.image-library-card') || []);
        return { categoryKey, heading, label, cards };
    }).filter((entry) => entry.cards.length);

    if (!categoryMeta.length) {
        return;
    }

    const continuousPanel = document.createElement('div');
    continuousPanel.className = 'image-library-panel image-library-panel-continuous is-active';
    continuousPanel.setAttribute('data-gallery-category', 'continuous');

    const head = document.createElement('div');
    head.className = 'image-library-panel-head';
    const headLabel = document.createElement('p');
    headLabel.className = 'image-library-panel-label';
    headLabel.textContent = categoryMeta[0].label;
    const headTitle = document.createElement('h2');
    headTitle.textContent = categoryMeta[0].heading;
    head.append(headLabel, headTitle);

    const grid = document.createElement('div');
    grid.className = 'image-library-grid';
    const track = document.createElement('div');
    track.className = 'image-library-grid-track';

    categoryMeta.forEach((entry) => {
        const section = document.createElement('section');
        section.className = 'image-library-category-section';
        section.setAttribute('data-gallery-category', entry.categoryKey);
        section.setAttribute('data-gallery-label', entry.label);
        section.setAttribute('data-gallery-heading', entry.heading);
        section.setAttribute('aria-hidden', 'true');

        const sectionTrack = document.createElement('div');
        sectionTrack.className = 'image-library-category-section-track';
        entry.cards.forEach((card) => {
            const clone = card.cloneNode(true);
            clone.setAttribute('data-gallery-category', entry.categoryKey);
            sectionTrack.appendChild(clone);
        });
        section.appendChild(sectionTrack);
        track.appendChild(section);
    });

    grid.appendChild(track);
    continuousPanel.append(head, grid);
    imageLibraryContentElement.prepend(continuousPanel);

    imageCategoryPanels.forEach((panel) => {
        panel.hidden = true;
        panel.classList.remove('is-active');
        panel.setAttribute('aria-hidden', 'true');
    });

    imageLibraryContinuousPanelElement = continuousPanel;
    imageLibraryContinuousHeadLabelElement = headLabel;
    imageLibraryContinuousHeadTitleElement = headTitle;
    imageLibraryContinuousGridElement = grid;
    imageLibraryContinuousTrackElement = track;
    refreshImageGalleryContinuousSectionState();
}

function applyImageGalleryCategoryState(categoryKey) {
    activeImageGalleryCategory = categoryKey;
    const sectionState = getImageGalleryContinuousSection(categoryKey);

    imageCategoryButtons.forEach((button) => {
        const isActive = button.getAttribute('data-image-category') === categoryKey;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });

    if (sectionState && imageLibraryContinuousHeadLabelElement && imageLibraryContinuousHeadTitleElement) {
        imageLibraryContinuousHeadLabelElement.textContent = sectionState.label;
        imageLibraryContinuousHeadTitleElement.textContent = sectionState.heading;
    }

    fitActiveImageLibraryTitle();
}

function getImageLibrarySequenceMetrics() {
    if (!mouseTrailShellElement || !imageLibraryShellElement || !imageLibrarySidebarElement || !imageLibraryContentElement || !imageLibraryContinuousTrackElement) {
        return null;
    }

    const currentShellOffset = parseFloat(mouseTrailShellElement.style.getPropertyValue('--image-shell-pin-offset')) || 0;
    const shellRect = mouseTrailShellElement.getBoundingClientRect();
    const availableViewportHeight = Math.max(0, window.innerHeight - Math.max(shellRect.top - currentShellOffset, 0) - 16);
    const stageHeight = Math.max(availableViewportHeight, 540);
    const naturalShellTop = shellRect.top + window.scrollY - currentShellOffset;

    if (imageLibraryPinViewportTop === null) {
        imageLibraryPinViewportTop = shellRect.top - currentShellOffset;
    }

    const startScrollY = naturalShellTop - imageLibraryPinViewportTop;
    const sidebarHeight = Math.ceil(imageLibrarySidebarElement.offsetHeight);
    const headHeight = Math.ceil(getActiveImageLibraryHead()?.offsetHeight || 0);
    const releaseGridHeight = Math.max(0, sidebarHeight - headHeight - 24);
    const totalScrollLength = Math.max(0, imageLibraryContinuousTrackElement.scrollHeight - releaseGridHeight);
    const sections = refreshImageGalleryContinuousSectionState();
    const metrics = sections.map((entry, index) => {
        const nextEntry = sections[index + 1] || null;
        const startOffset = Math.max(0, entry.element.offsetTop);
        const nextOffset = nextEntry ? Math.max(startOffset, nextEntry.element.offsetTop) : totalScrollLength;
        return {
            categoryKey: entry.categoryKey,
            startOffset,
            endOffset: nextOffset
        };
    });

    return {
        stageHeight,
        startScrollY,
        totalScrollLength,
        headHeight,
        metrics
    };
}

function isImageLibraryShellPinned() {
    return activePortfolioPage === 'images' && mouseTrailShellElement?.classList.contains('is-image-shell-pinned');
}

function syncImageLibraryPinnedScroll() {
    imageLibraryPinnedScrollFrame = null;

    if (!mouseTrailShellElement || !imageLibraryShellElement || !imageLibrarySidebarElement || !imageLibraryContentElement || activePortfolioPage !== 'images' || window.innerWidth <= 980) {
        mouseTrailShellElement?.style.setProperty('--image-shell-pin-offset', '0px');
        mouseTrailShellElement?.classList.remove('is-image-shell-pinned');
        imageLibraryContentElement?.style.removeProperty('--image-library-stage-height');
        imageLibraryContentElement?.style.removeProperty('--image-library-panel-head-height');
        if (imageLibraryContinuousTrackElement) {
            imageLibraryContinuousTrackElement.style.transform = 'translate3d(0, 0, 0)';
        }
        return;
    }

    const sequence = getImageLibrarySequenceMetrics();
    if (!sequence || !sequence.metrics.length || !imageLibraryContinuousTrackElement) {
        return;
    }

    imageLibraryContentElement.style.setProperty('--image-library-stage-height', `${sequence.stageHeight}px`);
    imageLibraryContentElement.style.setProperty('--image-library-panel-head-height', `${sequence.headHeight}px`);

    const progress = Math.max(0, Math.min(sequence.totalScrollLength, window.scrollY - sequence.startScrollY));
    let activeMetric = sequence.metrics[0];
    sequence.metrics.forEach((metric) => {
        if (progress >= metric.startOffset) {
            activeMetric = metric;
        }
    });

    if (activeMetric.categoryKey !== activeImageGalleryCategory) {
        applyImageGalleryCategoryState(activeMetric.categoryKey);
    }

    mouseTrailShellElement.style.setProperty('--image-shell-pin-offset', `${progress}px`);
    mouseTrailShellElement.classList.toggle('is-image-shell-pinned', progress > 0 && progress < sequence.totalScrollLength);
    imageLibraryContinuousTrackElement.style.transform = `translate3d(0, ${-progress}px, 0)`;
}

function scheduleImageLibraryPinnedScrollSync() {
    if (imageLibraryPinnedScrollFrame) {
        return;
    }

    imageLibraryPinnedScrollFrame = window.requestAnimationFrame(syncImageLibraryPinnedScroll);
}

function scrollImageGalleryToCategory(categoryKey) {
    const scrollRoot = document.scrollingElement || document.documentElement;
    if (activePortfolioPage !== 'images' || window.innerWidth <= 980 || !scrollRoot) {
        applyImageGalleryCategoryState(categoryKey);
        const section = getImageGalleryContinuousSection(categoryKey);
        section?.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }

    syncPortfolioPagesHeight(false);
    scheduleImageLibraryPinnedScrollSync();

    window.requestAnimationFrame(() => {
        const sequence = getImageLibrarySequenceMetrics();
        const targetMetric = sequence?.metrics.find((metric) => metric.categoryKey === categoryKey);
        if (!sequence || !targetMetric) {
            applyImageGalleryCategoryState(categoryKey);
            return;
        }

        const maxScroll = Math.max(0, scrollRoot.scrollHeight - window.innerHeight);
        const targetOffset = Math.max(0, Math.min(sequence.totalScrollLength, targetMetric.startOffset));
        const nextTargetY = Math.max(0, Math.min(maxScroll, sequence.startScrollY + targetOffset));
        smoothScrollTargetY = nextTargetY;
        if (!smoothScrollFrame) {
            smoothScrollFrame = window.requestAnimationFrame(stepSmoothScroll);
        }
    });
}

function setImageComparisonPosition(element, clientX) {
    if (!element) {
        return;
    }

    const rect = element.getBoundingClientRect();
    if (!rect.width) {
        return;
    }

    const relative = (clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, relative));
    element.style.setProperty('--comparison-position', `${(clamped * 100).toFixed(2)}%`);
    element.classList.toggle('is-near-start', clamped <= 0.06);
    element.classList.toggle('is-near-end', clamped >= 0.94);
}

function initImageComparisons() {
    imageComparisonElements.forEach((element) => {
        let isDragging = false;
        element.style.setProperty('--comparison-position', '54%');
        element.classList.remove('is-near-start', 'is-near-end');

        element.addEventListener('pointerdown', (event) => {
            isDragging = true;
            element.setPointerCapture(event.pointerId);
            setImageComparisonPosition(element, event.clientX);
        });

        element.addEventListener('pointermove', (event) => {
            if (isDragging) {
                setImageComparisonPosition(element, event.clientX);
            }
        });

        element.addEventListener('pointerup', () => {
            isDragging = false;
        });

        element.addEventListener('pointercancel', () => {
            isDragging = false;
        });
    });
}

function setImageComparisonOption(button) {
    if (!(button instanceof HTMLElement)) {
        return;
    }

    const comparisonSection = button.closest('.image-enhancement-showcase');
    const comparisonElement = comparisonSection?.querySelector('[data-image-comparison]');
    if (!(comparisonElement instanceof HTMLElement)) {
        return;
    }

    const baseImage = comparisonElement.querySelector('.image-comparison-base img');
    const overlayImage = comparisonElement.querySelector('.image-comparison-overlay img');
    if (!(baseImage instanceof HTMLImageElement) || !(overlayImage instanceof HTMLImageElement)) {
        return;
    }

    const beforeSrc = button.getAttribute('data-before-src');
    const beforeAlt = button.getAttribute('data-before-alt') || 'Base image version for enhancement comparison';
    const afterSrc = button.getAttribute('data-after-src');
    const afterAlt = button.getAttribute('data-after-alt') || 'Enhanced image version for enhancement comparison';

    if (!beforeSrc || !afterSrc) {
        return;
    }

    comparisonSection.querySelectorAll('[data-image-comparison-option]').forEach((option) => {
        option.classList.toggle('is-active', option === button);
    });

    comparisonElement.classList.add('is-swapping');
    window.setTimeout(() => {
        baseImage.src = beforeSrc;
        baseImage.alt = beforeAlt;
        overlayImage.src = afterSrc;
        overlayImage.alt = afterAlt;
        comparisonElement.style.setProperty('--comparison-position', '54%');
        comparisonElement.classList.remove('is-near-start', 'is-near-end', 'is-swapping');
    }, 120);
}

function setImageRestorationOpacity(value) {
    const compare = document.querySelector('[data-restoration-compare]');
    if (!(compare instanceof HTMLElement)) {
        return;
    }

    const normalized = Math.min(100, Math.max(0, Number(value) || 0)) / 100;
    compare.style.setProperty('--restoration-opacity', normalized.toFixed(2));
}

function syncImageRestorationOptionHeight() {
    const compare = document.querySelector('[data-restoration-compare]');
    const options = document.querySelector('.image-restoration-options');
    if (!(compare instanceof HTMLElement) || !(options instanceof HTMLElement)) {
        return;
    }

    options.style.setProperty('--restoration-option-height', `${compare.clientHeight}px`);
}

function setImageRestorationOption(button) {
    if (!(button instanceof HTMLElement)) {
        return;
    }

    const compare = document.querySelector('[data-restoration-compare]');
    const baseImage = compare?.querySelector('.image-restoration-base');
    const overlayImage = compare?.querySelector('.image-restoration-overlay');
    const slider = document.querySelector('[data-restoration-slider]');

    if (!(compare instanceof HTMLElement) || !(baseImage instanceof HTMLImageElement) || !(overlayImage instanceof HTMLImageElement)) {
        return;
    }

    const beforeSrc = button.getAttribute('data-before-src');
    const beforeAlt = button.getAttribute('data-before-alt') || 'Original image for restoration comparison';
    const afterSrc = button.getAttribute('data-after-src');
    const afterAlt = button.getAttribute('data-after-alt') || 'Restored image for restoration comparison';

    if (!beforeSrc || !afterSrc) {
        return;
    }

    imageRestorationOptionButtons.forEach((option) => {
        option.classList.toggle('is-active', option === button);
    });

    baseImage.src = beforeSrc;
    baseImage.alt = beforeAlt;
    overlayImage.src = afterSrc;
    overlayImage.alt = afterAlt;

    if (slider instanceof HTMLInputElement) {
        slider.value = '0';
    }

    setImageRestorationOpacity(0);
    syncImageRestorationOptionHeight();
}

document.addEventListener('DOMContentLoaded', () => {
    siteLoaderElement = document.getElementById('siteLoader');
    navbarElement = document.querySelector('.navbar');
    hamburgerButtonElement = document.getElementById('hamburger');
    menuOverlayElement = document.getElementById('menuOverlay');
    menuOverlayNavElement = menuOverlayElement?.querySelector('.menu-overlay-nav') ?? null;
    menuOrbitElement = document.getElementById('menuOverlayOrbit');
    menuOverlayLinks = menuOverlayElement ? Array.from(menuOverlayElement.querySelectorAll('.menu-overlay-link')) : [];
    menuOverlayAboutLinkElement = document.getElementById('menuOverlayAboutLink');
    menuOverlayAboutPanelElement = document.getElementById('menuOverlayAboutPanel');
    customCursorElement = document.getElementById('customCursor');
    contactWidgetElement = document.getElementById('contactWidget');
    contactWidgetToggleElement = document.getElementById('contactWidgetToggle');
    contactWidgetCloseElement = document.getElementById('contactWidgetClose');
    carouselContainerElement = document.querySelector('.carousel-container');
    carouselTrackElement = carouselContainerElement?.querySelector('.carousel-track') || null;
    volumeSliderElement = document.getElementById('volumeSlider');
    mouseTrailShellElement = document.querySelector('.site-glass-shell');
    mouseTrailLayerElement = document.getElementById('mouseTrailLayer');
    portfolioPagesContainerElement = document.getElementById('portfolioPages');
    portfolioPages = Array.from(document.querySelectorAll('[data-portfolio-page]'));
    portfolioPageLinkCards = Array.from(document.querySelectorAll('[data-portfolio-page-link]'));
    imageLibraryShellElement = document.querySelector('.portfolio-page-images .image-library-shell');
    imageLibrarySidebarElement = document.querySelector('.portfolio-page-images .image-library-sidebar');
    imageLibraryContentElement = document.querySelector('.portfolio-page-images .image-library-content');
    imageCategoryButtons = Array.from(document.querySelectorAll('[data-image-category]'));
    imageSectionButtons = Array.from(document.querySelectorAll('[data-image-section-target]'));
    imageCategoryPanels = Array.from(document.querySelectorAll('[data-gallery-category]'));
    imageComparisonElements = Array.from(document.querySelectorAll('[data-image-comparison]'));
    imageComparisonOptionButtons = Array.from(document.querySelectorAll('[data-image-comparison-option]'));
    imageRestorationOptionButtons = Array.from(document.querySelectorAll('[data-restoration-option]'));
    carouselItems = Array.from(document.querySelectorAll('.carousel-item'));
    carouselVideos = Array.from(document.querySelectorAll('.carousel-item video'));
    galleryVideos = Array.from(document.querySelectorAll('.gallery-media video'));
    totalCarouselItems = carouselItems.length;

    ensureVideoOverlay();
    ensureImageOverlay();
    initSmoothScroll();
    buildContinuousImageLibrary();
    applyImageGalleryCategoryState(activeImageGalleryCategory);
    initImageComparisons();
    syncImageRestorationOptionHeight();
    syncActivePortfolioPageAttribute();
    updatePortfolioSubtitle();
    updatePortfolioPageLinks();

    carouselVideos.forEach((video) => {
        video.muted = isMuted;
        video.volume = isMuted ? 0 : currentVolume;
    });

    galleryVideos.forEach((video) => {
        video.muted = true;
        video.preload = 'none';
        video.addEventListener('click', () => openVideoOverlay(video));
    });

    initViewportLazyAutoplayVideos();

    volumeSliderElement?.addEventListener('input', (event) => {
        const value = Number(event.target.value) / 100;
        currentVolume = value;
        lastVolume = value > 0 ? value : lastVolume;
        isMuted = value <= 0;
        playCurrentCarouselVideo();
        syncMuteButtonState();
    });

    syncMuteButtonState();

    if (customCursorElement && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        document.addEventListener('mousemove', syncCustomCursor, { passive: true });
        document.addEventListener('mousedown', () => setCustomCursorPressed(true));
        document.addEventListener('mouseup', () => setCustomCursorPressed(false));
        document.addEventListener('mouseleave', hideCustomCursor);
        window.addEventListener('blur', hideCustomCursor);
    }

    mouseTrailShellElement?.addEventListener('mousemove', handleMouseTrailMove, { passive: true });
    menuOverlayElement?.addEventListener('mousemove', (event) => {
        updateMenuOverlayProximity(event.clientX, event.clientY);
        updateMenuOverlayAboutParallax(event);
    }, { passive: true });
    menuOverlayElement?.addEventListener('click', handleMenuOverlayBackgroundClick);

    navbarElement?.addEventListener('mouseenter', () => {
        isNavbarHovered = true;
        syncNavbarThreshold();
    });
    navbarElement?.addEventListener('mouseleave', () => {
        isNavbarHovered = false;
        syncNavbarThreshold();
    });

    hamburgerButtonElement?.addEventListener('click', toggleMenuOverlay);
    menuOverlayAboutLinkElement?.addEventListener('click', toggleMenuOverlayAbout);

    Object.entries(MENU_PREVIEW_CONFIG).forEach(([previewKey, config]) => {
        const link = menuOverlayElement?.querySelector(config.linkSelector);
        const hitArea = menuOverlayElement?.querySelector(config.hitAreaSelector);
        link?.addEventListener('mouseenter', () => setMenuPreview(previewKey, true));
        link?.addEventListener('mouseleave', () => setMenuPreview(previewKey, false));
        hitArea?.addEventListener('mouseenter', () => setMenuPreview(previewKey, true));
        hitArea?.addEventListener('mouseleave', () => setMenuPreview(previewKey, false));
    });

    menuOverlayLinks.forEach((button) => {
        button.addEventListener('click', () => {
            const pageKey = button.getAttribute('data-page');
            if (!pageKey) {
                return;
            }
            closeMenuOverlay();
            switchPortfolioPageFromNavigation(pageKey);
        });
    });

    contactWidgetToggleElement?.addEventListener('click', toggleContactWidget);
    contactWidgetCloseElement?.addEventListener('click', closeContactWidget);
    document.addEventListener('click', handleContactWidgetOutsideClick);

    document.querySelectorAll('.contact-form').forEach((contactForm) => {
        contactForm.addEventListener('submit', (event) => {
            event.preventDefault();
            contactForm.reset();
            closeContactWidget();
        });
    });

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', function (event) {
            const href = this.getAttribute('href');
            if (href && href !== '#') {
                event.preventDefault();
                scrollToSection(href.substring(1));
            }
        });
    });

    portfolioPageLinkCards.forEach((card) => {
        const activate = () => {
            const pageKey = card.getAttribute('data-portfolio-page-link');
            if (pageKey) {
                switchPortfolioPageFromNavigation(pageKey);
            }
        };

        card.addEventListener('click', activate);
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activate();
            }
        });
    });

    imageCategoryButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const nextCategory = button.getAttribute('data-image-category');
            if (nextCategory) {
                scrollImageGalleryToCategory(nextCategory);
            }
        });
    });

    imageSectionButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const targetKey = button.getAttribute('data-image-section-target');
            const targetId = targetKey === 'restylize'
                ? 'imageRestylizeShowcase'
                : targetKey === 'restoration'
                    ? 'imageRestorationShowcase'
                    : 'imageEnhancementShowcase';
            document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    imageComparisonOptionButtons.forEach((button) => {
        button.addEventListener('click', () => setImageComparisonOption(button));
    });

    imageRestorationOptionButtons.forEach((button) => {
        button.addEventListener('click', () => setImageRestorationOption(button));
    });

    const restorationSlider = document.querySelector('[data-restoration-slider]');
    if (restorationSlider instanceof HTMLInputElement) {
        restorationSlider.addEventListener('input', (event) => {
            setImageRestorationOpacity(event.target.value);
        });
    }

    initCarouselDrag();
    window.addEventListener('resize', syncImageRestorationOptionHeight);

    document.querySelectorAll('.image-library-card img').forEach((image) => {
        image.setAttribute('tabindex', '0');
        image.addEventListener('click', () => openImageOverlay(image));
        image.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openImageOverlay(image);
            }
        });
    });

    window.addEventListener('scroll', () => {
        updateFloatingNavbar();
        scheduleImageLibraryPinnedScrollSync();
    }, { passive: true });

    window.addEventListener('resize', () => {
        updateCarousel();
        fitActiveImageLibraryTitle();
        syncPortfolioPagesHeight(false);
        scheduleImageLibraryPinnedScrollSync();
        syncNavbarThreshold();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }

        if (menuOverlayElement?.classList.contains('is-open')) {
            closeMenuOverlay();
        }
        if (videoOverlayElement?.classList.contains('is-open')) {
            closeVideoOverlay();
        }
        if (imageOverlayElement?.classList.contains('is-open')) {
            closeImageOverlay();
        }
    });

    updateCarousel();
    syncPortfolioPagesHeight(false);
    scheduleImageLibraryPinnedScrollSync();
    syncNavbarThreshold();

    window.setTimeout(() => {
        siteLoaderElement?.classList.add('is-hidden');
        document.body.classList.remove('is-loading');
    }, 900);
});

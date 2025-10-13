(function () {
    'use strict';

    // Configuration (tweak these to your liking)
    const config = {
        sliderWidthPx: Math.min(400, window.innerWidth * 0.4), // Responsive width, max 400px or 40% of screen
        sliderHeightPx: 12,
        knobSizePx: 16,
        stepSize: 0.01,             // 1% increments
        wheelStep: 0.05,            // 5% per wheel notch (normal scroll)
        shiftWheelStep: 0.01,       // 1% when holding Shift (fine control)
        showHudMs: 700              // HUD display duration
    };

    let bootObserver;
    let panelObserver;
    let resizeObserver;

    function clamp01(v) { return Math.max(0, Math.min(1, v)); }
    function pct(v) { return Math.round(v * 100); }

    function findVideo() {
        return document.querySelector('.html5-main-video') || document.querySelector('video');
    }

    function findPlayer() {
        return document.querySelector('.html5-video-player');
    }

    function findVolumePanel() {
        return document.querySelector('.ytp-volume-panel');
    }
    function findLeftControls() {
        return document.querySelector('.ytp-left-controls');
    }

    function getYT() {
        const p = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
        const api = !!(p && typeof p.getVolume === 'function' && typeof p.setVolume === 'function');
        return { p, api };
    }

    // Create or return the HUD element that shows the numeric volume
    function getOrCreateHud(container) {
        let hud = container.querySelector('.ztv-volume-hud');
        if (!hud) {
            hud = document.createElement('div');
            hud.className = 'ztv-volume-hud';
            container.appendChild(hud);
        }
        return hud;
    }

    function showHud(container, volume) {
        if (!container) return;
        const hud = getOrCreateHud(container);
        if (!hud) return;
        hud.textContent = pct(volume) + '%';
        hud.style.display = 'block';
        // Force reflow to ensure display change takes effect
        hud.offsetHeight;
        hud.classList.add('show');
        if (hud._hideTimer) clearTimeout(hud._hideTimer);
        hud._hideTimer = setTimeout(() => {
            hud.classList.remove('show');
            setTimeout(() => {
                if (hud.parentNode) hud.style.display = 'none';
            }, 150);
        }, config.showHudMs);
    }

    function removeExisting() {
        document.querySelectorAll('.ztv-enhanced-slider').forEach(n => n.remove());
    }

    function buildSliderDom() {
        const wrapper = document.createElement('div');
        wrapper.className = 'ztv-enhanced-slider';
        wrapper.innerHTML = `
            <div class="ztv-track">
                <div class="ztv-fill"></div>
                <div class="ztv-knob" role="slider" aria-label="Volume" aria-valuemin="0" aria-valuemax="100"></div>
            </div>
        `;
        return wrapper;
    }

    function updateSliderVisuals(sliderEl, volume, muted) {
        const fill = sliderEl.querySelector('.ztv-fill');
        const knob = sliderEl.querySelector('.ztv-knob');
        const disp = muted ? 0 : clamp01(volume);
        const w = disp * 100;
        fill.style.width = w + '%';
        knob.style.left = w + '%';
        knob.setAttribute('aria-valuenow', String(pct(disp)));
        knob.setAttribute('aria-valuetext', muted ? 'Muted' : pct(disp) + '%');
        sliderEl.classList.toggle('muted', !!muted);
    }

    function attachEnhancedSlider() {
    const player = findPlayer();
    const panel = findVolumePanel();
        const video = findVideo();
    const leftControls = findLeftControls();
    if (!player || !panel || !leftControls || !video) return;

        // Avoid duplicates on re-renders
    if (leftControls.dataset.ztvEnhanced === '1') return;
    leftControls.dataset.ztvEnhanced = '1';

        // Remove any stray instances
        removeExisting();

        // Keep YouTube UI intact, we just add our bigger slider next to it
        const sliderEl = buildSliderDom();
        // Place it right after the native volume panel
        if (panel.nextSibling) {
            leftControls.insertBefore(sliderEl, panel.nextSibling);
        } else {
            leftControls.appendChild(sliderEl);
        }

        // Size using inline CSS vars to avoid !important wars
        sliderEl.style.setProperty('--ztv-width', config.sliderWidthPx + 'px');
        sliderEl.style.setProperty('--ztv-height', config.sliderHeightPx + 'px');
        sliderEl.style.setProperty('--ztv-knob', config.knobSizePx + 'px');

        // Initialize visuals from YT API if possible, else video
        const { p: yt, api } = getYT();
        const initMuted = api ? !!yt.isMuted() : !!video.muted;
        const initVol = api ? clamp01((yt.getVolume() || 0) / 100) : video.volume;
        updateSliderVisuals(sliderEl, initVol, initMuted);
        // Ensure we get a measurable rect before first interaction
        requestAnimationFrame(() => updateSliderVisuals(sliderEl, initVol, initMuted));

        let dragging = false;
        let lastNonZero = initVol > 0 ? initVol : (sliderEl._lastNonZeroVolume || 0.5);

        // Helper function to click YouTube's mute button to update icon
        const toggleMuteIcon = () => {
            const muteBtn = player.querySelector('.ytp-mute-button');
            if (muteBtn) {
                muteBtn.click();
            }
        };

        const setVolume = (newVol) => {
            newVol = clamp01(newVol);
            const wasMuted = video.muted;
            
            // If we're muted and trying to set to 0% or lower, do nothing
            if (wasMuted && newVol === 0) {
                return;
            }
            
            if (newVol <= 0 && !wasMuted) {
                video.volume = 0;
                video.muted = true;
                toggleMuteIcon();
            } else if (newVol > 0 && wasMuted) {
                video.volume = newVol;
                toggleMuteIcon();
                lastNonZero = newVol;
            } else {
                video.volume = newVol;
                if (newVol > 0) {
                    lastNonZero = newVol;
                }
            }
            
            setTimeout(() => {
                updateSliderVisuals(sliderEl, video.volume, video.muted);
                showHud(player, video.muted ? 0 : video.volume);
            }, 50);
            
            sliderEl._lastNonZeroVolume = lastNonZero;
        };

        const onPointer = (clientX) => {
            const track = sliderEl.querySelector('.ztv-track');
            const rect = track.getBoundingClientRect();
            if (!rect.width || rect.width <= 1) return;
            
            let x = (clientX - rect.left) / rect.width;
            x = clamp01(x);
            // Snap to step
            x = Math.round(x / config.stepSize) * config.stepSize;
            setVolume(x);
        };

        const onDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragging = true;
            onPointer(e.clientX);
            document.body.style.cursor = 'pointer';
            // Prevent menu from disappearing while dragging
            player.classList.remove('ytp-autohide');
        };
        
        const onMove = (e) => {
            if (!dragging) return;
            e.preventDefault();
            e.stopPropagation();
            onPointer(e.clientX);
            // Show HUD while dragging
            const { p: yt, api } = getYT();
            const vol = api ? clamp01((yt.getVolume() || 0) / 100) : video.volume;
            showHud(player, vol);
        };
        
        const onUp = (e) => {
            if (dragging) {
                dragging = false;
                document.body.style.cursor = '';
                if (e) e.stopPropagation();
            }
        };

        const track = sliderEl.querySelector('.ztv-track');
        track.addEventListener('mousedown', onDown, true);
        const knobEl = sliderEl.querySelector('.ztv-knob');
        knobEl.addEventListener('mousedown', onDown, true);
        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup', onUp, true);

        // Wheel for fine control (listen on leftControls for broader support)
        let wheelTimeout = null;
        const onWheel = (e) => {
            // Accept wheel events anywhere in leftControls or on the video player itself
            const isOnControls = leftControls.contains(e.target);
            const isOnPlayer = player.contains(e.target) && !document.querySelector('.ytp-tooltip')?.contains(e.target);
            
            if (!isOnControls && !isOnPlayer) return;
            
            // Prevent YouTube's native shift+scroll (frame seek) and normal volume control
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Clear any existing timeout to prevent stuck scrolling
            if (wheelTimeout) {
                clearTimeout(wheelTimeout);
            }
            
            const step = e.shiftKey ? config.shiftWheelStep : config.wheelStep;
            const isMuted = video.muted;
            const baseVol = video.volume;
            let delta = e.deltaY;
            
            let v;
            if (delta > 0) {
                v = baseVol - step;
            } else {
                v = baseVol + step;
            }
            
            v = clamp01(v);
            v = Math.round(v / config.stepSize) * config.stepSize;
            
            // If muted at 0% and trying to go to 0%, do nothing
            if (isMuted && v === 0) {
                return false;
            }
            
            setVolume(v);
            
            // Set timeout to clear state after scrolling stops
            wheelTimeout = setTimeout(() => {
                wheelTimeout = null;
            }, 150);
            
            return false;
        };
        
        // Listen on both leftControls and player to catch all wheel events
        leftControls.addEventListener('wheel', onWheel, { passive: false, capture: true });
        player.addEventListener('wheel', onWheel, { passive: false, capture: true });
        // Sync slider when native mute button is clicked
        const muteBtn = player.querySelector('.ytp-mute-button');
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                setTimeout(() => {
                    const { p: yt, api } = getYT();
                    const muted = api ? !!yt.isMuted() : !!video.muted;
                    const vol = api ? clamp01((yt.getVolume() || 0) / 100) : video.volume;
                    updateSliderVisuals(sliderEl, vol, muted);
                    showHud(player, muted ? 0 : vol);
                }, 10);
            });
        }

        // Keep visuals synced with the real video volume regardless of how it changes
        const onVolumeChange = () => {
            const { p: yt, api } = getYT();
            const muted = api ? !!yt.isMuted() : !!video.muted;
            const vol = api ? clamp01((yt.getVolume() || 0) / 100) : video.volume;
            if (vol > 0) lastNonZero = vol;
            updateSliderVisuals(sliderEl, vol, muted);
        };
        video.addEventListener('volumechange', onVolumeChange);

        // Keyboard on knob
        const knob = sliderEl.querySelector('.ztv-knob');
        knob.tabIndex = 0;
        const keydownHandler = (e) => {
            const key = e.key;
            const { p: yt, api } = getYT();
            let v = api ? clamp01((yt.getVolume() || 0) / 100) : video.volume;
            
            let handled = false;
            let step;
            
            if (key === 'ArrowDown') {
                // Always use 1% for arrows
                step = config.stepSize;
                v = v - step;
                handled = true;
            } else if (key === 'ArrowUp') {
                // Always use 1% for arrows
                step = config.stepSize;
                v = v + step;
                handled = true;

            } else if (key === ' ' || key === 'Enter') {
                e.preventDefault();
                return;
            }
            
            if (!handled) return;
            
            e.preventDefault();
            e.stopPropagation();
            v = clamp01(v);
            v = Math.round(v / config.stepSize) * config.stepSize;
            setVolume(v);
        };
        knob.addEventListener('keydown', keydownHandler);
        knob._keydownHandler = keydownHandler;
        
        // Global arrow key handler to intercept before YouTube does
        const globalKeyHandler = (e) => {
            // Only handle arrow up/down when they would adjust volume
            // Don't intercept if user is typing in an input field
            const activeElement = document.activeElement;
            const isInputField = activeElement && (
                activeElement.tagName === 'INPUT' || 
                activeElement.tagName === 'TEXTAREA' || 
                activeElement.isContentEditable
            );
            
            if (!isInputField && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                const isMuted = video.muted;
                let v = video.volume;
                const step = config.stepSize;
                
                if (e.key === 'ArrowDown') {
                    v = v - step;
                } else {
                    v = v + step;
                }
                
                // Clamp the new volume
                v = clamp01(v);
                v = Math.round(v / config.stepSize) * config.stepSize;
                
                // If muted and trying to go to 0% or if already at 0% and going down, do nothing
                if (isMuted && (v === 0 || (video.volume === 0 && e.key === 'ArrowDown'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
                
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                setVolume(v);
                
                // Show HUD for keyboard volume changes
                const currentVol = video.volume;
                const currentMuted = video.muted;
                showHud(player, currentMuted ? 0 : currentVol);
                
                return false;
            }
        };
        // Capture phase to intercept before YouTube
        document.addEventListener('keydown', globalKeyHandler, true);
        sliderEl._globalKeyHandler = globalKeyHandler;

        // Clean up if panel detaches
        const cleanup = () => {
            video.removeEventListener('volumechange', onVolumeChange);
            try {
                track.removeEventListener('mousedown', onDown, true);
                knobEl.removeEventListener('mousedown', onDown, true);
                document.removeEventListener('mousemove', onMove, true);
                document.removeEventListener('mouseup', onUp, true);
                leftControls.removeEventListener('wheel', onWheel, true);
                player.removeEventListener('wheel', onWheel, true);
                knob.removeEventListener('keydown', knob._keydownHandler);
                if (sliderEl._globalKeyHandler) {
                    document.removeEventListener('keydown', sliderEl._globalKeyHandler, true);
                }
            } catch {}
            // Clear any pending timers
            const hud = player.querySelector('.ztv-volume-hud');
            if (hud && hud._hideTimer) clearTimeout(hud._hideTimer);
            if (wheelTimeout) clearTimeout(wheelTimeout);
            if (panelObserver && panelObserver._reattachTimer) clearTimeout(panelObserver._reattachTimer);
        };

        // Observe panel removal/rebuilds
        if (panelObserver) panelObserver.disconnect();
        panelObserver = new MutationObserver((mutations) => {
            // Only re-attach if our slider is actually missing and YouTube elements still exist
            const sliderExists = leftControls.querySelector('.ztv-enhanced-slider');
            const elementsExist = document.body.contains(leftControls) && document.body.contains(panel);
            if (!sliderExists && elementsExist) {
                // Debounce re-attachment to avoid rapid firing
                clearTimeout(panelObserver._reattachTimer);
                panelObserver._reattachTimer = setTimeout(() => {
                    if (!leftControls.querySelector('.ztv-enhanced-slider')) {
                        cleanup();
                        attachEnhancedSlider();
                    }
                }, 300);
            }
        });
        panelObserver.observe(document.body, { childList: true, subtree: true });

        // React to player size changes (fullscreen/theater) so HUD positions nicely
        if (resizeObserver) resizeObserver.disconnect();
        resizeObserver = new ResizeObserver(() => {/* layout is CSS based; visuals auto-update */});
        resizeObserver.observe(player);
    }

    function boot() {
        // Wait until the YouTube player exists then attach
        if (bootObserver) bootObserver.disconnect();
        bootObserver = new MutationObserver(() => {
            if (findPlayer() && findVolumePanel() && findVideo() && !document.querySelector('.ztv-enhanced-slider')) {
                attachEnhancedSlider();
            }
        });
        if (document.body) {
            bootObserver.observe(document.body, { childList: true, subtree: true });
        }
        // Try to attach immediately if elements are already there
        if (findPlayer() && findVolumePanel() && findVideo() && !document.querySelector('.ztv-enhanced-slider')) {
            attachEnhancedSlider();
        }
    }

    // Initial start and also on SPA navigations
    boot();
    window.addEventListener('yt-navigate-finish', boot);
})();

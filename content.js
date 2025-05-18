(function () {
    'use strict';

    // Configuration
    const config = {
        sliderWidth: 500,
        sliderHeight: 10,
        knobSize: 12,
        steps: 100,  // 100 steps (1% per step)
        stepSize: 1 / 100, // 0.01 per step
        wheelSensitivity: 0.01 // 1% per wheel tick
    };

    // Wait for video player to be ready
    function waitForVideoPlayer() {
        const observer = new MutationObserver((mutations, obs) => {
            const videoPlayer = document.querySelector('.html5-video-player');
            if (videoPlayer) {
                setTimeout(() => {
                    enhanceVolumeControl();
                }, 1000);
                obs.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Main function to enhance volume control
    function enhanceVolumeControl() {
        // Prevent duplicate or broken slider injection
        const existingSlider = document.querySelector('.enhanced-volume-slider');
        if (existingSlider) {
            existingSlider.remove();
        }

        const volumePanel = document.querySelector('.ytp-volume-panel');
        if (!volumePanel) return;

        // Cache the video element
        const video = document.querySelector('video');
        if (!video) return;

        // Hide original volume slider
        const originalSlider = document.querySelector('.ytp-volume-slider');
        if (originalSlider) {
            originalSlider.style.display = 'none';
        }

        // Create enhanced volume slider
        const enhancedSlider = document.createElement('div');
        enhancedSlider.className = 'enhanced-volume-slider';
        enhancedSlider.innerHTML = `
      <div class="enhanced-volume-slider-track">
        <div class="enhanced-volume-slider-fill"></div>
        <div class="enhanced-volume-slider-knob"></div>
      </div>
    `;

        // Insert enhanced slider
        volumePanel.appendChild(enhancedSlider);

        // Get DOM elements
        const track = enhancedSlider.querySelector('.enhanced-volume-slider-track');
        const fill = enhancedSlider.querySelector('.enhanced-volume-slider-fill');
        const knob = enhancedSlider.querySelector('.enhanced-volume-slider-knob');

        // Get initial volume
        let currentVolume = video ? video.volume : 1;

        // Update visual state based on volume
        function updateSliderState(volume) {
            const fillWidth = volume * 100;
            fill.style.width = `${fillWidth}%`;
            knob.style.left = `${fillWidth}%`;
        }

        // Initialize slider state
        updateSliderState(currentVolume);

        // Update mute button state and sync with YouTube's mute icon
        function updateMuteButton(volume) {
            if (!video) return;
            // Only set muted property if needed
            if (volume === 0 && !video.muted) {
                video.muted = true;
            } else if (volume > 0 && video.muted) {
                video.muted = false;
            }
            // Sync YouTube's mute button icon
            const volumeButton = document.querySelector('.ytp-mute-button');
            if (volumeButton) {
                if (volume === 0 && !volumeButton.classList.contains('ytp-volume-off')) {
                    volumeButton.click();
                } else if (volume > 0 && volumeButton.classList.contains('ytp-volume-off')) {
                    volumeButton.click();
                }
            }
        }

        // Handle slider interaction
        let isDragging = false;

        function handleVolumeChange(e) {
            e.preventDefault();
            if (!video) return;
            if (isDragging) {
                // Prevent default behavior
                e.stopPropagation();
            }
            // Get the mouse position relative to the track
            const rect = track.getBoundingClientRect();
            let x = e.clientX - rect.left;

            // Constrain x to the track width
            x = Math.max(0, Math.min(x, rect.width));

            // Calculate volume (0-1)
            let newVolume = x / rect.width;

            // Round to the nearest step
            newVolume = Math.round(newVolume / config.stepSize) * config.stepSize;
            newVolume = Math.max(0, Math.min(1, newVolume));

            video.volume = newVolume;
            updateSliderState(newVolume);
            updateMuteButton(newVolume);
        }

        track.addEventListener('mousedown', (e) => {
            isDragging = true;
            handleVolumeChange(e);
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                handleVolumeChange(e);
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Track mouse wheel on volume control
        enhancedSlider.addEventListener('wheel', (e) => {
            e.preventDefault(); // Prevent default scrolling
            e.stopPropagation(); // Stop event from bubbling up

            if (isDragging) return;

            const direction = Math.sign(e.deltaY);
            const wheelFineIncrement = 0.005; // Or the smaller value you found works best

            // *** Add this check: If volume is 0 and scrolling down, do nothing ***
            if (video && video.volume === 0 && direction === 1) {
                return; // Exit the handler without changing volume
            }
            // **********************************************************************

            let newVolume = video.volume - direction * wheelFineIncrement;

            // Clamp the volume between 0 and 1
            newVolume = Math.max(0, Math.min(1, newVolume));

            // Keep the snapping commented out for smoother wheel feel,
            // or uncomment if you prefer snapping even with the wheel.
            // newVolume = Math.round(newVolume / config.stepSize) * config.stepSize;

            // Update the video volume and the slider state
            video.volume = newVolume;
            updateSliderState(newVolume);
            updateMuteButton(newVolume);
        });

        // Listen for YouTube's own volume changes
        const originalVolumeBar = document.querySelector('.ytp-volume-panel');
        if (originalVolumeBar) {
            const volumeObserver = new MutationObserver(() => {
                if (video && video.volume !== currentVolume) {
                    currentVolume = video.volume;
                    updateSliderState(currentVolume);
                }
            });

            volumeObserver.observe(originalVolumeBar, {
                attributes: true
            });
        }
    }

    // Start looking for the video player when page loads
    waitForVideoPlayer();

    // Also run when navigating between videos
    window.addEventListener('yt-navigate-finish', () => {
        waitForVideoPlayer();
    });
})();

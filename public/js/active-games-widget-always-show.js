// Active Games Widget for Laser City - Always Show Version
// Widget réapparaît à chaque visite (pas de mémorisation)
(function() {
    'use strict';

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap');

        .active-games-widget {
            position: fixed;
            left: 20px;
            top: 50%;
            transform: translateY(-50%);
            width: 350px;
            background: linear-gradient(135deg, #0A0E27 0%, #1a1f3a 100%);
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3),
                        0 0 0 3px rgba(8, 247, 254, 0.2),
                        0 0 30px rgba(8, 247, 254, 0.3);
            overflow: visible;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 99999;
        }

        .active-games-widget:hover {
            transform: translateY(-50%) scale(1.02);
            box-shadow: 0 15px 50px rgba(0, 0, 0, 0.4),
                        0 0 0 3px rgba(8, 247, 254, 0.4),
                        0 0 50px rgba(8, 247, 254, 0.5);
        }

        .widget-video-container {
            position: relative;
            width: 100%;
            height: 340px;
            overflow: hidden;
            border-radius: 20px 20px 0 0;
        }

        .widget-video-container video {
            width: 100%;
            height: 100%;
            object-fit: cover;
            pointer-events: none;
        }

        .widget-video-container video::-webkit-media-controls {
            display: none !important;
        }

        .widget-video-container video::-webkit-media-controls-enclosure {
            display: none !important;
        }

        .widget-video-container video::-webkit-media-controls-panel {
            display: none !important;
        }

        .widget-video-container video::-moz-media-controls {
            display: none !important;
        }

        .widget-video-container video::--media-controls {
            display: none !important;
        }

        .video-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(to bottom,
                rgba(10, 14, 39, 0.3) 0%,
                rgba(10, 14, 39, 0.6) 100%);
        }

        .glow-effect {
            position: absolute;
            inset: 0;
            opacity: 0.4;
        }

        .glow-orb-1 {
            position: absolute;
            top: 20%;
            left: 20%;
            width: 150px;
            height: 150px;
            background: rgba(8, 247, 254, 0.3);
            border-radius: 50%;
            filter: blur(60px);
            animation: pulse 3s ease-in-out infinite;
        }

        .glow-orb-2 {
            position: absolute;
            bottom: 20%;
            right: 20%;
            width: 150px;
            height: 150px;
            background: rgba(255, 0, 229, 0.3);
            border-radius: 50%;
            filter: blur(60px);
            animation: pulse 3s ease-in-out infinite;
            animation-delay: 1.5s;
        }

        @keyframes pulse {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.1); }
        }

        .new-badge {
            position: fixed;
            left: 380px;
            top: 50%;
            transform: translateY(-50%) rotate(-5deg);
            background: rgba(255, 0, 255, 0.95);
            backdrop-filter: blur(10px);
            color: white;
            padding: 10px 22px;
            border-radius: 25px;
            font-weight: 700;
            font-size: 13px;
            text-shadow: 0 0 10px rgba(255, 0, 255, 0.9), 0 0 20px rgba(255, 0, 255, 0.6);
            box-shadow: 0 0 25px rgba(255, 0, 255, 0.7),
                        0 4px 20px rgba(255, 0, 255, 0.5),
                        0 0 0 2px rgba(255, 0, 255, 0.3);
            animation: newBadgePulse 2s ease-in-out infinite;
            z-index: 100000;
            white-space: nowrap;
        }

        @keyframes newBadgePulse {
            0%, 100% {
                transform: translateY(-50%) rotate(-5deg) scale(1);
                box-shadow: 0 0 25px rgba(255, 0, 255, 0.7),
                            0 4px 20px rgba(255, 0, 255, 0.5),
                            0 0 0 2px rgba(255, 0, 255, 0.3);
            }
            50% {
                transform: translateY(-50%) rotate(-5deg) scale(1.08);
                box-shadow: 0 0 35px rgba(255, 0, 255, 0.9),
                            0 6px 25px rgba(255, 0, 255, 0.7),
                            0 0 0 3px rgba(255, 0, 255, 0.5);
            }
        }

        .widget-content {
            padding: 15px 18px;
            text-align: center;
        }

        .widget-title {
            color: #ff00ff;
            font-family: 'Heebo', sans-serif;
            font-size: 15px;
            font-weight: 700;
            margin-bottom: 6px;
            text-shadow: 0 0 10px rgba(255, 0, 255, 0.8);
        }

        .widget-logo {
            width: 100%;
            max-width: 160px;
            height: auto;
            margin: 0 auto 8px;
            filter: drop-shadow(0 0 15px rgba(0, 240, 255, 0.6))
                    drop-shadow(0 0 25px rgba(0, 240, 255, 0.3));
            animation: logoGlow 3s ease-in-out infinite;
        }

        @keyframes logoGlow {
            0%, 100% {
                filter: drop-shadow(0 0 15px rgba(0, 240, 255, 0.6))
                        drop-shadow(0 0 25px rgba(0, 240, 255, 0.3));
            }
            50% {
                filter: drop-shadow(0 0 20px rgba(0, 240, 255, 0.8))
                        drop-shadow(0 0 35px rgba(0, 240, 255, 0.5));
            }
        }

        .widget-description {
            color: #D2DDFF;
            font-size: 13px;
            line-height: 1.4;
            margin-bottom: 12px;
        }

        .widget-buttons {
            display: flex;
            justify-content: center;
        }

        .widget-btn {
            padding: 12px 30px;
            border-radius: 30px;
            font-family: 'Heebo', sans-serif;
            font-size: 15px;
            font-weight: 700;
            text-decoration: none;
            transition: all 0.3s ease;
            cursor: pointer;
            border: none;
            text-align: center;
            background: linear-gradient(135deg, #00f0ff 0%, #00d4d4 100%);
            color: #0a0a0a;
            box-shadow: 0 0 30px rgba(0, 240, 255, 0.5),
                        0 4px 20px rgba(0, 240, 255, 0.3);
            display: inline-block;
        }

        .widget-btn:hover {
            transform: translateY(-3px) scale(1.05);
            box-shadow: 0 0 40px rgba(0, 240, 255, 0.7),
                        0 6px 30px rgba(0, 240, 255, 0.5);
        }

        .close-btn {
            position: absolute;
            top: 10px;
            left: 10px;
            width: 30px;
            height: 30px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s;
            z-index: 11;
        }

        .close-btn:hover {
            background: rgba(255, 0, 0, 0.8);
            border-color: rgba(255, 0, 0, 1);
        }

        .close-btn::before,
        .close-btn::after {
            content: '';
            position: absolute;
            width: 14px;
            height: 2px;
            background: white;
        }

        .close-btn::before {
            transform: rotate(45deg);
        }

        .close-btn::after {
            transform: rotate(-45deg);
        }

        .widget-hidden {
            transform: translateX(-120%) translateY(-50%);
            opacity: 0;
            pointer-events: none;
        }

        @media (max-width: 768px) {
            .active-games-widget {
                width: 90%;
                left: 5%;
                top: auto;
                bottom: 20px;
                transform: translateY(0);
            }

            .active-games-widget:hover {
                transform: translateY(0) scale(1.02);
            }

            .new-badge {
                left: 50%;
                top: auto;
                bottom: 420px;
                transform: translateX(-50%) rotate(-5deg);
            }

            .widget-hidden {
                transform: translateY(120%);
            }
        }
    `;
    document.head.appendChild(style);

    // Create widget HTML
    const widget = document.createElement('div');
    widget.id = 'activeGamesWidget';
    widget.className = 'active-games-widget';
    widget.innerHTML = `
        <div class="close-btn" onclick="window.closeActiveGamesWidget()"></div>
        <div class="widget-video-container">
            <video autoplay muted loop playsinline controlslist="nodownload nofullscreen noremoteplayback" disablepictureinpicture>
                <source src="https://activegames.co.il/videos/activegames.mp4" type="video/mp4">
            </video>
            <div class="video-overlay"></div>
            <div class="glow-effect">
                <div class="glow-orb-1"></div>
                <div class="glow-orb-2"></div>
            </div>
        </div>
        <div class="widget-content">
            <div class="widget-title">חדש! משחקים אינטראקטיביים</div>
            <img src="https://activegames.co.il/images/logo-activegames.png" alt="Active Games" class="widget-logo">
            <div class="widget-description">
                חוו את עתיד הבידור האינטראקטיבי עם טכנולוגיה מתקדמת ומשחקים מרגשים!
            </div>
            <div class="widget-buttons">
                <a href="https://activegames.co.il" target="_blank" class="widget-btn">
                    גלו את המשחקים
                </a>
            </div>
        </div>
    `;

    // Create badge separately (outside widget)
    const badge = document.createElement('div');
    badge.id = 'activeGamesBadge';
    badge.className = 'new-badge';
    badge.textContent = 'פתיחה קרובה - היו הראשונים!';

    // Add widget and badge to page when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            document.body.appendChild(widget);
            document.body.appendChild(badge);
        });
    } else {
        document.body.appendChild(widget);
        document.body.appendChild(badge);
    }

    // Close function - just hides for this session only
    window.closeActiveGamesWidget = function() {
        const widget = document.getElementById('activeGamesWidget');
        const badge = document.getElementById('activeGamesBadge');
        widget.classList.add('widget-hidden');
        if (badge) badge.style.display = 'none';
        // Pas de localStorage - réapparaît à la prochaine visite
    };

})();

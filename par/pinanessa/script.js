/* ============================================
   PIÑANESSA COUNTDOWN - SCRIPT
   Target date: July 31, 2026
   ============================================ */

(function () {
    'use strict';

    // ── CONFIG ──────────────────────────────────
    const TARGET_DATE = new Date('2026-07-31T00:00:00');
    // Start date for progress calculation (when page was created)
    const START_DATE = new Date('2026-05-01T00:00:00');

    const LOVE_MESSAGES = [
        "Cada segundo sin ti es eterno, pero cada segundo contigo vale una eternidad 💕",
        "No cuento los días, cuento los latidos que me faltan para verte 💓",
        "Eres la razón por la que sonrío mirando el calendario 📅✨",
        "Mi corazón ya tiene fecha de vuelo... directo a tus brazos ✈️💖",
        "El universo conspira para acercar este día... y yo también 🌌",
        "Piñanessa, eres mi persona favorita en todos los husos horarios 🌍💗",
        "Mientras tanto, aquí estoy, echándote de menos con todo mi ser 🥺",
        "Cada día que pasa es un paso más cerca de tu sonrisa 😊💘",
        "Te echo tanto de menos que hasta el WiFi tiene más conexión que yo sin ti 📶💔",
        "Cuando por fin te vea, no pienso soltarte nunca más 🤗💝",
        "Eres mi hogar favorito, y pronto volveré a casa 🏠❤️",
        "Ojalá pudiera teletransportarme... pero mientras, cuento los segundos ⏳💫",
    ];

    const HEART_EMOJIS = ['💖', '💗', '💕', '💘', '💝', '❤️', '💓', '💞', '🩷', '🤍'];

    // ── DOM ELEMENTS ────────────────────────────
    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const loveMessageEl = document.getElementById('loveMessage');
    const celebrationOverlay = document.getElementById('celebrationOverlay');
    const heartsContainer = document.getElementById('heartsContainer');
    const canvas = document.getElementById('particleCanvas');
    const ctx = canvas.getContext('2d');

    // ── COUNTDOWN ───────────────────────────────
    let prevValues = { days: -1, hours: -1, minutes: -1, seconds: -1 };

    function updateCountdown() {
        const now = new Date();
        const diff = TARGET_DATE - now;

        if (diff <= 0) {
            showCelebration();
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        updateValue(daysEl, days, 'days');
        updateValue(hoursEl, hours, 'hours');
        updateValue(minutesEl, minutes, 'minutes');
        updateValue(secondsEl, seconds, 'seconds');

        // Progress
        const totalDuration = TARGET_DATE - START_DATE;
        const elapsed = now - START_DATE;
        const pct = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);
        progressBar.style.width = pct + '%';
        progressPercent.textContent = pct.toFixed(2) + '%';
    }

    function updateValue(el, value, key) {
        const str = String(value).padStart(2, '0');
        if (prevValues[key] !== value) {
            el.textContent = str;
            el.classList.remove('tick');
            void el.offsetWidth; // force reflow
            el.classList.add('tick');
            prevValues[key] = value;
        }
    }

    function showCelebration() {
        daysEl.textContent = '00';
        hoursEl.textContent = '00';
        minutesEl.textContent = '00';
        secondsEl.textContent = '00';
        progressBar.style.width = '100%';
        progressPercent.textContent = '100%';
        celebrationOverlay.classList.add('active');
    }

    // ── LOVE MESSAGES ───────────────────────────
    let msgIndex = Math.floor(Math.random() * LOVE_MESSAGES.length);

    function showNextMessage() {
        loveMessageEl.classList.add('fade-out');
        setTimeout(function () {
            msgIndex = (msgIndex + 1) % LOVE_MESSAGES.length;
            loveMessageEl.textContent = LOVE_MESSAGES[msgIndex];
            loveMessageEl.classList.remove('fade-out');
        }, 500);
    }

    function initMessages() {
        loveMessageEl.textContent = LOVE_MESSAGES[msgIndex];
        setInterval(showNextMessage, 8000);
    }

    // ── FLOATING HEARTS ─────────────────────────
    function spawnHeart() {
        var heart = document.createElement('span');
        heart.className = 'floating-heart';
        heart.textContent = HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)];
        heart.style.left = Math.random() * 100 + '%';
        heart.style.fontSize = (Math.random() * 1.5 + 0.8) + 'rem';
        heart.style.animationDuration = (Math.random() * 8 + 8) + 's';
        heart.style.animationDelay = (Math.random() * 2) + 's';
        heartsContainer.appendChild(heart);
        setTimeout(function () { heart.remove(); }, 18000);
    }

    function initHearts() {
        for (var i = 0; i < 5; i++) {
            setTimeout(spawnHeart, i * 600);
        }
        setInterval(spawnHeart, 2500);
    }

    // ── PARTICLES ───────────────────────────────
    var particles = [];
    var mouse = { x: -1000, y: -1000 };

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function Particle() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.radius = Math.random() * 1.5 + 0.5;
        this.alpha = Math.random() * 0.3 + 0.1;
    }

    function initParticles() {
        resizeCanvas();
        var count = Math.min(Math.floor((canvas.width * canvas.height) / 15000), 80);
        particles = [];
        for (var i = 0; i < count; i++) {
            particles.push(new Particle());
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 107, 157, ' + p.alpha + ')';
            ctx.fill();

            // Draw connections
            for (var j = i + 1; j < particles.length; j++) {
                var p2 = particles[j];
                var dx = p.x - p2.x;
                var dy = p.y - p2.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = 'rgba(168, 85, 247, ' + (0.08 * (1 - dist / 120)) + ')';
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animateParticles);
    }

    // ── INIT ────────────────────────────────────
    window.addEventListener('resize', function () {
        resizeCanvas();
        initParticles();
    });

    document.addEventListener('mousemove', function (e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    // Start everything
    updateCountdown();
    setInterval(updateCountdown, 1000);
    initMessages();
    initHearts();
    initParticles();
    animateParticles();
})();

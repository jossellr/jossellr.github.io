/* ============================================
   PIÑANESSA COUNTDOWN — viaje completo
   ──────────────────────────────────────────────
   1 mayo            : empieza el viaje a UK, ella viene conmigo
   10 mayo           : ella vuelve a España
   7 junio 20:40     : yo llego a España (visita)
   16 junio 19:00    : yo vuelvo a UK
   31 julio 15:05    : aterrizaje definitivo, ya en casa
   ============================================ */

(function () {
    'use strict';

    // ── HITOS ───────────────────────────────────
    var T_START      = new Date('2026-05-01T00:00:00');  // viaje empieza (juntos en UK)
    var T_SHE_LEAVES = new Date('2026-05-10T00:00:00');  // ella vuelve a España
    var T_HE_VISITS  = new Date('2026-06-07T20:40:00');  // yo aterrizo en España
    var T_HE_LEAVES  = new Date('2026-06-16T19:00:00');  // yo vuelvo a UK
    var T_FINAL      = new Date('2026-07-31T15:05:00');  // aterrizaje definitivo

    // ── SEGMENTOS DEL VIAJE ─────────────────────
    // Cada segmento es una franja con tipo y mensajes. La fase activa se
    // determina simplemente buscando en qué segmento cae el "ahora".
    var SEGMENTS = [
        {
            id: 'together_uk',
            type: 'together',
            from: T_START, to: T_SHE_LEAVES,
            icon: '💝',
            shortLabel: 'Juntos UK',
            shortDates: '1-10 may',
            title: '¡Estamos juntos en',
            subtitle: 'Disfrutemos cada minuto antes de que vuelvas a España 💕',
            countdownTo: T_SHE_LEAVES,
            progressText: 'Tiempo juntos consumido',
            statPrimary: { label: 'Llevamos juntos', fn: function () { return formatDuration(Date.now() - T_START); } },
            statSecondary: { label: 'Te vas en', fn: function () { return formatDays(T_SHE_LEAVES - Date.now()); } }
        },
        {
            id: 'apart_first',
            type: 'apart',
            from: T_SHE_LEAVES, to: T_HE_VISITS,
            icon: '✈️',
            shortLabel: 'Cuenta atrás',
            shortDates: 'hasta 7 jun',
            title: 'Cuenta atrás para ver a',
            subtitle: 'Aterrizo en España el 7 de junio a las 20:40 ✈️',
            countdownTo: T_HE_VISITS,
            progressText: 'Hasta el aterrizaje',
            statPrimary: { label: 'Llevamos sin vernos', fn: function () { return formatDays(Date.now() - T_SHE_LEAVES); } }
        },
        {
            id: 'together_spain',
            type: 'together',
            from: T_HE_VISITS, to: T_HE_LEAVES,
            icon: '💝',
            shortLabel: 'Juntos ES',
            shortDates: '7-16 jun',
            title: '¡Por fin contigo,',
            subtitle: 'Tenemos estos días en España antes de mi vuelta 💝',
            countdownTo: T_HE_LEAVES,
            progressText: 'Tiempo juntos consumido',
            statPrimary: { label: 'Llevamos juntos', fn: function () { return formatDuration(Date.now() - T_HE_VISITS); } },
            statSecondary: { label: 'Me voy en', fn: function () { return formatDuration(T_HE_LEAVES - Date.now()); } }
        },
        {
            id: 'apart_second',
            type: 'apart',
            from: T_HE_LEAVES, to: T_FINAL,
            icon: '🛫',
            shortLabel: 'Cuenta atrás',
            shortDates: 'hasta 31 jul',
            title: 'Cuenta atrás para volver a',
            subtitle: 'El 31 de julio a las 15:05 aterrizo… y ya no me voy 🛬',
            countdownTo: T_FINAL,
            progressText: 'Hasta el aterrizaje definitivo',
            statPrimary: { label: 'Llevamos sin vernos', fn: function () { return formatDays(Date.now() - T_HE_LEAVES); } },
            statSecondary: { label: 'Días juntos este viaje', fn: function () {
                return formatDays((T_SHE_LEAVES - T_START) + (T_HE_LEAVES - T_HE_VISITS));
            } }
        },
        {
            id: 'reunited',
            type: 'reunited',
            from: T_FINAL, to: null,
            icon: '🏠',
            shortLabel: 'En casa',
            shortDates: 'para siempre',
            title: '¡Por fin en casa con',
            subtitle: 'Ya no cuento más días. Mi sitio es contigo 🏠💖',
            countdownTo: null,
            progressText: 'Tiempo en casa',
            statPrimary: { label: 'Llevamos en casa', fn: function () { return formatDuration(Date.now() - T_FINAL); } },
            statSecondary: { label: 'Días juntos este viaje', fn: function () {
                return formatDays((T_SHE_LEAVES - T_START) + (T_HE_LEAVES - T_HE_VISITS));
            } }
        }
    ];

    var LOVE_MESSAGES = {
        together_uk: [
            'Que nuestra primera semana juntos aquí sea solo el principio 💕',
            'Cada paseo contigo por estas calles inglesas vale por mil postales 📸💖',
            'Aprovechemos cada segundo como si fuera el último 💋',
            'Te quiero más cuando estás aquí 🥰',
            'Quiero parar el tiempo en este momento contigo ⏸️💕'
        ],
        apart_first: [
            'Cada día que pasa es un paso más cerca de tu sonrisa 😊💘',
            'No cuento los días, cuento los latidos que me faltan para abrazarte 💓',
            'Mi corazón ya tiene fecha de vuelo… directo a tus brazos ✈️💖',
            'Te echo tanto de menos que hasta el WiFi tiene más conexión que yo sin ti 📶💔',
            'Ojalá pudiera teletransportarme… pero mientras, cuento los segundos ⏳💫'
        ],
        together_spain: [
            'Cada hora juntos en casa vale por un mes apartados 💝',
            'Estos días son la recompensa por la espera 💖',
            'Que no se acaben nunca 🥲💕',
            'Aprovechemos cada segundo, mi Piñanessa 💋',
            'Volveré pronto y para siempre. Te lo prometo 🤞✨'
        ],
        apart_second: [
            'Esta vez es la última separación. Y luego, para siempre ✨',
            'Cuenta atrás final activada 🚀💖',
            'Cada día que pasa es un día menos para el aterrizaje definitivo 🛬',
            'Vuelvo en julio… y me quedo. Promesa 🤞💖',
            'El último vuelo es el más cerca de casa 🏠❤️'
        ],
        reunited: [
            'Sin contar días, sin pantallas en medio. Solo nosotros 💖',
            'En casa por fin, Piñanessa. Y aquí me quedo 🏠❤️',
            'Misión cumplida: te abracé y no te suelto más 🤗💝',
            'Esta página ya solo guarda recuerdos de los días apartados 📖💕'
        ]
    };

    var HEART_EMOJIS = ['💖', '💗', '💕', '💘', '💝', '❤️', '💓', '💞', '🩷', '🤍'];

    // ── DOM ─────────────────────────────────────
    var daysEl = document.getElementById('days');
    var hoursEl = document.getElementById('hours');
    var minutesEl = document.getElementById('minutes');
    var secondsEl = document.getElementById('seconds');
    var progressBar = document.getElementById('progressBar');
    var progressPercent = document.getElementById('progressPercent');
    var progressText = document.getElementById('progressText');
    var phaseTitleEl = document.getElementById('phaseTitle');
    var phaseSubtitleEl = document.getElementById('phaseSubtitle');
    var phaseTimelineEl = document.getElementById('phaseTimeline');
    var statPrimaryLabelEl = document.getElementById('statPrimaryLabel');
    var statPrimaryValueEl = document.getElementById('statPrimaryValue');
    var statSecondaryLabelEl = document.getElementById('statSecondaryLabel');
    var statSecondaryValueEl = document.getElementById('statSecondaryValue');
    var loveMessageEl = document.getElementById('loveMessage');
    var celebrationOverlay = document.getElementById('celebrationOverlay');
    var heartsContainer = document.getElementById('heartsContainer');
    var canvas = document.getElementById('particleCanvas');
    var ctx = canvas.getContext('2d');

    // ── HELPERS ─────────────────────────────────
    function currentSegment() {
        var now = Date.now();
        for (var i = 0; i < SEGMENTS.length; i++) {
            var s = SEGMENTS[i];
            if (now < s.from) continue;
            if (s.to == null || now < s.to) return s;
        }
        return SEGMENTS[SEGMENTS.length - 1];
    }

    function formatDays(ms) {
        if (!isFinite(ms) || ms < 0) return '0 días';
        var d = ms / (1000 * 60 * 60 * 24);
        if (d < 1) return Math.max(0, Math.floor(ms / (1000 * 60 * 60))) + ' h';
        return Math.floor(d) + ' días';
    }

    function formatDuration(ms) {
        if (!isFinite(ms) || ms < 0) return '0';
        var d = Math.floor(ms / (1000 * 60 * 60 * 24));
        var h = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (d > 0) return d + ' d ' + h + ' h';
        var m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return h + ' h ' + m + ' m';
    }

    // ── ESTADO ──────────────────────────────────
    var activeId = null;
    var prevValues = { days: -1, hours: -1, minutes: -1, seconds: -1 };
    var msgIndex = 0;

    function buildTimelineDOM() {
        // Genera dinámicamente las píldoras a partir del array SEGMENTS
        var html = SEGMENTS.map(function (s, i) {
            var connector = i > 0 ? '<div class="phase-connector"></div>' : '';
            return connector +
                '<div class="phase-item" data-phase="' + s.id + '" data-type="' + s.type + '">' +
                    '<span class="phase-icon">' + s.icon + '</span>' +
                    '<span class="phase-label">' + s.shortLabel + '</span>' +
                    '<span class="phase-sublabel">' + s.shortDates + '</span>' +
                '</div>';
        }).join('');
        phaseTimelineEl.innerHTML = html;
    }

    function applySegment(seg) {
        if (activeId === seg.id) return;
        activeId = seg.id;

        phaseTitleEl.textContent = seg.title;
        phaseSubtitleEl.textContent = seg.subtitle;
        progressText.textContent = seg.progressText;
        statPrimaryLabelEl.textContent = seg.statPrimary.label;
        // La stat secundaria es opcional: si no está definida, ocultamos la card
        var statSecondaryCard = document.getElementById('statSecondary');
        if (seg.statSecondary) {
            statSecondaryCard.style.display = '';
            statSecondaryLabelEl.textContent = seg.statSecondary.label;
        } else {
            statSecondaryCard.style.display = 'none';
        }

        // Resalta la fase activa, marca las pasadas
        var activeIdx = SEGMENTS.findIndex(function (s) { return s.id === seg.id; });
        phaseTimelineEl.querySelectorAll('.phase-item').forEach(function (el, i) {
            el.classList.toggle('is-active', i === activeIdx);
            el.classList.toggle('is-past', i < activeIdx);
        });

        document.body.setAttribute('data-phase', seg.id);
        document.body.setAttribute('data-phase-type', seg.type);

        // Reset del mensaje de amor
        msgIndex = Math.floor(Math.random() * LOVE_MESSAGES[seg.id].length);
        showCurrentMessage();
    }

    function tick() {
        var seg = currentSegment();
        applySegment(seg);

        // Countdown principal
        if (seg.countdownTo) {
            var diff = seg.countdownTo - Date.now();
            if (diff < 0) diff = 0;
            var days = Math.floor(diff / (1000 * 60 * 60 * 24));
            var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            var seconds = Math.floor((diff % (1000 * 60)) / 1000);
            updateValue(daysEl, days, 'days');
            updateValue(hoursEl, hours, 'hours');
            updateValue(minutesEl, minutes, 'minutes');
            updateValue(secondsEl, seconds, 'seconds');
        } else {
            daysEl.textContent = '00';
            hoursEl.textContent = '00';
            minutesEl.textContent = '00';
            secondsEl.textContent = '00';
            celebrationOverlay.classList.add('active');
        }

        // Progress de la fase actual
        if (seg.to) {
            var total = seg.to - seg.from;
            var elapsed = Date.now() - seg.from;
            var pct = Math.min(Math.max((elapsed / total) * 100, 0), 100);
            progressBar.style.width = pct + '%';
            progressPercent.textContent = pct.toFixed(2) + '%';
        } else {
            progressBar.style.width = '100%';
            progressPercent.textContent = '100%';
        }

        // Stats dinámicas
        statPrimaryValueEl.textContent = seg.statPrimary.fn();
        if (seg.statSecondary) {
            statSecondaryValueEl.textContent = seg.statSecondary.fn();
        }
    }

    function updateValue(el, value, key) {
        var str = String(value).padStart(2, '0');
        if (prevValues[key] !== value) {
            el.textContent = str;
            el.classList.remove('tick');
            void el.offsetWidth;
            el.classList.add('tick');
            prevValues[key] = value;
        }
    }

    // ── MENSAJES DE AMOR ────────────────────────
    function showCurrentMessage() {
        var msgs = LOVE_MESSAGES[activeId] || LOVE_MESSAGES.apart_first;
        loveMessageEl.classList.add('fade-out');
        setTimeout(function () {
            loveMessageEl.textContent = msgs[msgIndex % msgs.length];
            loveMessageEl.classList.remove('fade-out');
        }, 500);
    }

    function showNextMessage() {
        msgIndex++;
        showCurrentMessage();
    }

    // ── CORAZONES FLOTANTES ─────────────────────
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
        for (var i = 0; i < 5; i++) setTimeout(spawnHeart, i * 600);
        setInterval(spawnHeart, 2500);
    }

    // ── PARTÍCULAS ──────────────────────────────
    var particles = [];

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
        for (var i = 0; i < count; i++) particles.push(new Particle());
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 107, 157, ' + p.alpha + ')';
            ctx.fill();
            for (var j = i + 1; j < particles.length; j++) {
                var p2 = particles[j];
                var dx = p.x - p2.x, dy = p.y - p2.y;
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

    buildTimelineDOM();
    tick();
    setInterval(tick, 1000);
    setInterval(showNextMessage, 8000);
    initHearts();
    initParticles();
    animateParticles();
})();

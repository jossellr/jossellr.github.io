/* =========================================================
   José Luis López Ruiz · Página personal
   JS: topbar sticky, scroll-spy, menú móvil, filtros, año,
       métricas en tiempo real (OpenAlex) + Chart.js
   ========================================================= */

(function () {
    "use strict";

    var ORCID = "0000-0003-2583-8638";
    var OPENALEX_URL = "https://api.openalex.org/authors/orcid:" + ORCID + "?mailto=llopez@ujaen.es";
    var ACCENT = "#047857";       // verde esmeralda 700
    var ACCENT_SOFT = "#a7f3d0";  // verde esmeralda 200

    /* ---------- Analítica + consentimiento (RGPD) ----------
       Pega aquí tus identificadores cuando los tengas (ver docs/analytics.md).
       Mientras sigan con el valor de ejemplo, NO se carga nada: el banner
       funciona igual para que puedas probar la experiencia. */
    var GA_MEASUREMENT_ID = "G-SHY1P0ENF6";        // Google Analytics 4 (requiere consentimiento)
    var CF_BEACON_TOKEN   = "199cff50396d4ec8bb0397966d8695eb"; // Cloudflare Web Analytics (sin cookies, siempre activo)
    var CONSENT_KEY = "analytics_consent";          // "granted" | "denied"
    var gaLoaded = false;

    /* ---------------- i18n ---------------- */
    var SUPPORTED_LANGS = ["es", "en"];
    var DEFAULT_LANG = "es";
    var LANG_STORAGE_KEY = "lang_pref";   // solo se escribe al click manual
    // Países hispanohablantes (ISO 3166-1 alpha-2)
    var ES_COUNTRIES = [
        "ES", "MX", "AR", "CO", "PE", "VE", "CL", "EC", "GT", "CU",
        "BO", "DO", "HN", "PY", "SV", "NI", "CR", "PA", "UY", "PR", "GQ"
    ];
    var i18nData = {};
    var currentLang = DEFAULT_LANG;

    /* Detección por prioridad:
       1. ?lang=xx en la URL (override explícito)
       2. localStorage 'lang_pref' (solo si el usuario hizo click antes)
       3. navigator.languages — primer match con un idioma soportado
       4. Geolocalización por IP (ipapi.co/country/) → ES si país hispano, EN si no
       5. Default
       Devuelve una Promise<string>. */
    function detectLang() {
        // 1. URL param
        try {
            var urlLang = new URLSearchParams(window.location.search).get("lang");
            if (urlLang && SUPPORTED_LANGS.indexOf(urlLang) !== -1) {
                return Promise.resolve(urlLang);
            }
        } catch (e) { /* ignore */ }

        // 2. Elección explícita previa
        try {
            var stored = localStorage.getItem(LANG_STORAGE_KEY);
            if (stored && SUPPORTED_LANGS.indexOf(stored) !== -1) {
                return Promise.resolve(stored);
            }
        } catch (e) { /* ignore */ }

        // 3. Lista de idiomas del navegador (no solo el principal)
        var langs = (navigator.languages && navigator.languages.length)
            ? navigator.languages
            : [navigator.language || navigator.userLanguage || ""];
        for (var i = 0; i < langs.length; i++) {
            var code = String(langs[i] || "").slice(0, 2).toLowerCase();
            if (SUPPORTED_LANGS.indexOf(code) !== -1) {
                return Promise.resolve(code);
            }
        }

        // 4. Geolocalización por IP — ipapi.co/country devuelve el código en texto.
        // Con timeout de 2.5 s para no bloquear si la red móvil filtra el host.
        var ipFetch = fetch("https://ipapi.co/country/", { cache: "default" })
            .then(function (r) { return r.ok ? r.text() : ""; });
        var ipTimeout = new Promise(function (resolve) {
            setTimeout(function () { resolve(""); }, 2500);
        });
        return Promise.race([ipFetch, ipTimeout])
            .then(function (country) {
                var c = String(country || "").trim().toUpperCase();
                if (!c) return DEFAULT_LANG;
                return ES_COUNTRIES.indexOf(c) !== -1 ? "es" : "en";
            })
            .catch(function () { return DEFAULT_LANG; });
    }

    function t(key) {
        var parts = String(key).split(".");
        var node = i18nData;
        for (var i = 0; i < parts.length; i++) {
            if (!node || typeof node !== "object") return key;
            node = node[parts[i]];
        }
        return (typeof node === "string") ? node : key;
    }

    function applyI18n() {
        // text content (textContent → safe)
        document.querySelectorAll("[data-i18n]").forEach(function (el) {
            var v = t(el.getAttribute("data-i18n"));
            if (v && v !== el.getAttribute("data-i18n")) el.textContent = v;
        });
        // HTML content (innerHTML → allows strong/em from JSON)
        document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
            var v = t(el.getAttribute("data-i18n-html"));
            if (v && v !== el.getAttribute("data-i18n-html")) el.innerHTML = v;
        });
        // attributes (data-i18n-attr="attr1:key1|attr2:key2")
        document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
            var pairs = el.getAttribute("data-i18n-attr").split("|");
            pairs.forEach(function (p) {
                var idx = p.indexOf(":");
                if (idx < 0) return;
                var attr = p.slice(0, idx).trim();
                var key = p.slice(idx + 1).trim();
                var v = t(key);
                if (v && v !== key) el.setAttribute(attr, v);
            });
        });
        // <html lang>
        document.documentElement.lang = currentLang;
        // Estado del switcher
        document.querySelectorAll(".lang-btn").forEach(function (b) {
            b.classList.toggle("is-active", b.getAttribute("data-lang") === currentLang);
            b.setAttribute("aria-pressed", b.getAttribute("data-lang") === currentLang ? "true" : "false");
        });
    }

    function loadLang(lang, opts) {
        opts = opts || {};
        if (SUPPORTED_LANGS.indexOf(lang) === -1) lang = DEFAULT_LANG;
        return fetch("data/i18n/" + lang + ".json", { cache: "no-cache" })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                if (!data) return;
                i18nData = data;
                currentLang = lang;
                // Solo guardamos la elección si fue explícita (click en switcher).
                // Las auto-detecciones no escriben para que la geolocalización
                // / idioma del navegador sigan funcionando si el usuario viaja.
                if (opts.persist) {
                    try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch (e) { /* ignore */ }
                }
                applyI18n();
                if (pubState && pubState.items && pubState.items.length) {
                    renderPubView({ animate: !opts.firstLoad });
                }
            });
    }

    function initLangSwitch() {
        document.querySelectorAll(".lang-btn[data-lang]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var lang = btn.getAttribute("data-lang");
                if (lang !== currentLang) loadLang(lang, { persist: true });
            });
        });
    }
    /* -------------- fin i18n -------------- */

    /* Estado global de las publicaciones (filtro + paginación) */
    var pubState = {
        items: [],          // todos los items unificados (journals+conferences+software)
        filter: "all",
        search: "",         // texto de búsqueda (título / revista / congreso)
        page: 1,
        pageSize: 10
    };

    // Normaliza texto para búsqueda insensible a mayúsculas y acentos.
    var DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");
    function normalizeText(s) {
        return String(s == null ? "" : s)
            .normalize("NFD").replace(DIACRITICS_RE, "")
            .toLowerCase();
    }
    // Cadena buscable de un item (título, revista, congreso, acrónimo, autores).
    function pubSearchText(it) {
        var parts = [it.title, it.journal, it.conference, it.acronym, it.productType, it.registry];
        if (it.authors) parts = parts.concat(it.authors);
        return normalizeText(parts.filter(Boolean).join(" "));
    }

    document.addEventListener("DOMContentLoaded", function () {
        initYear();
        initStickyTopbar();
        initScrollProgress();
        initMobileNav();
        initScrollSpy();
        initScrollReveal();
        initLangSwitch();

        // Cargamos español por defecto inmediatamente (no bloquea nada),
        // arrancamos métricas + publicaciones en paralelo, y la detección
        // real de idioma corre aparte: si resuelve a algo distinto,
        // re-aplica la traducción. Así si la geolocalización por IP se
        // cuelga en una red móvil, publicaciones y métricas ya están vivas.
        initTheme();
        initAnalyticsConsent();

        loadLang(DEFAULT_LANG, { firstLoad: true }).then(function () {
            loadMetrics();
            loadPublications().then(loadManualMetrics);
        });

        detectLang().then(function (lang) {
            if (lang !== currentLang) loadLang(lang, { firstLoad: false });
        });
    });

    /* ---------- Analítica + consentimiento de cookies ---------- */
    function isPlaceholder(v) {
        // Valores de ejemplo aún sin sustituir.
        return !v || v.indexOf("XXXX") !== -1 || v.indexOf("__") === 0;
    }

    function getConsent() {
        try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
    }
    function setConsent(v) {
        try { localStorage.setItem(CONSENT_KEY, v); } catch (e) { /* ignore */ }
    }

    // Cloudflare Web Analytics: sin cookies ni datos personales → no requiere
    // consentimiento, se carga siempre que haya token configurado.
    function loadCloudflareAnalytics() {
        if (isPlaceholder(CF_BEACON_TOKEN)) return;
        if (document.getElementById("cf-beacon")) return;
        var s = document.createElement("script");
        s.id = "cf-beacon";
        s.defer = true;
        s.src = "https://static.cloudflareinsights.com/beacon.min.js";
        s.setAttribute("data-cf-beacon", JSON.stringify({ token: CF_BEACON_TOKEN }));
        document.head.appendChild(s);
    }

    // Google Analytics 4: usa cookies → solo tras consentimiento explícito.
    function loadGoogleAnalytics() {
        if (gaLoaded || isPlaceholder(GA_MEASUREMENT_ID)) return;
        gaLoaded = true;
        var s = document.createElement("script");
        s.async = true;
        s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_MEASUREMENT_ID;
        document.head.appendChild(s);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag("js", new Date());
        window.gtag("config", GA_MEASUREMENT_ID, { anonymize_ip: true });
    }

    // Borra las cookies que deja GA4 (_ga, _ga_*, _gid, _gat) al retirar consentimiento.
    function deleteGaCookies() {
        var host = location.hostname;
        var domains = ["", "; domain=" + host, "; domain=." + host];
        document.cookie.split(";").forEach(function (c) {
            var name = c.split("=")[0].trim();
            if (name.indexOf("_ga") === 0 || name === "_gid" || name === "_gat") {
                domains.forEach(function (d) {
                    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + d;
                });
            }
        });
    }

    function showCookieBanner() {
        var b = document.getElementById("cookieBanner");
        if (b) b.classList.add("is-visible");
    }
    function hideCookieBanner() {
        var b = document.getElementById("cookieBanner");
        if (b) b.classList.remove("is-visible");
    }

    function initAnalyticsConsent() {
        // Cloudflare siempre (cookieless).
        loadCloudflareAnalytics();

        var consent = getConsent();
        if (consent === "granted") {
            loadGoogleAnalytics();
        } else if (consent !== "denied") {
            showCookieBanner();   // sin decisión previa
        }

        var accept = document.getElementById("cookieAccept");
        var reject = document.getElementById("cookieReject");
        var toggle = document.getElementById("cookieDetailsToggle");
        var details = document.getElementById("cookieDetails");
        var prefsOpen = document.getElementById("cookiePrefsOpen");

        if (accept) {
            accept.addEventListener("click", function () {
                setConsent("granted");
                loadGoogleAnalytics();
                hideCookieBanner();
            });
        }
        if (reject) {
            reject.addEventListener("click", function () {
                var wasActive = getConsent() === "granted" || gaLoaded;
                setConsent("denied");
                hideCookieBanner();
                // Si GA ya estaba activo (consentimiento previo), lo paramos de
                // verdad: borramos sus cookies y recargamos.
                if (wasActive) {
                    deleteGaCookies();
                    location.reload();
                }
            });
        }
        if (toggle && details) {
            toggle.addEventListener("click", function () {
                var open = !details.hasAttribute("hidden");
                if (open) {
                    details.setAttribute("hidden", "");
                    toggle.setAttribute("aria-expanded", "false");
                } else {
                    details.removeAttribute("hidden");
                    toggle.setAttribute("aria-expanded", "true");
                }
            });
        }
        if (prefsOpen) {
            prefsOpen.addEventListener("click", function () {
                showCookieBanner();
            });
        }
    }

    /* ---------- Modo oscuro ---------- */
    var THEME_KEY = "theme_pref";

    function initTheme() {
        // Por defecto claro. El modo oscuro es opt-in (click manual del usuario),
        // no se detecta del prefers-color-scheme.
        var stored = null;
        try { stored = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
        applyTheme(stored === "dark" ? "dark" : "light", false);

        var btn = document.getElementById("themeToggle");
        if (btn) {
            btn.addEventListener("click", function () {
                var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
                applyTheme(cur === "dark" ? "light" : "dark", true);
            });
        }
    }

    function applyTheme(theme, persist) {
        if (theme === "dark") {
            document.documentElement.setAttribute("data-theme", "dark");
        } else {
            document.documentElement.removeAttribute("data-theme");
        }
        // Actualiza meta theme-color para barras de móvil
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", theme === "dark" ? "#0d1117" : "#047857");
        if (persist) {
            try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
        }
        // La gráfica y el grafo guardan sus colores en el momento de
        // construirse: hay que regenerarlos para que respondan al tema.
        refreshThemedVisualizations();
    }

    function cssVar(name, fallback) {
        var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback || "";
    }

    function refreshThemedVisualizations() {
        // Re-render del Chart.js si ya existe
        if (chartState && chartState.instance && typeof renderProductionChart === "function") {
            renderProductionChart();
        }
        // Re-render del grafo de coautoría si ya existe
        if (coauthorState.allItems && typeof vis !== "undefined") {
            if (coauthorState.instance) {
                try { coauthorState.instance.destroy(); } catch (e) { /* ignore */ }
                coauthorState.instance = null;
            }
            buildCoauthorNetwork(coauthorState.allItems);
        }
    }

    /* Estado del grafo de coautoría (instancia + datos en cache para repintar) */
    var coauthorState = { instance: null, allItems: null };

    /* Barra de progreso al hacer scroll */
    function initScrollProgress() {
        var bar = document.getElementById("scrollProgress");
        if (!bar) return;
        var ticking = false;
        function update() {
            var st = window.scrollY;
            var dh = document.documentElement.scrollHeight - window.innerHeight;
            bar.style.width = (dh > 0 ? (st / dh) * 100 : 0) + "%";
            ticking = false;
        }
        window.addEventListener("scroll", function () {
            if (!ticking) {
                requestAnimationFrame(update);
                ticking = true;
            }
        }, { passive: true });
        update();
    }

    /* Reveal suave al entrar en viewport */
    function initScrollReveal() {
        if (!("IntersectionObserver" in window)) return;
        var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (prefersReduced) return;

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-revealed");
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

        document.querySelectorAll(".section, .hero, .info-grid, .stat-grid, .chart-card, .lines-grid, .awards-list").forEach(function (el) {
            el.classList.add("reveal");
            observer.observe(el);
        });
    }

    function initYear() {
        var el = document.getElementById("year");
        if (el) el.textContent = new Date().getFullYear();
    }

    /* Efecto cristal: añade .is-scrolled cuando el usuario hace scroll */
    function initStickyTopbar() {
        var topbar = document.getElementById("topbar");
        if (!topbar) return;
        var ticking = false;
        function update() {
            topbar.classList.toggle("is-scrolled", window.scrollY > 8);
            ticking = false;
        }
        window.addEventListener("scroll", function () {
            if (!ticking) {
                window.requestAnimationFrame(update);
                ticking = true;
            }
        }, { passive: true });
        update();
    }

    /* Hamburguesa móvil */
    function initMobileNav() {
        var toggle = document.getElementById("navToggle");
        var nav = document.getElementById("topnav");
        if (!toggle || !nav) return;

        toggle.addEventListener("click", function () {
            var open = nav.classList.toggle("is-open");
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
            toggle.innerHTML = open
                ? '<i class="fa-solid fa-xmark"></i>'
                : '<i class="fa-solid fa-bars"></i>';
        });

        nav.querySelectorAll(".topnav-link").forEach(function (link) {
            link.addEventListener("click", function () {
                if (window.matchMedia("(max-width: 720px)").matches) {
                    nav.classList.remove("is-open");
                    toggle.setAttribute("aria-expanded", "false");
                    toggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
                }
            });
        });
    }

    /* Resaltado de sección activa al hacer scroll */
    function initScrollSpy() {
        var navLinks = document.querySelectorAll(".topnav-link");
        if (!navLinks.length || !("IntersectionObserver" in window)) return;

        var byId = {};
        navLinks.forEach(function (link) {
            var id = link.getAttribute("href").replace("#", "");
            byId[id] = link;
        });

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var link = byId[entry.target.id];
                if (!link) return;
                if (entry.isIntersecting) {
                    navLinks.forEach(function (l) { l.classList.remove("active"); });
                    link.classList.add("active");
                }
            });
        }, {
            rootMargin: "-35% 0px -55% 0px",
            threshold: 0
        });

        document.querySelectorAll(".hero, .section").forEach(function (sec) {
            if (sec.id) observer.observe(sec);
        });
    }

    /* ---------- Publicaciones (JCR / Congresos / Software) ----------
       Lee data/publications/{journals,conferences,software}.json y:
       1) Renderiza las tarjetas en #publicationsList
       2) Calcula los contadores de la sección Métricas (incluyendo
          desglose Q1/Q2/Q3/Q4) — todo derivado de los JSON, sin números
          hardcodeados. */
    function loadPublications() {
        console.log("[publications] inicio de carga");
        // Failsafe visible: si pasados 6 s el contenedor sigue mostrando el
        // "Cargando publicaciones…", reemplazamos por un mensaje de error que
        // se vea sin DevTools.
        var failsafe = setTimeout(function () {
            var c = document.getElementById("publicationsList");
            if (c && c.innerHTML.indexOf("fa-spinner") !== -1) {
                c.innerHTML = '<p class="muted-note" style="color:#b91c1c">⚠ No se han podido cargar los datos de publicaciones. Revisa la consola.</p>';
            }
        }, 6000);

        var sources = [
            ["journal", "data/publications/journals.json"],
            ["conference", "data/publications/conferences.json"],
            ["software", "data/publications/software.json"]
        ];
        return Promise.all(sources.map(function (s) {
            return fetch(s[1], { cache: "no-cache" })
                .then(function (r) {
                    console.log("[publications]", s[1], "→", r.status);
                    return r.ok ? r.json() : { items: [] };
                })
                .catch(function (err) {
                    console.error("[publications] fallo en", s[1], err);
                    return { items: [] };
                });
        })).then(function (results) {
            clearTimeout(failsafe);
            var data = {
                journals: (results[0].items || []),
                conferences: (results[1].items || []),
                software: (results[2].items || [])
            };
            console.log("[publications] cargado:",
                data.journals.length, "revistas,",
                data.conferences.length, "congresos,",
                data.software.length, "software");
            applyComputedMetrics(data);
            try { updateChartPublications(data); } catch (e) { console.warn("[chart] error:", e); }
            renderPublications(data);
            initPublicationFiltersDynamic();
            console.log("[publications] render completado");
        }).catch(function (err) {
            clearTimeout(failsafe);
            console.error("[publications] error fatal:", err);
            var c = document.getElementById("publicationsList");
            if (c) c.innerHTML = '<p class="muted-note" style="color:#b91c1c">⚠ Error al procesar las publicaciones: ' + (err && err.message ? err.message : err) + '</p>';
        });
    }

    function applyComputedMetrics(data) {
        // JCR = revistas marcadas como indexadas en JCR
        var jcr = data.journals.filter(function (j) {
            return (j.indexedIn || []).indexOf("JCR") !== -1;
        });
        setStat("jcr", jcr.length);

        // Desglose por cuartil
        var counts = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, unknown: 0 };
        jcr.forEach(function (j) {
            if (j.quartile && counts.hasOwnProperty(j.quartile)) counts[j.quartile]++;
            else counts.unknown++;
        });
        renderQuartileBreakdown(counts);

        // Congresos por ámbito
        var ci = data.conferences.filter(function (c) { return c.scope === "international"; }).length;
        var cn = data.conferences.filter(function (c) { return c.scope === "national"; }).length;
        setStat("conf-int", ci);
        setStat("conf-nac", cn);

        setStat("software", data.software.length);
    }

    function renderQuartileBreakdown(counts) {
        var wrap = document.getElementById("quartileBreakdown");
        if (!wrap) return;
        var order = ["Q1", "Q2", "Q3", "Q4"];
        var html = order.map(function (q) {
            var n = counts[q] || 0;
            return '<span class="q-pill q-' + q.toLowerCase() + (n === 0 ? " is-zero" : "") +
                '"><span class="q-label">' + q + '</span><span class="q-count">' + n + '</span></span>';
        }).join("");
        if (counts.unknown > 0) {
            html += '<span class="q-pill q-unknown" title="Cuartil sin asignar">' +
                '<span class="q-label">?</span><span class="q-count">' + counts.unknown + '</span></span>';
        }
        wrap.innerHTML = html;
    }

    function renderPublications(data) {
        var all = []
            .concat(data.journals.map(function (j) { j._type = "journal"; return j; }))
            .concat(data.conferences.map(function (c) { c._type = "conference"; return c; }))
            .concat(data.software.map(function (s) { s._type = "software"; return s; }));

        // Orden: año descendente y, dentro del año, por fecha real (más reciente
        // primero). Los artículos de revista no tienen fecha exacta: se usa un
        // punto medio del año como respaldo, y el id como desempate final.
        function pubSortDate(it) {
            return it.date || it.registryDate || (it.year + "-06-30");
        }
        all.sort(function (a, b) {
            if (b.year !== a.year) return b.year - a.year;
            var da = pubSortDate(a), db = pubSortDate(b);
            if (da !== db) return db < da ? -1 : 1;
            return (b.id || "").localeCompare(a.id || "");
        });

        pubState.items = all;

        setChipCount("all", all.length);
        setChipCount("journal", data.journals.length);
        setChipCount("conference", data.conferences.length);
        setChipCount("software", data.software.length);

        renderPubView();
        buildCoauthorNetwork(all);
    }

    /* ---------- Red de coautoría ----------
       Reúne todos los pares (autor A, autor B) que firman juntos al menos
       una publicación. El nodo "me" (López Ruiz) es el centro fijo; el
       resto se ordena con física fuerza-dirigida (vis-network). */
    function buildCoauthorNetwork(allItems) {
        var container = document.getElementById("coauthorNetwork");
        if (!container) return;
        if (typeof vis === "undefined") {
            // vis-network todavía cargando, reintenta
            return setTimeout(function () { buildCoauthorNetwork(allItems); }, 500);
        }
        // Guarda los items para poder repintar al cambiar de tema
        coauthorState.allItems = allItems;

        // Clave canónica para identificarme a mí mismo: primer apellido + inicial.
        var ME_KEY = "lopez_j";

        // Cuenta de coautores y de pares
        var counts = {};   // canonKey -> coautoría count con López Ruiz
        var labels = {};   // canonKey -> { text, score } del label preferido

        allItems.forEach(function (pub) {
            var authors = (pub.authors || []).map(function (a) { return String(a || "").trim(); });
            var keys = authors.map(normalizeAuthorKey);
            var hasMe = keys.indexOf(ME_KEY) !== -1;
            if (!hasMe) return;
            authors.forEach(function (a, i) {
                var key = keys[i];
                if (!key || key === ME_KEY) return;
                counts[key] = (counts[key] || 0) + 1;
                // Conservamos la forma más completa del nombre (más palabras
                // y más letras = más datos visibles)
                var score = a.split(/\s+/).length * 10 + a.length;
                if (!labels[key] || score > labels[key].score) {
                    labels[key] = { text: a, score: score };
                }
            });
        });

        var coauthorNames = Object.keys(counts);
        if (!coauthorNames.length) {
            container.innerHTML = '<p style="padding:1rem;color:var(--color-muted)">Sin datos de coautoría todavía.</p>';
            return;
        }

        // Colores leídos del tema activo (CSS vars). Si el usuario cambia de
        // tema, refreshThemedVisualizations() invoca a esta función de nuevo
        // y los valores se reevalúan.
        var meColor      = cssVar("--color-accent",        "#047857");
        var accentSoft   = cssVar("--color-accent-soft",   "#d1fae5");
        var goldColor    = cssVar("--color-gold",          "#b8860b");
        var textColor    = cssVar("--color-text",          "#1a1a1a");
        var surfaceColor = cssVar("--color-surface",       "#ffffff");
        var edgeColor    = cssVar("--color-border",        "#a7f3d0");
        var isDark       = document.documentElement.getAttribute("data-theme") === "dark";

        var nodes = [{
            id: "__me__",
            label: "López Ruiz, J. L.",
            value: Math.max(20, coauthorNames.length),
            color: { background: meColor, border: meColor, highlight: { background: meColor, border: goldColor } },
            font: {
                color: isDark ? "#ffffff" : textColor,
                size: 15, face: "Inter", bold: true,
                strokeWidth: 3,
                strokeColor: isDark ? "#000000" : "#ffffff"
            },
            shape: "dot",
            fixed: false
        }];
        coauthorNames.forEach(function (key) {
            nodes.push({
                id: key,
                label: labels[key].text,
                value: counts[key],
                color: {
                    background: isDark ? meColor : accentSoft,
                    border: isDark ? goldColor : meColor,
                    highlight: { background: meColor, border: goldColor }
                },
                font: {
                    color: isDark ? "#ffffff" : textColor,
                    size: 12, face: "Inter",
                    strokeWidth: isDark ? 2 : 0,
                    strokeColor: isDark ? "#0d1117" : "transparent"
                },
                shape: "dot",
                title: counts[key] + " publicaciones conjuntas"
            });
        });

        var edges = coauthorNames.map(function (key) {
            return {
                from: "__me__",
                to: key,
                value: counts[key],
                color: { color: edgeColor, highlight: meColor }
            };
        });

        try {
            var network = new vis.Network(container, { nodes: nodes, edges: edges }, {
                physics: {
                    enabled: true,
                    solver: "forceAtlas2Based",
                    forceAtlas2Based: { gravitationalConstant: -50, springLength: 90, springConstant: 0.08 },
                    stabilization: { iterations: 200 }
                },
                interaction: { hover: true, tooltipDelay: 250, zoomView: true, dragView: true },
                nodes: { borderWidth: 2, scaling: { min: 10, max: 38, label: { enabled: true, min: 11, max: 18 } } },
                edges: { smooth: { type: "continuous" }, scaling: { min: 0.5, max: 4 } }
            });
            coauthorState.instance = network;

            // Botón de reset: re-corre la física y encuadra todos los nodos.
            var resetBtn = document.getElementById("coauthorReset");
            if (resetBtn) {
                resetBtn.addEventListener("click", function () {
                    try {
                        network.setOptions({ physics: { enabled: true } });
                        network.stabilize(200);
                        network.fit({ animation: { duration: 600, easingFunction: "easeInOutQuad" } });
                    } catch (e) { /* ignore */ }
                });
            }
        } catch (e) {
            console.warn("[coauthor] error construyendo el grafo:", e);
        }
    }

    /* Clave canónica para identificar a un autor de forma única.
       Estrategia: primer apellido + inicial del nombre. Así:
         "Espinilla Estévez, M."  → "espinilla_m"
         "Espinilla, M."          → "espinilla_m"
         "Espinilla Estévez, Macarena" → "espinilla_m"
       Tres nodos colapsan en uno solo. */
    function normalizeAuthorKey(name) {
        var s = String(name || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")    // diacríticos
            .trim();
        if (!s) return "";

        var commaIdx = s.indexOf(",");
        var lastName, firstInitial;
        if (commaIdx > 0) {
            // Formato "Apellido[s], Nombre" → tomamos el primer apellido y
            // la primera letra del nombre.
            var lastPart = s.slice(0, commaIdx).trim();
            var firstPart = s.slice(commaIdx + 1).replace(/[.,]/g, "").trim();
            lastName = lastPart.split(/\s+/)[0];
            firstInitial = firstPart.charAt(0) || "";
        } else {
            // Formato "Nombre Apellido" → primer apellido = última palabra
            var parts = s.replace(/[.,]/g, "").split(/\s+/);
            firstInitial = (parts[0] || "").charAt(0);
            lastName = parts[parts.length - 1];
        }
        return (lastName + "_" + firstInitial).replace(/[^a-z_]/g, "");
    }

    /* Renderiza la "vista actual" según pubState (filtro + página + tamaño). */
    function renderPubView(opts) {
        opts = opts || {};
        var container = document.getElementById("publicationsList");
        var pager = document.getElementById("publicationsPager");
        if (!container) return;

        var filtered = pubState.filter === "all"
            ? pubState.items
            : pubState.items.filter(function (it) { return it._type === pubState.filter; });

        var q = normalizeText(pubState.search).trim();
        if (q) {
            filtered = filtered.filter(function (it) { return pubSearchText(it).indexOf(q) !== -1; });
        }

        var pageSize = pubState.pageSize === "all" ? filtered.length || 1 : pubState.pageSize;
        var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        if (pubState.page > totalPages) pubState.page = totalPages;
        if (pubState.page < 1) pubState.page = 1;

        var start = (pubState.page - 1) * pageSize;
        var end = start + pageSize;
        var slice = filtered.slice(start, end);

        function paint() {
            if (slice.length === 0) {
                container.innerHTML = '<p class="muted-note"><i class="fa-solid fa-circle-info"></i> ' + escapeHtml(t("publications.empty")) + '</p>';
            } else {
                container.innerHTML = slice.map(function (item, idx) {
                    var html = renderCard(item);
                    // Inyecta el índice como variable CSS para el stagger
                    return html.replace('class="pub-card"', 'class="pub-card" style="--idx:' + idx + '"');
                }).join("");
            }
            renderPager(pager, filtered.length, totalPages);
        }

        // Transición de salida → repinta → entrada
        var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (opts.animate !== false && !prefersReduced) {
            container.classList.add("is-leaving");
            setTimeout(function () {
                container.classList.remove("is-leaving");
                paint();
            }, 180);
        } else {
            paint();
        }
    }

    function renderPager(pager, total, totalPages) {
        if (!pager) return;
        if (total === 0) { pager.innerHTML = ""; return; }

        var pageSize = pubState.pageSize === "all" ? total : pubState.pageSize;
        var from = (pubState.page - 1) * pageSize + 1;
        var to = Math.min(pubState.page * pageSize, total);

        var info = '<div class="pager-info">' + escapeHtml(t("publications.pager.showing")) + ' <strong>' + from + "–" + to + "</strong> " + escapeHtml(t("publications.pager.of")) + " <strong>" + total + "</strong></div>";

        var nav = "";
        if (totalPages > 1) {
            nav += '<div class="pager-controls" role="navigation" aria-label="' + escapeHtml(t("publications.pager.page")) + '">';
            nav += pubState.page > 1
                ? '<button class="pager-btn pager-prev" data-page="' + (pubState.page - 1) + '" aria-label="' + escapeHtml(t("publications.pager.prev")) + '"><i class="fa-solid fa-chevron-left"></i></button>'
                : '<button class="pager-btn" disabled><i class="fa-solid fa-chevron-left"></i></button>';

            var lastShown = 0;
            for (var p = 1; p <= totalPages; p++) {
                var isCurrent = p === pubState.page;
                var nearCurrent = Math.abs(p - pubState.page) <= 1;
                var isEdge = p === 1 || p === totalPages;
                if (isEdge || nearCurrent) {
                    if (lastShown && p - lastShown > 1) {
                        nav += '<span class="pager-dots">…</span>';
                    }
                    nav += '<button class="pager-btn' + (isCurrent ? " is-active" : "") + '" data-page="' + p + '"' +
                        (isCurrent ? ' aria-current="page"' : "") + ">" + p + "</button>";
                    lastShown = p;
                }
            }

            nav += pubState.page < totalPages
                ? '<button class="pager-btn pager-next" data-page="' + (pubState.page + 1) + '" aria-label="' + escapeHtml(t("publications.pager.next")) + '"><i class="fa-solid fa-chevron-right"></i></button>'
                : '<button class="pager-btn" disabled><i class="fa-solid fa-chevron-right"></i></button>';
            nav += "</div>";
        }

        var select =
            '<div class="per-page">' +
                '<label for="perPage">' + escapeHtml(t("publications.pager.perPage")) + '</label>' +
                '<select id="perPage" class="per-page-input">' +
                    ["10", "25", "50", "all"].map(function (v) {
                        var label = v === "all" ? t("publications.pager.all") : v;
                        var sel = String(pubState.pageSize) === v ? " selected" : "";
                        return '<option value="' + v + '"' + sel + ">" + escapeHtml(label) + "</option>";
                    }).join("") +
                "</select>" +
            "</div>";

        pager.innerHTML = info + nav + select;

        // Click handlers
        pager.querySelectorAll(".pager-btn[data-page]").forEach(function (b) {
            b.addEventListener("click", function () {
                pubState.page = parseInt(b.getAttribute("data-page"), 10);
                renderPubView();
                var sec = document.getElementById("publicaciones");
                if (sec && sec.scrollIntoView) {
                    sec.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });
        });
        var sel = pager.querySelector("#perPage");
        if (sel) {
            sel.addEventListener("change", function () {
                var v = sel.value;
                pubState.pageSize = v === "all" ? "all" : parseInt(v, 10);
                pubState.page = 1;
                renderPubView();
            });
        }
    }

    function setChipCount(filter, n) {
        var chip = document.querySelector('.filter-chip[data-filter="' + filter + '"]');
        if (!chip) return;
        var badge = chip.querySelector(".filter-count");
        if (badge) badge.textContent = n;
        else chip.insertAdjacentHTML("beforeend", ' <span class="filter-count">' + n + '</span>');
    }

    function escapeHtml(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function highlightAuthor(authors, position) {
        return (authors || []).map(function (a, i) {
            var esc = escapeHtml(a);
            return (i + 1) === position ? "<strong>" + esc + "</strong>" : esc;
        }).join("; ");
    }

    function renderCard(item) {
        if (item._type === "journal") return renderJournalCard(item);
        if (item._type === "conference") return renderConferenceCard(item);
        if (item._type === "software") return renderSoftwareCard(item);
        return "";
    }

    var PUBLISHER_LOGOS = {
        "elsevier": "assets/img/publishers/elsevier-logo.png",
        "elsevier b.v.": "assets/img/publishers/elsevier-logo.png",
        "elsevier b.v": "assets/img/publishers/elsevier-logo.png",
        "mdpi": "assets/img/publishers/MDPI-logo.png",
        "multidisciplinary digital publishing institute": "assets/img/publishers/MDPI-logo.png",
        "ieee": "assets/img/publishers/ieee-logo.png",
        "institute of electrical and electronics engineers": "assets/img/publishers/ieee-logo.png",
        "emerald": "assets/img/publishers/emerald-logo.png",
        "emerald publishing": "assets/img/publishers/emerald-logo.png",
        "graz university of technology": "assets/img/publishers/graz.svg"
    };
    function publisherLogo(name) {
        if (!name) return null;
        return PUBLISHER_LOGOS[String(name).trim().toLowerCase()] || null;
    }

    // Portada propia de cada revista. kind: "cover" = portada vertical real
    // (se muestra a sangre); "logo" = logotipo horizontal de la revista
    // (se muestra sobre fondo blanco con margen). Las revistas sin entrada
    // aquí recaen en el logo de la editorial (publisherLogo).
    var JOURNAL_COVERS = {
        "information fusion": { src: "assets/img/journals/information-fusion.jpg", kind: "cover" },
        "computer methods and programs in biomedicine": { src: "assets/img/journals/computer-methods-programs-biomedicine.jpg", kind: "cover" },
        "sustainable cities and society": { src: "assets/img/journals/sustainable-cities-and-society.jpg", kind: "cover" },
        "ieee internet of things journal": { src: "assets/img/journals/ieee-internet-of-things-journal.jpg", kind: "cover" },
        "ieee access": { src: "assets/img/journals/ieee-access.jpg", kind: "cover" },
        "smart and sustainable built environment": { src: "assets/img/journals/smart-sustainable-built-environment.jpg", kind: "cover" },
        "sensors": { src: "assets/img/journals/sensors-cover.png", kind: "cover" },
        "journal of universal computer science": { src: "assets/img/journals/journal-universal-computer-science.jpg", kind: "logo" },
        "applied sciences": { src: "assets/img/journals/applied-sciences-cover.png", kind: "cover" },
        "international journal of environmental research and public health": { src: "assets/img/journals/ijerph-cover.png", kind: "cover" }
    };
    function journalCover(name) {
        if (!name) return null;
        return JOURNAL_COVERS[String(name).trim().toLowerCase()] || null;
    }

    // Portada de las actas (proceedings) de cada congreso, clave = acronimo-año
    // (varias ponencias comparten el mismo volumen). kind igual que en revistas.
    // Los congresos sin entrada muestran el icono genérico.
    var CONFERENCE_COVERS = {
        "ucami-2025": { src: "assets/img/conferences/ucami-2025.jpg", kind: "cover" },
        "ucami-2024": { src: "assets/img/conferences/ucami-2024.jpg", kind: "cover" },
        "ucami-2023": { src: "assets/img/conferences/ucami-2023.jpg", kind: "cover" },
        "ucami-2022": { src: "assets/img/conferences/ucami-2022.jpg", kind: "cover" },
        "soco-2025": { src: "assets/img/conferences/soco-2025.jpg", kind: "cover" },
        "iwann-2023": { src: "assets/img/conferences/iwann-2023.jpg", kind: "cover" },
        "iwbbio-2022": { src: "assets/img/conferences/iwbbio-2022.jpg", kind: "cover" },
        "iciap-2022": { src: "assets/img/conferences/iciap-2022.jpg", kind: "cover" },
        "ipin-2025": { src: "assets/img/conferences/ipin-2025.jpg", kind: "cover" },
        "fuzz-ieee-2025": { src: "assets/img/conferences/fuzz-ieee-2025.jpg", kind: "cover" },
        "fuzz-ieee-2024": { src: "assets/img/conferences/fuzz-ieee-2024.jpg", kind: "cover" },
        "ijcnn-2024": { src: "assets/img/conferences/ijcnn-2024.jpg", kind: "cover" },
        "cec-2024": { src: "assets/img/conferences/cec-2024.jpg", kind: "cover" },
        "ict4awe-2025": { src: "assets/img/conferences/ict4awe-2025.png", kind: "cover" },
        "ichi-2025": { src: "assets/img/conferences/ichi-2025.png", kind: "cover" },
        "gch-2020": { src: "assets/img/conferences/gch-2020.jpg", kind: "cover" },
        "ceig-2019": { src: "assets/img/conferences/ceig-2019.jpg", kind: "cover" },
        "ceig-2018": { src: "assets/img/conferences/ceig-2018.jpg", kind: "cover" },
        "estylf-2022": { src: "assets/img/conferences/estylf-2022.jpg", kind: "cover" },
        "sarteco-2024": { src: "assets/img/conferences/sarteco-2024.jpg", kind: "cover" },
        "sarteco-2022": { src: "assets/img/conferences/sarteco-2022.jpg", kind: "cover" },
        "egprn-2023": { src: "assets/img/conferences/egprn-2023.jpg", kind: "cover" },
        "hicss-2023": { src: "assets/img/conferences/hicss-2023.jpg", kind: "cover" },
        "hicss-2024": { src: "assets/img/conferences/hicss-2024.jpg", kind: "cover" },
        "taee-2022": { src: "assets/img/conferences/taee-2022.png", kind: "cover" },
        "estylf-2025": { src: "assets/img/conferences/estylf-2025.jpg", kind: "cover" }
    };
    function conferenceCover(acronym, year) {
        if (!acronym) return null;
        return CONFERENCE_COVERS[(String(acronym).trim().toLowerCase() + "-" + year)] || null;
    }

    // Ranking CORE (portal.core.edu.au) de congresos internacionales, usando la
    // edición vigente en el periodo de cada congreso (estos mantienen el mismo
    // rango entre ediciones). Solo A/A*/B/C; el resto no figura en CORE.
    var CONFERENCE_CORE = {
        "fuzz-ieee": { rank: "B", id: 649 },
        "ijcnn": { rank: "B", id: 685 },
        "cec": { rank: "B", id: 2061 },
        "ipin": { rank: "C", id: 2244 },
        "ict4awe": { rank: "C", id: 2241 }
    };
    function conferenceCore(acronym) {
        if (!acronym) return null;
        return CONFERENCE_CORE[String(acronym).trim().toLowerCase()] || null;
    }

    function renderJournalCard(j) {
        var doiLink = j.doi ? "https://doi.org/" + j.doi : null;
        var quartileChip = j.quartile
            ? '<span class="metric-chip chip-' + j.quartile.toLowerCase() + '"><i class="fa-solid fa-medal"></i> ' + j.quartile + "</span>"
            : '<span class="metric-chip subtle" title="' + escapeHtml(t("publications.labels.quartileUnknown")) + '"><i class="fa-regular fa-circle-question"></i> Q?</span>';

        var ifChip = "";
        if (j.impactFactor != null) {
            // El IF mostrado es el valor curado manualmente; se presenta como
            // oficial (sin distinción de fuente ni badge "OA").
            ifChip = '<span class="metric-chip chip-if-jcr" title="' + escapeHtml(t("publications.labels.ifTitle")) + '"><i class="fa-solid fa-chart-line"></i> IF ' + escapeHtml(j.impactFactor) + "</span>";
        }
        var indexedHtml = (j.indexedIn || []).map(function (x) {
            return '<span class="metric-chip subtle">' + escapeHtml(x) + "</span>";
        }).join("");
        var acceptedChip = j.status === "accepted"
            ? '<span class="metric-chip chip-accepted" title="' + escapeHtml(t("publications.labels.accepted")) + '"><i class="fa-solid fa-circle-check"></i> ' + escapeHtml(t("publications.labels.accepted")) + "</span>"
            : "";
        var vol = j.volume ? escapeHtml(j.volume) + (j.issue ? "(" + escapeHtml(j.issue) + ")" : "") : "";
        var venueParts = [escapeHtml(j.journal), vol, escapeHtml(j.pages || ""), j.year].filter(Boolean).join(" · ");
        var title = doiLink
            ? '<a href="' + doiLink + '" target="_blank" rel="noopener">' + escapeHtml(j.title) + "</a>"
            : escapeHtml(j.title);

        var cover = journalCover(j.journal);
        var figureClass, figureInner;
        if (cover && cover.kind === "cover") {
            figureClass = "pub-figure-cover";
            figureInner = '<img class="journal-cover" src="' + cover.src + '" alt="' + escapeHtml(j.journal) + '" loading="lazy" />';
        } else if (cover) {
            figureClass = "pub-figure-publisher";
            figureInner = '<img class="publisher-logo" src="' + cover.src + '" alt="' + escapeHtml(j.journal) + '" loading="lazy" />';
        } else {
            var logo = publisherLogo(j.publisher);
            figureClass = "pub-figure-publisher";
            figureInner = logo
                ? '<img class="publisher-logo" src="' + logo + '" alt="' + escapeHtml(j.publisher) + '" loading="lazy" />'
                : '<i class="fa-solid fa-book-open"></i>';
        }

        return '<article class="pub-card" data-type="journal" data-quartile="' + (j.quartile || "") + '"' + (j.status ? ' data-status="' + j.status + '"' : "") + '>' +
            '<div class="pub-figure ' + figureClass + '">' + figureInner + "</div>" +
            '<div class="pub-body">' +
                '<div class="pub-type-row"><span class="pub-type">' + escapeHtml(t("publications.types.journal")) + ' · ' + j.year + "</span>" +
                    (j.corresponding ? '<span class="pub-flag"><i class="fa-solid fa-envelope-circle-check"></i> ' + escapeHtml(t("publications.labels.corresponding")) + '</span>' : "") +
                "</div>" +
                '<h4 class="pub-title">' + title + "</h4>" +
                '<p class="pub-authors">' + highlightAuthor(j.authors, j.myPosition) + "</p>" +
                '<p class="pub-venue"><em>' + venueParts + "</em></p>" +
                '<div class="pub-metrics">' + acceptedChip + quartileChip + ifChip + indexedHtml + "</div>" +
                (doiLink ? '<div class="pub-actions"><a class="btn btn-sm btn-ghost" href="' + doiLink + '" target="_blank" rel="noopener"><i class="fa-solid fa-link"></i> ' + escapeHtml(t("publications.labels.doi")) + '</a></div>' : "") +
            "</div>" +
        "</article>";
    }

    function renderConferenceCard(c) {
        var doiLink = c.doi ? "https://doi.org/" + c.doi : null;
        var scopeLabel = c.scope === "international" ? t("publications.labels.international") : t("publications.labels.national");
        var scopeChip = '<span class="metric-chip chip-' + c.scope + '"><i class="fa-solid fa-globe"></i> ' + escapeHtml(scopeLabel) + "</span>";
        var acronymChip = c.acronym ? '<span class="metric-chip">' + escapeHtml(c.acronym) + "</span>" : "";
        var presChip = c.presentationType ? '<span class="metric-chip subtle">' + escapeHtml(c.presentationType) + "</span>" : "";
        var specialChip = c.specialSession ? '<span class="metric-chip subtle"><i class="fa-solid fa-star"></i> ' + escapeHtml(c.specialSession) + "</span>" : "";
        var acceptedChip = c.status === "accepted"
            ? '<span class="metric-chip chip-accepted" title="' + escapeHtml(t("publications.labels.accepted")) + '"><i class="fa-solid fa-circle-check"></i> ' + escapeHtml(t("publications.labels.accepted")) + "</span>"
            : "";
        var core = conferenceCore(c.acronym);
        var coreRank = core && core.rank;
        var coreChip = core ? '<a class="metric-chip chip-core chip-core-' + core.rank.toLowerCase().replace("*", "s") + '" href="https://portal.core.edu.au/conf-ranks/' + core.id + '/" target="_blank" rel="noopener" title="Ranking CORE ' + core.rank + (core.edition ? " (edición CORE" + core.edition + ")" : "") + ' — ver ficha en el portal CORE"><i class="fa-solid fa-ranking-star"></i> CORE ' + core.rank + (core.edition ? ' · ' + core.edition : "") + "</a>" : "";
        var venueParts = [escapeHtml(c.conference), escapeHtml(c.location || ""), c.year].filter(Boolean).join(" · ");
        var title = doiLink
            ? '<a href="' + doiLink + '" target="_blank" rel="noopener">' + escapeHtml(c.title) + "</a>"
            : escapeHtml(c.title);

        // figureUrl (por ponencia) tiene prioridad sobre el mapa por acrónimo-año;
        // útil cuando una ponencia tiene su propia portada (p. ej. un booklet de
        // sesión especial) distinta a la del volumen general de actas.
        var cover = conferenceCover(c.acronym, c.year);
        var coverSrc = c.figureUrl || (cover && cover.src) || null;
        var coverKind = c.figureUrl ? "cover" : (cover && cover.kind);
        var figureBlock;
        if (coverSrc && coverKind === "cover") {
            figureBlock = '<div class="pub-figure pub-figure-cover"><img class="journal-cover" src="' + coverSrc + '" alt="' + escapeHtml(c.conference) + '" loading="lazy" /></div>';
        } else if (coverSrc) {
            figureBlock = '<div class="pub-figure pub-figure-publisher"><img class="publisher-logo" src="' + coverSrc + '" alt="' + escapeHtml(c.conference) + '" loading="lazy" /></div>';
        } else {
            figureBlock = '<div class="pub-figure pub-figure-cover"><img class="journal-cover" src="assets/img/conferences/comunicacion-congreso.svg" alt="' + escapeHtml(t("publications.types.conference")) + '" loading="lazy" /></div>';
        }

        return '<article class="pub-card" data-type="conference" data-scope="' + c.scope + '"' + (coreRank ? ' data-core="' + coreRank + '"' : "") + (c.status ? ' data-status="' + c.status + '"' : "") + '>' +
            figureBlock +
            '<div class="pub-body">' +
                '<div class="pub-type-row"><span class="pub-type">' + escapeHtml(t("publications.types.conference")) + ' · ' + c.year + "</span>" +
                    (c.corresponding ? '<span class="pub-flag"><i class="fa-solid fa-envelope-circle-check"></i> ' + escapeHtml(t("publications.labels.corresponding")) + '</span>' : "") +
                "</div>" +
                '<h4 class="pub-title">' + title + "</h4>" +
                '<p class="pub-authors">' + highlightAuthor(c.authors, c.myPosition) + "</p>" +
                '<p class="pub-venue"><em>' + venueParts + "</em></p>" +
                '<div class="pub-metrics">' + acceptedChip + coreChip + scopeChip + acronymChip + presChip + specialChip + "</div>" +
                (doiLink ? '<div class="pub-actions"><a class="btn btn-sm btn-ghost" href="' + doiLink + '" target="_blank" rel="noopener"><i class="fa-solid fa-link"></i> ' + escapeHtml(t("publications.labels.doi")) + '</a></div>' : "") +
            "</div>" +
        "</article>";
    }

    function renderSoftwareCard(s) {
        var doiLink = s.doi ? "https://doi.org/" + s.doi : null;
        var productChip = s.productType ? '<span class="metric-chip chip-software">' + escapeHtml(s.productType) + "</span>" : "";
        var rightsChip = s.rightsHolder ? '<span class="metric-chip subtle">' + escapeHtml(s.rightsHolder) + "</span>" : "";
        var meta = [escapeHtml(s.registry) + " · Nº " + escapeHtml(s.registryNumber), escapeHtml(s.country)].filter(Boolean).join(" · ");

        // Imagen general para registros de propiedad intelectual (override por
        // figureUrl si un registro concreto tuviera su propia portada).
        var coverSrc = s.figureUrl || "assets/img/software/registro-propiedad-intelectual.svg";
        var figureBlock = '<div class="pub-figure pub-figure-cover"><img class="journal-cover" src="' + coverSrc + '" alt="' + escapeHtml(t("publications.types.software")) + '" loading="lazy" /></div>';

        return '<article class="pub-card" data-type="software">' +
            figureBlock +
            '<div class="pub-body">' +
                '<div class="pub-type-row"><span class="pub-type">' + escapeHtml(t("publications.types.software")) + ' · ' + s.year + "</span></div>" +
                '<h4 class="pub-title">' + escapeHtml(s.title) + "</h4>" +
                '<p class="pub-authors">' + highlightAuthor(s.authors, s.myPosition) + "</p>" +
                '<p class="pub-venue"><em>' + meta + "</em></p>" +
                (s.description ? '<p class="pub-summary">' + escapeHtml(s.description) + "</p>" : "") +
                '<div class="pub-metrics">' + productChip + rightsChip + "</div>" +
                (doiLink ? '<div class="pub-actions"><a class="btn btn-sm btn-ghost" href="' + doiLink + '" target="_blank" rel="noopener"><i class="fa-solid fa-link"></i> ' + escapeHtml(t("publications.labels.doi")) + '</a></div>' : "") +
            "</div>" +
        "</article>";
    }

    function initPublicationFiltersDynamic() {
        var chips = document.querySelectorAll(".filter-chip");
        chips.forEach(function (chip) {
            chip.addEventListener("click", function () {
                if (chip.classList.contains("is-active")) return;
                chips.forEach(function (c) { c.classList.remove("is-active"); });
                chip.classList.add("is-active");
                pubState.filter = chip.getAttribute("data-filter");
                pubState.page = 1;
                renderPubView();
            });
        });

        var input = document.getElementById("pubSearch");
        var clearBtn = document.getElementById("pubSearchClear");
        if (input) {
            var debounce;
            var applySearch = function () {
                pubState.search = input.value;
                pubState.page = 1;
                if (clearBtn) clearBtn.hidden = !input.value;
                renderPubView({ animate: false });
            };
            input.addEventListener("input", function () {
                clearTimeout(debounce);
                debounce = setTimeout(applySearch, 160);
            });
            input.addEventListener("search", applySearch);
            if (clearBtn) {
                clearBtn.addEventListener("click", function () {
                    input.value = "";
                    applySearch();
                    input.focus();
                });
            }
        }
    }

    /* ---------- Métricas ----------
       Datos siempre desde local: data/scholar.json (lo refresca el
       GitHub Action cada lunes). Si esa lectura local falla, se cae
       a OpenAlex en directo como red de seguridad — pero el modo
       normal es 100% offline desde los ficheros del repo. */
    function loadMetrics() {
        fetchScholar()
            .then(function (scholar) {
                applyScholarMetrics(scholar);
                updateChartCitations(scholar.counts_by_year || []);
            })
            .catch(function () {
                fetchOpenAlex()
                    .then(function (oa) {
                        applyOpenAlexMetrics(oa);
                        updateChartCitations(oa.counts_by_year || []);
                    })
                    .catch(function (err) {
                        console.warn("Métricas no disponibles:", err);
                        showChartFallback();
                    });
            });
    }

    function fetchScholar() {
        return fetch("data/scholar.json", { cache: "no-cache" })
            .then(function (r) {
                if (!r.ok) throw new Error("scholar.json " + r.status);
                return r.json();
            });
    }

    function fetchOpenAlex() {
        return fetch(OPENALEX_URL)
            .then(function (r) {
                if (!r.ok) throw new Error("openalex " + r.status);
                return r.json();
            });
    }

    function applyScholarMetrics(d) {
        setStat("citations", d.citations);
        setStat("hindex", d.h_index);
        setStat("i10", d.i10_index);
        // Solo cambia la etiqueta de fuente de las cards de impacto, no de las manuales
        document.querySelectorAll("#statsImpact .stat-source").forEach(function (el) {
            el.textContent = "Google Scholar";
        });
    }

    /* Métricas mantenidas a mano (data/manual_metrics.json) */
    function loadManualMetrics() {
        fetch("data/manual_metrics.json", { cache: "no-cache" })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                if (!d) return;
                ["jcr", "conf-int", "conf-nac", "software"].forEach(function (k) {
                    if (d[k] != null) setStat(k, d[k]);
                });
            })
            .catch(function () { /* fichero ausente: las cards quedan en — */ });
    }

    function applyOpenAlexMetrics(d) {
        var stats = d.summary_stats || {};
        setStat("citations", d.cited_by_count);
        setStat("hindex", stats.h_index);
        setStat("i10", stats.i10_index);
    }

    function setStat(key, value) {
        var el = document.querySelector('[data-stat="' + key + '"]');
        if (!el || value == null) return;
        var n = Number(value);
        if (n >= 1000) {
            el.textContent = n.toLocaleString("es-ES");
        } else {
            el.textContent = String(n);
        }
        animateCount(el, n);
    }

    /* Conteo ascendente sutil */
    function animateCount(el, target) {
        if (target < 5 || !Number.isFinite(target)) { el.textContent = target; return; }
        var start = 0;
        var duration = 900;
        var t0 = performance.now();
        function step(now) {
            var p = Math.min(1, (now - t0) / duration);
            // ease-out cubic
            var eased = 1 - Math.pow(1 - p, 3);
            var current = Math.floor(start + (target - start) * eased);
            el.textContent = current.toLocaleString("es-ES");
            if (p < 1) requestAnimationFrame(step);
            else el.textContent = target.toLocaleString("es-ES");
        }
        requestAnimationFrame(step);
    }

    /* ---------- Gráfica de producción + citas ----------
       Combina barras apiladas (Revistas + Congresos + Software por año)
       con una línea encima de Citas en un eje Y secundario.
       Coordina dos fuentes asíncronas (Scholar/OpenAlex para citas,
       data/publications/*.json para producción) mediante chartState. */
    var chartState = {
        citationsByYear: null,
        publicationsByYear: null,
        instance: null
    };

    function computePublicationsByYear(data) {
        var by = {};
        function bump(year, type) {
            if (!year) return;
            if (!by[year]) by[year] = { journal: 0, conference: 0, software: 0 };
            by[year][type]++;
        }
        (data.journals || []).forEach(function (j) { bump(j.year, "journal"); });
        (data.conferences || []).forEach(function (c) { bump(c.year, "conference"); });
        (data.software || []).forEach(function (s) { bump(s.year, "software"); });
        return by;
    }

    function updateChartCitations(countsByYear) {
        chartState.citationsByYear = countsByYear || [];
        renderProductionChart();
    }

    function updateChartPublications(data) {
        chartState.publicationsByYear = computePublicationsByYear(data);
        renderProductionChart();
    }

    function renderProductionChart() {
        if (!window.Chart) { showChartFallback(); return; }
        var canvas = document.getElementById("citationsChart");
        var wrap = document.getElementById("citationsChartWrap");
        if (!canvas) return;

        // Mapa de citas por año
        var citationsMap = {};
        (chartState.citationsByYear || []).forEach(function (c) {
            if (c && typeof c.year === "number") citationsMap[c.year] = c.cited_by_count;
        });

        var pubsMap = chartState.publicationsByYear || {};

        // Conjunto de años de cualquier fuente
        var yearsSet = {};
        Object.keys(citationsMap).forEach(function (y) { yearsSet[y] = true; });
        Object.keys(pubsMap).forEach(function (y) { yearsSet[y] = true; });
        var years = Object.keys(yearsSet).map(Number).sort(function (a, b) { return a - b; });
        if (!years.length) { showChartFallback(); return; }

        // Recorta los primeros años sin actividad para que la gráfica
        // empiece donde realmente arrancó tu producción.
        while (years.length > 1) {
            var y = years[0];
            var hasPubs = (pubsMap[y] || {});
            var pubsZero = !(hasPubs.journal || hasPubs.conference || hasPubs.software);
            var citsZero = !citationsMap[y];
            if (pubsZero && citsZero) years.shift(); else break;
        }

        var labels = years.map(String);
        var journalData = years.map(function (y) { return (pubsMap[y] || {}).journal || 0; });
        var conferenceData = years.map(function (y) { return (pubsMap[y] || {}).conference || 0; });
        var softwareData = years.map(function (y) { return (pubsMap[y] || {}).software || 0; });
        var citationsData = years.map(function (y) {
            return citationsMap[y] !== undefined ? citationsMap[y] : null;
        });

        if (wrap) wrap.classList.add("has-data");

        if (chartState.instance) {
            chartState.instance.destroy();
        }

        // Colores leídos del tema activo (CSS vars). Cambian al togglear.
        var isDark        = document.documentElement.getAttribute("data-theme") === "dark";
        var textColor     = cssVar("--color-text",       "#1a1a1a");
        var textSoftColor = cssVar("--color-text-soft",  "#6b7280");
        var mutedColor    = cssVar("--color-muted",      "#6b7280");
        var accentColor   = cssVar("--color-accent",     "#047857");
        var accentStrong  = cssVar("--color-accent-strong", "#065f46");
        var gridColor     = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
        var lineColor     = isDark ? "#f0f6fc" : "#1a1a1a";
        var lineBg        = isDark ? "rgba(240, 246, 252, 0.08)" : "rgba(26, 26, 26, 0.08)";
        var pointBorder   = isDark ? "#0d1117" : "#fff";

        chartState.instance = new Chart(canvas, {
            data: {
                labels: labels,
                datasets: [
                    {
                        type: "bar",
                        label: "Revistas",
                        data: journalData,
                        backgroundColor: accentColor,
                        borderRadius: 4,
                        stack: "pubs",
                        yAxisID: "y",
                        order: 2
                    },
                    {
                        type: "bar",
                        label: "Congresos",
                        data: conferenceData,
                        backgroundColor: "#10b981",
                        borderRadius: 4,
                        stack: "pubs",
                        yAxisID: "y",
                        order: 2
                    },
                    {
                        type: "bar",
                        label: "Software",
                        data: softwareData,
                        backgroundColor: "#a7f3d0",
                        borderRadius: 4,
                        stack: "pubs",
                        yAxisID: "y",
                        order: 2
                    },
                    {
                        type: "line",
                        label: "Citas",
                        data: citationsData,
                        borderColor: lineColor,
                        backgroundColor: lineBg,
                        tension: 0.35,
                        yAxisID: "y1",
                        pointRadius: 4,
                        pointHoverRadius: 7,
                        pointBackgroundColor: lineColor,
                        pointBorderColor: pointBorder,
                        pointBorderWidth: 2,
                        fill: false,
                        spanGaps: false,
                        borderWidth: 2.5,
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 700, easing: "easeOutQuart" },
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: {
                        position: "top",
                        align: "center",
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 16,
                            font: { family: "Inter", size: 12, weight: "500" },
                            color: textColor
                        }
                    },
                    tooltip: {
                        backgroundColor: isDark ? "#1c2129" : "#1a1a1a",
                        titleFont: { family: "Inter", weight: "600" },
                        bodyFont: { family: "Inter" },
                        padding: 12,
                        cornerRadius: 6,
                        callbacks: {
                            label: function (ctx) {
                                var v = ctx.parsed.y;
                                if (v == null) return null;
                                if (ctx.dataset.label === "Citas") {
                                    return "Citas: " + v;
                                }
                                if (v === 0) return null;
                                return ctx.dataset.label + ": " + v;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false, drawBorder: false },
                        ticks: { color: mutedColor, font: { family: "Inter", size: 12, weight: "500" } }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        position: "left",
                        title: {
                            display: true,
                            text: "# Publicaciones",
                            color: accentColor,
                            font: { family: "Inter", size: 12, weight: "600" }
                        },
                        grid: { color: gridColor, drawBorder: false },
                        ticks: {
                            color: mutedColor,
                            font: { family: "Inter", size: 11 },
                            precision: 0
                        }
                    },
                    y1: {
                        beginAtZero: true,
                        position: "right",
                        title: {
                            display: true,
                            text: "# Citas",
                            color: textColor,
                            font: { family: "Inter", size: 12, weight: "600" }
                        },
                        grid: { drawOnChartArea: false, drawBorder: false },
                        ticks: { color: mutedColor, font: { family: "Inter", size: 11 } }
                    }
                }
            }
        });
    }

    function showChartFallback() {
        var wrap = document.getElementById("citationsChartWrap");
        if (wrap) wrap.classList.add("is-fallback");
    }
})();

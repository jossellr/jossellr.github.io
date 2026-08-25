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

    /* Traduce una cadena con marcador {n}, eligiendo singular o plural.
       Si existe la clave "<key>One" se usa cuando n === 1; asi no salen
       cosas como "1 publicaciones conjuntas", que es justo el caso mas
       frecuente (34 coautores tienen una sola publicacion conmigo). */
    function tCount(key, n) {
        var k = (n === 1 && t(key + "One") !== key + "One") ? key + "One" : key;
        return String(t(k)).replace("{n}", n);
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
                repaintProjects();
                renderCoauthorNote();
                if (coauthorState.allItems && typeof vis !== "undefined" && !opts.firstLoad) {
                    rebuildCoauthorNetwork();
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
        quartiles: [],      // cuartiles activos; vacio = sin filtrar (solo revistas)
        coauthor: null,     // clave canonica de coautor al pinchar en el grafo
        year: "all",        // "all" | año concreto
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
        initCoauthorControls();

        // Cargamos español por defecto inmediatamente (no bloquea nada),
        // arrancamos métricas + publicaciones en paralelo, y la detección
        // real de idioma corre aparte: si resuelve a algo distinto,
        // re-aplica la traducción. Así si la geolocalización por IP se
        // cuelga en una red móvil, publicaciones y métricas ya están vivas.
        initTheme();
        initAnalyticsConsent();

        loadLang(DEFAULT_LANG, { firstLoad: true }).then(function () {
            loadMetrics();
            loadTramos();
            loadPublications().then(function () {
                loadManualMetrics();
                loadProjects();
            });
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
            rebuildCoauthorNetwork();
        }
    }

    /* Estado del grafo de coautoría (instancia + datos en cache para repintar) */
    var coauthorState = { instance: null, allItems: null, data: null, showAll: false, unlocked: false };

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

        populateYearFacet(all);
        renderPubView();
        buildCoauthorNetwork(all);
    }

    /* ---------- Red de coautoría ----------
       Antes era una estrella: 62 aristas, todas desde mi nodo. Ahora se
       dibujan también las aristas entre coautores (en los datos hay 250
       relaciones reales), así la maraña pasa a tener estructura.

       Dos umbrales mantienen el grafo legible:
         NODE_MIN  publicaciones conmigo para entrar por defecto. La mitad
                   de los coautores tiene una sola y solo aportaban ruido;
                   se muestran con el interruptor de colaboradores puntuales.
         EDGE_MIN  publicaciones compartidas para unir a dos coautores.
       Y LABEL_RULES decide cuántos nombres se escriben y con qué cuerpo:
       con las 62 etiquetas a la vez no se leía ninguna. */
    var ME_KEY = "lopez_j";
    var NODE_MIN = 2;
    var EDGE_MIN = 2;
    /* Cuantas etiquetas se escriben y a que tamaño. Son dos regimenes
       distintos porque la densidad no tiene nada que ver:
         podado (28 nodos)  el encuadre deja el zoom en ~0,84, asi que
                            caben 22 nombres a cuerpo normal.
         desplegado (62)    el zoom cae a ~0,55 y a ese tamaño el texto se
                            vuelve ilegible. Se etiquetan solo los principales
                            y con cuerpo mayor, que al reducirse sigue leyendose.
       Sin esta distincion, desplegar dejaba el grafo practicamente sin
       nombres: el umbral de dibujo se los comia todos menos uno. */
    var LABEL_RULES = {
        // nameThreshold = publicaciones conjuntas a partir de las cuales se
        // escribe el apellido; por debajo van solo las iniciales.
        // null = iniciales para todos, que es lo unico que cabe con 62 nodos:
        // con apellidos, aun los de los principales acababan pisandose.
        pruned:   { nameThreshold: 3,    fontMin: 13, fontMax: 16 },
        expanded: { nameThreshold: null, fontMin: 16, fontMax: 20 }
    };
    // El cuerpo minimo no es cosmetico: multiplicado por el zoom del encuadre
    // tiene que quedar por encima de drawThreshold (8 px), o vis deja de
    // dibujar la etiqueta. Con 11 y un zoom de 0,72 se perdian la mitad.

    function labelRules() {
        return coauthorState.showAll ? LABEL_RULES.expanded : LABEL_RULES.pruned;
    }

    /* Reparte a cada coautor en un tramo según su última publicación
       conjunta. Se probó agrupar por comunidades detectadas en el grafo,
       pero 26 de 28 nodos caían en el mismo grupo (casi todo el mundo
       firma con Espinilla), así que no distinguía nada. La actividad sí:
       27 activos, 15 recientes y 20 anteriores. */
    function coauthorEra(lastYear) {
        var thisYear = new Date().getFullYear();
        if (lastYear >= thisYear - 1) return "active";
        if (lastYear >= thisYear - 3) return "recent";
        return "past";
    }

    var ERA_ORDER = ["active", "recent", "past"];

    function eraColors(era, isDark) {
        var palette = {
            active: { light: { bg: "#a7f3d0", border: "#047857" }, dark: { bg: "#065f46", border: "#34d399" } },
            recent: { light: { bg: "#bfdbfe", border: "#1d4ed8" }, dark: { bg: "#1e3a8a", border: "#93c5fd" } },
            past:   { light: { bg: "#e5e7eb", border: "#6b7280" }, dark: { bg: "#374151", border: "#9ca3af" } }
        };
        return palette[era][isDark ? "dark" : "light"];
    }

    /* Recorre las publicaciones una sola vez y deja preparado todo lo que
       necesitan el grafo, la lista lateral y la leyenda. */
    function computeCoauthorData(allItems) {
        var counts = {}, labels = {}, lastYear = {}, pairs = {};

        allItems.forEach(function (pub) {
            var authors = (pub.authors || []).map(function (a) { return String(a || "").trim(); });
            var keys = authors.map(normalizeAuthorKey);
            if (keys.indexOf(ME_KEY) === -1) return;

            var others = [];
            authors.forEach(function (a, i) {
                var key = keys[i];
                if (!key || key === ME_KEY) return;
                if (others.indexOf(key) === -1) others.push(key);
                counts[key] = (counts[key] || 0) + 1;
                lastYear[key] = Math.max(lastYear[key] || 0, pub.year || 0);
                // Nos quedamos con la forma más completa del nombre.
                var score = a.split(/\s+/).length * 10 + a.length;
                if (!labels[key] || score > labels[key].score) {
                    labels[key] = { text: a, score: score };
                }
            });

            // Pares de coautores que firman juntos esta publicación.
            others.sort();
            for (var i = 0; i < others.length; i++) {
                for (var j = i + 1; j < others.length; j++) {
                    var id = others[i] + "|" + others[j];
                    pairs[id] = (pairs[id] || 0) + 1;
                }
            }
        });

        return { counts: counts, labels: labels, lastYear: lastYear, pairs: pairs };
    }

    /* Etiqueta corta para el nodo: primer apellido + iniciales. Los
       nombres completos llegaban a 136 px y se pisaban unos con otros.
       No introduce ambiguedad: la clave canonica de un autor ya es
       "primer apellido + inicial", asi que dos personas que compartieran
       forma corta serian el mismo nodo de todas formas.
         "Espinilla Estevez, M."      -> "Espinilla, M."
         "De la Fuente Robles, Y. M." -> "De la Fuente, Y. M."
       Las particulas (de, la, del, van...) cuentan como parte del
       apellido para no dejar cosas como "De, Y. M.". */
    var NAME_PARTICLES = ["de", "del", "la", "las", "los", "y", "van", "von", "der", "da", "do", "dos"];

    function shortName(full) {
        var txt = String(full || "").trim();
        var comma = txt.indexOf(",");
        if (comma === -1) return txt;
        var surnames = txt.slice(0, comma).trim().split(/\s+/);
        var initials = txt.slice(comma + 1).trim();
        var kept = [];
        for (var i = 0; i < surnames.length; i++) {
            var w = surnames[i];
            kept.push(w);
            if (NAME_PARTICLES.indexOf(w.toLowerCase()) === -1) break;
        }
        return kept.join(" ") + ", " + initials;
    }

    /* Iniciales de nombre y apellidos: "López Ruiz, J. L." -> "J.L.L.R.".
       Se usan para los nodos pequeños, donde un nombre no cabe sin pisar al
       vecino. Las particulas no cuentan, para no sacar cosas como "D.L.F.R."
       de "De la Fuente Robles". El nombre completo sigue en el tooltip. */
    function initials(full) {
        var txt = String(full || "").trim();
        var comma = txt.indexOf(",");
        var surnames = comma === -1 ? txt : txt.slice(0, comma);
        var given    = comma === -1 ? ""  : txt.slice(comma + 1);

        function letters(part, dropParticles) {
            return String(part).split(/\s+/).filter(Boolean).filter(function (w) {
                return !dropParticles || NAME_PARTICLES.indexOf(w.toLowerCase()) === -1;
            }).map(function (w) {
                var c = w.replace(/[^A-Za-zÀ-ÿ]/g, "").charAt(0);
                return c ? c.toUpperCase() : "";
            }).filter(Boolean);
        }

        var out = letters(given, false).concat(letters(surnames, true));
        return out.length ? out.join(".") + "." : txt;
    }

    function coauthorLabel(key) {
        var d = coauthorState.data;
        return (d && d.labels[key] && d.labels[key].text) || key;
    }

    /* Claves visibles según el interruptor de colaboradores puntuales. */
    function visibleCoauthors() {
        var d = coauthorState.data;
        if (!d) return [];
        return Object.keys(d.counts).filter(function (k) {
            return coauthorState.showAll || d.counts[k] >= NODE_MIN;
        }).sort(function (a, b) { return d.counts[b] - d.counts[a]; });
    }

    function buildCoauthorNetwork(allItems) {
        var container = document.getElementById("coauthorNetwork");
        if (!container) return;
        if (typeof vis === "undefined") {
            return setTimeout(function () { buildCoauthorNetwork(allItems); }, 500);
        }
        coauthorState.allItems = allItems;
        if (!coauthorState.data) coauthorState.data = computeCoauthorData(allItems);

        var d = coauthorState.data;
        var keys = visibleCoauthors();
        if (!keys.length) {
            container.innerHTML = '<p class="coauthor-empty">' + escapeHtml(t("research.networkEmpty")) + "</p>";
            return;
        }

        var isDark = document.documentElement.getAttribute("data-theme") === "dark";
        var meColor   = cssVar("--color-accent", "#047857");
        var goldColor = cssVar("--color-gold",   "#b8860b");
        var textColor = cssVar("--color-text",   "#1a1a1a");
        var edgeColor = cssVar("--color-border", "#a7f3d0");

        // Mi nodo debe ser el mayor: antes valía el número de coautores (62)
        // y Espinilla, con 74, se dibujaba más grande que el propio centro.
        var maxCount = keys.reduce(function (m, k) { return Math.max(m, d.counts[k]); }, 1);

        var nodes = [{
            id: "__me__",
            label: "López, J. L.",
            value: Math.round(maxCount * 1.25),
            color: { background: meColor, border: goldColor, highlight: { background: meColor, border: goldColor } },
            font: {
                color: isDark ? "#ffffff" : textColor,
                size: 15, face: "Inter", bold: true,
                strokeWidth: 3, strokeColor: isDark ? "#000000" : "#ffffff"
            },
            shape: "dot"
        }];

        keys.forEach(function (key) {
            var n = d.counts[key];
            var era = coauthorEra(d.lastYear[key]);
            var c = eraColors(era, isDark);
            var rules = labelRules();
            // Por encima del umbral, apellido + iniciales; por debajo, solo
            // iniciales. Antes estos se quedaban mudos, que era peor: al
            // desplegar los puntuales el grafo se llenaba de nodos anonimos.
            var named = rules.nameThreshold !== null && n >= rules.nameThreshold;
            nodes.push({
                id: key,
                label: named ? shortName(d.labels[key].text) : initials(d.labels[key].text),
                value: n,
                color: { background: c.bg, border: c.border, highlight: { background: meColor, border: goldColor } },
                font: {
                    color: isDark ? "#ffffff" : textColor,
                    size: 12, face: "Inter",
                    strokeWidth: isDark ? 2 : 0,
                    strokeColor: isDark ? "#0d1117" : "transparent"
                },
                shape: "dot",
                // El tooltip se arma con la clave traducida: antes estaba en
                // español fijo y en la versión inglesa seguía en castellano.
                title: d.labels[key].text + " — " + tCount("research.jointPubs", n)
            });
        });

        var edges = keys.map(function (key) {
            return {
                from: "__me__", to: key, value: d.counts[key],
                color: { color: edgeColor, highlight: meColor }
            };
        });

        // Aristas entre coautores: lo que convierte la estrella en una red.
        var shown = {};
        keys.forEach(function (k) { shown[k] = true; });
        Object.keys(d.pairs).forEach(function (id) {
            var w = d.pairs[id];
            if (w < EDGE_MIN) return;
            var ab = id.split("|");
            if (!shown[ab[0]] || !shown[ab[1]]) return;
            edges.push({
                from: ab[0], to: ab[1], value: w,
                color: { color: edgeColor, opacity: isDark ? 0.35 : 0.5, highlight: meColor },
                dashes: [4, 4]
            });
        });

        try {
            var network = new vis.Network(container, { nodes: nodes, edges: edges }, {
                physics: {
                    enabled: true,
                    solver: "forceAtlas2Based",
                    // avoidOverlap separa los nodos contando su radio. Ojo con
                    // pasarse: al esparcirlos mucho, el fit() posterior baja el
                    // zoom y las etiquetas quedan ilegibles aunque no choquen.
                    // Estos valores mantienen el zoom en torno a 0,8.
                    forceAtlas2Based: {
                        gravitationalConstant: -62,
                        springLength: 110,
                        springConstant: 0.07,
                        avoidOverlap: 0.45
                    },
                    stabilization: { iterations: 200 }
                },
                interaction: {
                    hover: true, tooltipDelay: 250,
                    // En táctil el grafo no captura el dedo hasta que se
                    // desbloquea: si no, deslizar para bajar por la página
                    // desplazaba el grafo en lugar de hacer scroll.
                    zoomView: coauthorState.unlocked,
                    dragView: coauthorState.unlocked
                },
                nodes: {
                    borderWidth: 2,
                    scaling: {
                        min: 10, max: 36,
                        // drawThreshold: por debajo de ese tamaño en pantalla,
                        // vis oculta la etiqueta en lugar de dibujar un borron
                        // ilegible. Salta sobre todo al desplegar los 62 nodos,
                        // donde el encuadre baja el zoom; el nombre sigue
                        // disponible al pasar por encima y en la lista lateral.
                        label: {
                            enabled: true,
                            min: labelRules().fontMin,
                            max: labelRules().fontMax,
                            drawThreshold: 8
                        }
                    }
                },
                edges: { smooth: { type: "continuous" }, scaling: { min: 0.5, max: 5 } }
            });
            coauthorState.instance = network;

            // Congelar la física al estabilizar: antes seguía corriendo
            // indefinidamente, con los nodos temblando y gastando CPU.
            // Con "on" y no "once", el botón de reorganizar puede reactivarla
            // y al terminar vuelve a congelarse; con "once" se habría quedado
            // encendida para siempre tras el primer reset.
            network.on("stabilizationIterationsDone", function () {
                try {
                    network.setOptions({ physics: { enabled: false } });
                    // Con la fisica ya parada se pueden recolocar nodos sin
                    // que la simulacion los devuelva a su sitio.
                    spreadLabels(network, nodes);
                    network.fit({ animation: false });
                } catch (e) { /* ignore */ }
            });

            network.on("click", function (params) {
                if (!params.nodes || !params.nodes.length) return;
                var id = params.nodes[0];
                if (id === "__me__") return;
                filterByCoauthor(id);
            });
        } catch (e) {
            console.warn("[coauthor] error construyendo el grafo:", e);
        }

        renderCoauthorLegend();
        renderCoauthorTop();
        syncCoauthorToggle();
    }

    /* ---------- Separación de etiquetas ----------
       La física por sí sola no garantiza que dos nombres no se pisen: es
       una simulación entre nodos, no entre textos, y vis-network no evita
       colisiones de etiquetas. Con ciertas disposiciones seguían saliendo
       solapes sueltos.

       Tras estabilizar, se mide la caja de cada etiqueta y se separan las
       que chocan, desplazando ambos nodos por el eje donde el solape es
       menor (el vector de separación mínimo). Así se corrige lo justo y la
       forma general del grafo no se altera.

       Las medidas van en coordenadas de lienzo, no de pantalla: vis define
       el cuerpo de letra en esas unidades, de modo que el resultado no
       depende del zoom con el que se acabe encuadrando. */
    function spreadLabels(network, nodes) {
        var ctx = document.createElement("canvas").getContext("2d");
        var rules = labelRules();
        var values = nodes.map(function (n) { return n.value; });
        var vmin = Math.min.apply(null, values);
        var vmax = Math.max.apply(null, values);
        var pos = network.getPositions();

        var boxes = [];
        nodes.forEach(function (n) {
            var txt = String(n.label || "").trim();
            if (!txt) return;
            var p = pos[n.id];
            if (!p) return;
            var f = vmax > vmin ? (n.value - vmin) / (vmax - vmin) : 0;
            var size = rules.fontMin + f * (rules.fontMax - rules.fontMin);
            // Radio aproximado del nodo, con la misma escala que usa vis.
            var radius = 10 + f * 26;
            ctx.font = size + "px Inter, sans-serif";
            boxes.push({
                id: n.id,
                x: p.x,
                y: p.y,
                w: ctx.measureText(txt).width + 6,
                h: size * 1.25,
                // La etiqueta se dibuja bajo el nodo
                cy: p.y + radius + size * 0.7
            });
        });

        var MARGIN = 4;
        for (var pass = 0; pass < 14; pass++) {
            var moved = false;
            for (var i = 0; i < boxes.length; i++) {
                for (var j = i + 1; j < boxes.length; j++) {
                    var a = boxes[i], b = boxes[j];
                    var dx = (a.w + b.w) / 2 + MARGIN - Math.abs(a.x - b.x);
                    var dy = (a.h + b.h) / 2 + MARGIN - Math.abs(a.cy - b.cy);
                    if (dx <= 0 || dy <= 0) continue;   // no se tocan

                    moved = true;
                    // Se resuelve por el eje de menor penetración.
                    if (dx < dy) {
                        var sx = (a.x <= b.x ? -1 : 1) * dx / 2;
                        a.x += sx; b.x -= sx;
                    } else {
                        var sy = (a.cy <= b.cy ? -1 : 1) * dy / 2;
                        a.y += sy; a.cy += sy;
                        b.y -= sy; b.cy -= sy;
                    }
                }
            }
            if (!moved) break;
        }

        boxes.forEach(function (b) {
            try { network.moveNode(b.id, b.x, b.y); } catch (e) { /* ignore */ }
        });
    }

    /* Leyenda de los tramos de actividad. */
    function renderCoauthorLegend() {
        var wrap = document.getElementById("coauthorLegend");
        if (!wrap) return;
        var d = coauthorState.data;
        if (!d) return;
        var byEra = {};
        visibleCoauthors().forEach(function (k) {
            var e = coauthorEra(d.lastYear[k]);
            byEra[e] = (byEra[e] || 0) + 1;
        });
        wrap.innerHTML = ERA_ORDER.filter(function (e) { return byEra[e]; }).map(function (e) {
            return '<span class="coauthor-legend-item coauthor-era-' + e + '">' +
                '<span class="coauthor-legend-dot"></span>' +
                escapeHtml(t("research.eras." + e)) +
                ' <span class="coauthor-legend-n">' + byEra[e] + "</span></span>";
        }).join("");
    }

    /* Lista de principales colaboradores. Además de leyenda navegable, es
       la alternativa accesible al canvas: son botones reales, alcanzables
       con el teclado, cosa que el grafo no ofrece. */
    function renderCoauthorTop() {
        var list = document.getElementById("coauthorTopList");
        if (!list) return;
        var d = coauthorState.data;
        if (!d) return;
        // La lista va completa, no recortada: el canvas esta marcado como
        // aria-hidden, asi que esta es la unica via para quien navega con
        // lector de pantalla o teclado. Se desplaza si no cabe.
        list.innerHTML = visibleCoauthors().map(function (k) {
            var era = coauthorEra(d.lastYear[k]);
            return '<li>' +
                '<button type="button" class="coauthor-top-btn coauthor-era-' + era + '" data-coauthor="' + escapeHtml(k) + '">' +
                    '<span class="coauthor-legend-dot"></span>' +
                    '<span class="coauthor-top-name">' + escapeHtml(d.labels[k].text) + "</span>" +
                    '<span class="coauthor-top-n">' + d.counts[k] + "</span>" +
                "</button></li>";
        }).join("");
    }

    function syncCoauthorToggle() {
        var d = coauthorState.data;
        if (!d) return;
        var occasional = Object.keys(d.counts).filter(function (k) { return d.counts[k] < NODE_MIN; }).length;
        var box = document.getElementById("coauthorShowAll");
        var count = document.getElementById("coauthorShowAllCount");
        if (box) box.checked = coauthorState.showAll;
        if (count) count.textContent = occasional ? "+" + occasional : "";
        var label = document.querySelector(".coauthor-toggle");
        if (label) label.hidden = occasional === 0;
    }

    /* Redibuja el grafo desde cero (cambio de umbral o de tema). */
    function rebuildCoauthorNetwork() {
        if (!coauthorState.allItems) return;
        if (coauthorState.instance) {
            try { coauthorState.instance.destroy(); } catch (e) { /* ignore */ }
            coauthorState.instance = null;
        }
        buildCoauthorNetwork(coauthorState.allItems);
    }

    /* Los listeners de los controles se enlazan UNA vez. Antes el del botón
       de reorganizar vivía dentro de buildCoauthorNetwork, que se reejecuta
       en cada cambio de tema: cada alternancia claro/oscuro acumulaba otro
       manejador sobre el mismo botón. */
    function initCoauthorControls() {
        var resetBtn = document.getElementById("coauthorReset");
        if (resetBtn) {
            resetBtn.addEventListener("click", function () {
                var n = coauthorState.instance;
                if (!n) return;
                try {
                    n.setOptions({ physics: { enabled: true } });
                    n.stabilize(200);
                    n.fit({ animation: { duration: 600, easingFunction: "easeInOutQuad" } });
                } catch (e) { /* ignore */ }
            });
        }

        var showAll = document.getElementById("coauthorShowAll");
        if (showAll) {
            showAll.addEventListener("change", function () {
                coauthorState.showAll = showAll.checked;
                rebuildCoauthorNetwork();
            });
        }

        var unlock = document.getElementById("coauthorUnlock");
        if (unlock) {
            unlock.addEventListener("click", function () {
                coauthorState.unlocked = true;
                unlock.hidden = true;
                var n = coauthorState.instance;
                if (n) { try { n.setOptions({ interaction: { zoomView: true, dragView: true } }); } catch (e) { /* ignore */ } }
            });
        }

        var topList = document.getElementById("coauthorTopList");
        if (topList) {
            topList.addEventListener("click", function (ev) {
                var btn = ev.target.closest(".coauthor-top-btn");
                if (btn) filterByCoauthor(btn.getAttribute("data-coauthor"));
            });
        }

        var clear = document.getElementById("pubCoauthorClear");
        if (clear) clear.addEventListener("click", function () { filterByCoauthor(null); });

        // El bloqueo táctil solo estorbaría donde hay ratón.
        if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
            if (unlock) unlock.hidden = false;
        } else {
            coauthorState.unlocked = true;
        }
    }

    /* Clic en un coautor: la lista de publicaciones de abajo se queda con
       los trabajos que firmáis juntos. Es lo que convierte el grafo en algo
       navegable en vez de decorativo. */
    function filterByCoauthor(key) {
        pubState.coauthor = key || null;
        pubState.page = 1;
        if (key) {
            // Un filtro de tipo, cuartil o año activo enmascararía el resultado.
            pubState.filter = "all";
            pubState.quartiles = [];
            pubState.year = "all";
            document.querySelectorAll(".filter-chip").forEach(function (c) {
                c.classList.toggle("is-active", c.getAttribute("data-filter") === "all");
            });
            var ySel = document.getElementById("pubYear");
            if (ySel) ySel.value = "all";
            paintQuartileChips();
            syncQuartileFacet();
            var reset = document.getElementById("pubFacetsReset");
            if (reset) reset.hidden = true;
        }
        renderCoauthorNote();
        renderPubView();
        if (key) {
            var sec = document.getElementById("publicaciones");
            if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    function renderCoauthorNote() {
        var note = document.getElementById("pubCoauthorNote");
        var text = document.getElementById("pubCoauthorText");
        if (!note || !text) return;
        if (!pubState.coauthor) { note.hidden = true; return; }
        note.hidden = false;
        text.innerHTML = '<i class="fa-solid fa-diagram-project"></i> ' +
            escapeHtml(t("publications.coauthor.filtering"))
                .replace("{name}", "<strong>" + escapeHtml(coauthorLabel(pubState.coauthor)) + "</strong>");
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

        // El cuartil solo existe en revistas: al filtrar por él, los congresos
        // y el software quedan fuera por definición.
        if (pubState.coauthor) {
            filtered = filtered.filter(function (it) {
                return (it.authors || []).some(function (a) {
                    return normalizeAuthorKey(a) === pubState.coauthor;
                });
            });
        }

        if (pubState.quartiles.length) {
            filtered = filtered.filter(function (it) {
                return pubState.quartiles.indexOf(it.quartile) !== -1;
            });
        }

        if (pubState.year !== "all") {
            filtered = filtered.filter(function (it) { return String(it.year) === String(pubState.year); });
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

    /* ---------- Cita en BibTeX ----------
       Genera la entrada a partir del propio item del JSON, sin llamadas
       externas: @article para revistas, @inproceedings para congresos y
       @misc para los registros de software. La clave de cita es el `id`
       del item, que el validador ya garantiza unico entre los tres
       ficheros. */
    function bibtexEscape(v) {
        // Llaves y barras invertidas romperian la entrada; el resto de
        // caracteres (acentos incluidos) se dejan tal cual, en UTF-8.
        return String(v == null ? "" : v).replace(/[\\{}]/g, "");
    }

    function bibtexField(name, value) {
        if (value == null || value === "") return "";
        return "  " + name + " = {" + bibtexEscape(value) + "},\n";
    }

    function bibtexAuthors(authors) {
        if (!authors || !authors.length) return "";
        return authors.map(bibtexEscape).join(" and ");
    }

    function buildBibtex(it) {
        var key = it.id || "ref";
        var out;
        if (it._type === "journal") {
            out = "@article{" + key + ",\n" +
                bibtexField("author", bibtexAuthors(it.authors)) +
                bibtexField("title", it.title) +
                bibtexField("journal", it.journal) +
                bibtexField("volume", it.volume) +
                bibtexField("number", it.issue) +
                bibtexField("pages", it.pages) +
                bibtexField("year", it.year) +
                bibtexField("issn", it.issn) +
                bibtexField("publisher", it.publisher) +
                bibtexField("doi", it.doi);
        } else if (it._type === "conference") {
            var booktitle = it.acronym && it.conference !== it.acronym
                ? it.conference + " (" + it.acronym + ")"
                : it.conference;
            out = "@inproceedings{" + key + ",\n" +
                bibtexField("author", bibtexAuthors(it.authors)) +
                bibtexField("title", it.title) +
                bibtexField("booktitle", booktitle) +
                bibtexField("address", it.location) +
                bibtexField("year", it.year) +
                bibtexField("isbn", it.isbn) +
                bibtexField("doi", it.doi);
        } else {
            var note = [it.registry, it.registryNumber ? "N.o " + it.registryNumber : null]
                .filter(Boolean).join(", ");
            out = "@misc{" + key + ",\n" +
                bibtexField("author", bibtexAuthors(it.authors)) +
                bibtexField("title", it.title) +
                bibtexField("year", it.year) +
                bibtexField("howpublished", it.productType) +
                bibtexField("note", note) +
                bibtexField("doi", it.doi);
        }
        // Quita la coma sobrante del ultimo campo y cierra la entrada.
        return out.replace(/,\n$/, "\n") + "}";
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        // Respaldo para navegadores sin Clipboard API o sin contexto seguro.
        return new Promise(function (resolve, reject) {
            try {
                var ta = document.createElement("textarea");
                ta.value = text;
                ta.setAttribute("readonly", "");
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                var ok = document.execCommand("copy");
                document.body.removeChild(ta);
                ok ? resolve() : reject(new Error("execCommand copy falló"));
            } catch (e) { reject(e); }
        });
    }

    /* Fila de acciones común a las tres plantillas de ficha: enlace al DOI
       cuando existe y botón de cita en BibTeX siempre. */
    function pubActions(item, doiLink) {
        var doiBtn = doiLink
            ? '<a class="btn btn-sm btn-ghost" href="' + doiLink + '" target="_blank" rel="noopener" title="' + escapeHtml(t("publications.labels.doiTitle")) + '"><i class="fa-solid fa-link"></i> ' + escapeHtml(t("publications.labels.doi")) + "</a>"
            : "";
        var citeBtn = '<button type="button" class="btn btn-sm btn-ghost pub-cite" data-cite="' + escapeHtml(item.id || "") + '">' +
            '<i class="fa-solid fa-quote-right"></i> <span class="pub-cite-label">' + escapeHtml(t("publications.labels.cite")) + "</span></button>";
        return '<div class="pub-actions">' + doiBtn + citeBtn + "</div>";
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
                pubActions(j, doiLink) +
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
                pubActions(c, doiLink) +
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
                pubActions(s, doiLink) +
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
                syncQuartileFacet();
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

        initPubFacets();
        initPubCite();
    }

    /* ---------- Facetas de cuartil y año ----------
       El cuartil solo tiene sentido sobre revistas, así que el desplegable
       se deshabilita cuando el filtro de tipo activo es congresos o
       software (donde el campo no existe y el resultado sería vacío). */
    function initPubFacets() {
        var chipsWrap = document.getElementById("pubQuartileChips");
        var ySel = document.getElementById("pubYear");
        var reset = document.getElementById("pubFacetsReset");

        if (chipsWrap) {
            chipsWrap.addEventListener("click", function (ev) {
                var chip = ev.target.closest(".q-chip");
                if (!chip) return;
                var q = chip.getAttribute("data-quartile");
                var i = pubState.quartiles.indexOf(q);
                if (i === -1) pubState.quartiles.push(q);
                else pubState.quartiles.splice(i, 1);
                paintQuartileChips();
                refreshFacets();
            });
        }
        if (ySel) {
            ySel.addEventListener("change", function () {
                pubState.year = ySel.value;
                refreshFacets();
            });
        }
        if (reset) {
            reset.addEventListener("click", function () {
                pubState.quartiles = [];
                pubState.year = "all";
                if (ySel) ySel.value = "all";
                paintQuartileChips();
                refreshFacets();
            });
        }
        syncQuartileFacet();
    }

    function facetsAreClean() {
        return pubState.quartiles.length === 0 && pubState.year === "all";
    }

    function refreshFacets() {
        pubState.page = 1;
        var reset = document.getElementById("pubFacetsReset");
        if (reset) reset.hidden = facetsAreClean();
        renderPubView();
    }

    /* Refleja en los chips que cuartiles estan activos. */
    function paintQuartileChips() {
        document.querySelectorAll("#pubQuartileChips .q-chip").forEach(function (chip) {
            var on = pubState.quartiles.indexOf(chip.getAttribute("data-quartile")) !== -1;
            chip.classList.toggle("is-on", on);
            chip.setAttribute("aria-pressed", on ? "true" : "false");
        });
    }

    /* El cuartil solo existe en revistas: la faceta aparece unicamente con
       ese filtro activo y, al salir de el, se limpia para no dejar un
       criterio aplicandose sin control visible. */
    function syncQuartileFacet() {
        var facet = document.getElementById("pubQuartileFacet");
        if (!facet) return;
        var applies = pubState.filter === "journal";
        facet.hidden = !applies;
        if (!applies && pubState.quartiles.length) {
            pubState.quartiles = [];
            paintQuartileChips();
            var reset = document.getElementById("pubFacetsReset");
            if (reset) reset.hidden = facetsAreClean();
        }
    }

    function populateYearFacet(items) {
        var ySel = document.getElementById("pubYear");
        if (!ySel) return;
        var years = [];
        items.forEach(function (it) {
            if (it.year && years.indexOf(it.year) === -1) years.push(it.year);
        });
        years.sort(function (a, b) { return b - a; });
        ySel.innerHTML = '<option value="all" data-i18n="publications.facets.any">' + escapeHtml(t("publications.facets.any")) + "</option>" +
            years.map(function (y) {
                return '<option value="' + y + '"' + (String(pubState.year) === String(y) ? " selected" : "") + ">" + y + "</option>";
            }).join("");
    }

    /* ---------- Botón "Citar" ----------
       Delegado en el contenedor porque las fichas se repintan enteras en
       cada cambio de filtro o página. */
    function initPubCite() {
        var list = document.getElementById("publicationsList");
        if (!list || list.dataset.citeBound === "1") return;
        list.dataset.citeBound = "1";

        list.addEventListener("click", function (ev) {
            var btn = ev.target.closest(".pub-cite");
            if (!btn) return;
            var id = btn.getAttribute("data-cite");
            var item = null;
            for (var i = 0; i < pubState.items.length; i++) {
                if (pubState.items[i].id === id) { item = pubState.items[i]; break; }
            }
            if (!item) return;

            var label = btn.querySelector(".pub-cite-label");
            copyToClipboard(buildBibtex(item))
                .then(function () { flashCiteLabel(btn, label, t("publications.labels.citeCopied"), "is-copied"); })
                .catch(function () { flashCiteLabel(btn, label, t("publications.labels.citeError"), "is-error"); });
        });
    }

    function flashCiteLabel(btn, label, text, cls) {
        if (!label) return;
        if (btn.dataset.restoring === "1") return;
        btn.dataset.restoring = "1";
        var original = label.textContent;
        label.textContent = text;
        btn.classList.add(cls);
        setTimeout(function () {
            label.textContent = original;
            btn.classList.remove(cls);
            btn.dataset.restoring = "0";
        }, 1800);
    }

    /* ---------- Proyectos ----------
       Datos en data/projects.json. La sección entera se oculta si el
       fichero falta o no tiene entradas, igual que hacen los tramos: así
       nunca se queda un bloque vacío en la página. */
    var projectsData = null;

    function loadProjects() {
        var section = document.getElementById("proyectos");
        if (!section) return;
        fetch("data/projects.json", { cache: "no-cache" })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                projectsData = (d && d.items) || [];
                renderProjects(section, projectsData);
            })
            .catch(function () { setProjectsVisible(section, false); });
    }

    /* Sin proyectos que mostrar, la seccion se oculta y con ella su enlace del
       menu: si no, quedaria un enlace que no lleva a ninguna parte. */
    function setProjectsVisible(section, visible) {
        if (section) section.style.display = visible ? "" : "none";
        var link = document.querySelector('.topnav-link[href="#proyectos"]');
        if (link) link.hidden = !visible;
    }

    /* Repinta las tarjetas al cambiar de idioma: sus etiquetas (rol, ámbito,
       estado) y el formato de importe se resuelven en tiempo de render. */
    function repaintProjects() {
        if (!projectsData) return;
        var section = document.getElementById("proyectos");
        if (section) renderProjects(section, projectsData);
    }

    /* Un proyecto está activo si lo dice explícitamente o si su fecha de
       fin aún no ha pasado. */
    function projectIsActive(p) {
        if (p.status) return p.status === "active";
        if (!p.endDate) return false;
        return new Date(p.endDate) >= new Date();
    }

    function formatProjectDates(p) {
        function ym(d) {
            if (!d) return "";
            var parts = String(d).split("-");
            return parts.length >= 2 ? parts[1] + "/" + parts[0] : parts[0];
        }
        return [ym(p.startDate), ym(p.endDate)].filter(Boolean).join(" – ");
    }

    function formatBudget(value) {
        if (value == null) return "";
        var n = Number(value);
        if (!Number.isFinite(n)) return "";
        return n.toLocaleString(currentLang === "en" ? "en-GB" : "es-ES", {
            style: "currency", currency: "EUR", maximumFractionDigits: 0
        });
    }

    function renderProjects(section, items) {
        var list = document.getElementById("projectsList");
        var summary = document.getElementById("projectsSummary");
        if (!list) return;

        if (!items.length) {
            setProjectsVisible(section, false);
            return;
        }
        setProjectsVisible(section, true);

        // Activos primero; dentro de cada grupo, los que terminan más tarde.
        var sorted = items.slice().sort(function (a, b) {
            var aa = projectIsActive(a), ba = projectIsActive(b);
            if (aa !== ba) return aa ? -1 : 1;
            return String(b.endDate || b.startDate || "").localeCompare(String(a.endDate || a.startDate || ""));
        });

        if (summary) {
            var active = sorted.filter(projectIsActive).length;
            var asPi = sorted.filter(function (p) { return p.role === "pi" || p.role === "co-pi"; }).length;
            var cards = [
                { value: sorted.length, key: "projects.summary.total" },
                { value: active, key: "projects.summary.active" }
            ];
            if (asPi > 0) cards.push({ value: asPi, key: "projects.summary.asPi" });
            summary.innerHTML = cards.map(function (c) {
                return '<div class="stat-card">' +
                    '<span class="stat-value">' + c.value + "</span>" +
                    '<span class="stat-label" data-i18n="' + c.key + '">' + escapeHtml(t(c.key)) + "</span>" +
                "</div>";
            }).join("");
        }

        list.innerHTML = sorted.map(renderProjectCard).join("");
    }

    function renderProjectCard(p) {
        var active = projectIsActive(p);
        var statusChip = '<span class="metric-chip ' + (active ? "chip-accepted" : "subtle") + '">' +
            '<i class="fa-solid ' + (active ? "fa-circle-play" : "fa-circle-check") + '"></i> ' +
            escapeHtml(t(active ? "projects.status.active" : "projects.status.finished")) + "</span>";

        var roleChip = p.role
            ? '<span class="metric-chip chip-international"><i class="fa-solid fa-user-tie"></i> ' +
              escapeHtml(t("projects.roles." + p.role)) + "</span>"
            : "";

        var scopeChip = p.scope
            ? '<span class="metric-chip subtle"><i class="fa-solid fa-globe"></i> ' +
              escapeHtml(t("projects.scopes." + p.scope)) + "</span>"
            : "";

        var budget = formatBudget(p.budget);
        var budgetChip = budget
            ? '<span class="metric-chip subtle"><i class="fa-solid fa-euro-sign"></i> ' + escapeHtml(budget) + "</span>"
            : "";

        var dates = formatProjectDates(p);
        var datesChip = dates
            ? '<span class="metric-chip subtle"><i class="fa-regular fa-calendar"></i> ' + escapeHtml(dates) + "</span>"
            : "";

        var acronym = p.acronym
            ? '<span class="project-acronym">' + escapeHtml(p.acronym) + "</span>"
            : "";

        var title = p.url
            ? '<a href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener">' + escapeHtml(p.title) + "</a>"
            : escapeHtml(p.title);

        var meta = [p.funder, p.programme, p.reference].filter(Boolean).map(escapeHtml).join(" · ");

        var partners = (p.partners && p.partners.length)
            ? '<p class="project-partners"><span>' + escapeHtml(t("projects.partners")) + ":</span> " +
              p.partners.map(escapeHtml).join(", ") + "</p>"
            : "";

        // Enlaza con las fichas de publicación ya cargadas, para que se vea
        // qué ha producido cada proyecto.
        var related = "";
        if (p.relatedPublications && p.relatedPublications.length && pubState.items.length) {
            var found = p.relatedPublications.filter(function (id) {
                return pubState.items.some(function (it) { return it.id === id; });
            });
            if (found.length) {
                related = '<p class="project-related"><i class="fa-solid fa-book"></i> ' +
                    escapeHtml(t("projects.related").replace("{n}", found.length)) + "</p>";
            }
        }

        return '<article class="project-card' + (active ? " is-active" : "") + '">' +
            '<div class="project-head">' + acronym + statusChip + "</div>" +
            '<h4 class="project-title">' + title + "</h4>" +
            (meta ? '<p class="project-meta">' + meta + "</p>" : "") +
            (p.description ? '<p class="project-desc">' + escapeHtml(p.description) + "</p>" : "") +
            partners +
            related +
            '<div class="project-chips">' + roleChip + scopeChip + datesChip + budgetChip + "</div>" +
        "</article>";
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
        setImpactSource("metrics.source.scholar");
    }

    /* Reetiqueta la procedencia de las cards de impacto segun la fuente que
       haya respondido. Cambia la clave de i18n, no solo el texto: si se
       tocase el textContent, el siguiente applyI18n() (cambio de idioma o
       deteccion tardia) lo revertiria al valor del HTML. */
    function setImpactSource(key) {
        document.querySelectorAll("#statsImpact .stat-source").forEach(function (el) {
            el.setAttribute("data-i18n", key);
            el.textContent = t(key);
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

    /* Tramos de evaluación reconocidos (sexenios de investigación / quinquenios
       docentes). Los datos viven en data/tramos.json; cada categoría sin tramos
       no pinta tarjeta, y si no hay ninguno se oculta la subsección entera.
       Las etiquetas llevan data-i18n para que applyI18n() las retraduzca al
       cambiar de idioma. */
    function loadTramos() {
        var wrap = document.getElementById("statsTramos");
        var title = document.getElementById("tramosTitle");
        if (!wrap) return;
        fetch("data/tramos.json", { cache: "no-cache" })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) { renderTramos(wrap, title, d); })
            .catch(function () { hideTramos(wrap, title); });
    }

    function hideTramos(wrap, title) {
        if (wrap) wrap.style.display = "none";
        if (title) title.style.display = "none";
    }

    function renderTramos(wrap, title, d) {
        if (!d) return hideTramos(wrap, title);
        var groups = [
            { items: d.sexenios || [], key: "metrics.tramos.sexenios" },
            { items: d.quinquenios || [], key: "metrics.tramos.quinquenios" }
        ].filter(function (g) { return g.items.length > 0; });

        if (!groups.length) return hideTramos(wrap, title);

        wrap.innerHTML = groups.map(function (g) {
            var periods = g.items.map(function (it) {
                return '<span class="tramo-chip">' + escapeHtml(it.period) + "</span>";
            }).join("");
            var bodies = g.items.map(function (it) { return it.body; }).filter(Boolean);
            // El organismo puede venir en siglas; si el JSON trae "bodyFull"
            // se cuelga como title para aclararlas sin romper la tarjeta.
            var source = bodies.length ? escapeHtml(bodies[0]) : "";
            var fulls = g.items.map(function (it) { return it.bodyFull; }).filter(Boolean);
            var sourceTitle = fulls.length ? ' title="' + escapeHtml(fulls[0]) + '"' : "";
            return '<div class="stat-card">' +
                '<span class="stat-value">' + g.items.length + "</span>" +
                '<span class="stat-label" data-i18n="' + g.key + '">' + escapeHtml(t(g.key)) + "</span>" +
                '<div class="tramo-periods">' + periods + "</div>" +
                (source ? '<span class="stat-source"' + sourceTitle + ">" + source + "</span>" : "") +
            "</div>";
        }).join("");
    }

    function applyOpenAlexMetrics(d) {
        var stats = d.summary_stats || {};
        setStat("citations", d.cited_by_count);
        setStat("hindex", stats.h_index);
        setStat("i10", stats.i10_index);
        // Camino de respaldo: si Scholar falla, la procedencia debe decirlo.
        setImpactSource("metrics.source.openalex");
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

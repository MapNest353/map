window.MapApp = {};

MapApp.map = L.map("map", {
    minZoom: 2,
    maxZoom: 18,
    zoomControl: true,
    worldCopyJump: false
});

MapApp.map.setView([20, 0], 2);

L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
    {
        maxZoom: 20,
        attribution: "&copy; OpenStreetMap &copy; CARTO"
    }
).addTo(MapApp.map);

MapApp.countryLayer = null;
MapApp.stateLayer = null;
MapApp.districtLayer = null;

MapApp.saveView = function () {
    return {
        center: MapApp.map.getCenter(),
        zoom: MapApp.map.getZoom()
    };
};

MapApp.restoreView = function (view) {
    if (view) {
        MapApp.map.setView(view.center, view.zoom, {
            animate: false
        });
    }
};

MapApp.removeLayers = function () {
    if (MapApp.countryLayer) {
        MapApp.map.removeLayer(MapApp.countryLayer);
        MapApp.countryLayer = null;
    }

    if (MapApp.stateLayer) {
        MapApp.map.removeLayer(MapApp.stateLayer);
        MapApp.stateLayer = null;
    }

    if (MapApp.districtLayer) {
        MapApp.map.removeLayer(MapApp.districtLayer);
        MapApp.districtLayer = null;
    }
};

/*
 * ============================================================
 * FAST MAP DATA CACHE
 * ============================================================
 *
 * Three levels of caching:
 *
 * 1. Memory cache
 *    Switching Country -> State -> District is instant.
 *
 * 2. IndexedDB cache
 *    Data survives page reloads/browser restarts.
 *
 * 3. Normal browser HTTP cache
 *    GeoJSON files are allowed to be cached normally.
 *
 * Only Country blocks the initial screen.
 * States and Districts preload in the background.
 */

MapApp.dataCache = {};
MapApp.dataPromises = {};
MapApp.cacheDB = null;

MapApp.openCacheDB = function() {

    if (MapApp.cacheDB) {
        return MapApp.cacheDB;
    }

    MapApp.cacheDB = new Promise(function(resolve) {

        if (!window.indexedDB) {
            resolve(null);
            return;
        }

        const request =
            indexedDB.open(
                "MapNestDataCache",
                1
            );

        request.onupgradeneeded = function(event) {

            const db = event.target.result;

            if (!db.objectStoreNames.contains("levels")) {
                db.createObjectStore("levels");
            }
        };

        request.onsuccess = function() {
            resolve(request.result);
        };

        request.onerror = function() {
            console.warn(
                "IndexedDB unavailable; using memory cache only."
            );

            resolve(null);
        };

    });

    return MapApp.cacheDB;
};


MapApp.cacheGet = async function(key) {

    const db =
        await MapApp.openCacheDB();

    if (!db) return null;

    return new Promise(function(resolve) {

        try {

            const tx =
                db.transaction(
                    "levels",
                    "readonly"
                );

            const store =
                tx.objectStore("levels");

            const request =
                store.get(key);

            request.onsuccess = function() {
                resolve(request.result || null);
            };

            request.onerror = function() {
                resolve(null);
            };

        } catch (error) {
            resolve(null);
        }

    });
};


MapApp.cachePut = async function(key, value) {

    const db =
        await MapApp.openCacheDB();

    if (!db) return;

    return new Promise(function(resolve) {

        try {

            const tx =
                db.transaction(
                    "levels",
                    "readwrite"
                );

            tx.objectStore("levels").put(
                value,
                key
            );

            tx.oncomplete = function() {
                resolve();
            };

            tx.onerror = function() {
                resolve();
            };

        } catch (error) {
            resolve();
        }

    });
};


MapApp.getDataCacheKey = function(
    type,
    files
) {

    return (
        "v3::" +
        type +
        "::" +
        files.join(",").toLowerCase()
    );
};


/* =========================================================
   PERSISTENT MAP DATA CACHE
   ========================================================= */

MapApp.dataCache = {};
MapApp.dataPromises = {};
MapApp.cacheDBPromise = null;

MapApp.openCacheDB = function() {

    if (MapApp.cacheDBPromise) {
        return MapApp.cacheDBPromise;
    }

    MapApp.cacheDBPromise = new Promise(function(resolve) {

        if (!window.indexedDB) {
            resolve(null);
            return;
        }

        const request =
            indexedDB.open("MapNestDataCache", 1);

        request.onupgradeneeded = function(event) {

            const db = event.target.result;

            if (!db.objectStoreNames.contains("mapData")) {
                db.createObjectStore("mapData");
            }
        };

        request.onsuccess = function() {
            resolve(request.result);
        };

        request.onerror = function() {
            console.warn("IndexedDB unavailable.");
            resolve(null);
        };
    });

    return MapApp.cacheDBPromise;
};


MapApp.getCachedData = async function(key) {

    const db = await MapApp.openCacheDB();

    if (!db) return null;

    return new Promise(function(resolve) {

        try {

            const tx =
                db.transaction("mapData", "readonly");

            const request =
                tx.objectStore("mapData").get(key);

            request.onsuccess = function() {
                resolve(request.result || null);
            };

            request.onerror = function() {
                resolve(null);
            };

        } catch (error) {
            resolve(null);
        }
    });
};


MapApp.saveCachedData = async function(key, data) {

    const db = await MapApp.openCacheDB();

    if (!db) return;

    return new Promise(function(resolve) {

        try {

            const tx =
                db.transaction("mapData", "readwrite");

            tx.objectStore("mapData").put(
                data,
                key
            );

            tx.oncomplete = function() {
                resolve();
            };

            tx.onerror = function() {
                resolve();
            };

        } catch (error) {
            resolve();
        }
    });
};


MapApp.loadAll = async function(type) {

    /* Already loaded during this session */
    if (MapApp.dataCache[type]) {
        return MapApp.dataCache[type];
    }

    /* Another request is already loading it */
    if (MapApp.dataPromises[type]) {
        return MapApp.dataPromises[type];
    }

    MapApp.dataPromises[type] =
        (async function() {

            const manifest =
                await MapData.manifest();

            const files =
                manifest[type] || [];

            const folders = {
                country: "countries",
                state: "states",
                district: "districts"
            };

            const folder =
                folders[type];

            if (!folder) {
                throw new Error(
                    "Unknown map type: " + type
                );
            }

            /*
             * Cache key is based on the exact list of
             * files in the manifest.
             *
             * If you add a new country later,
             * the key changes automatically and
             * fresh data is downloaded.
             */
            const cacheKey =
                "v3|" +
                type +
                "|" +
                files
                    .map(function(x) {
                        return x.toLowerCase();
                    })
                    .sort()
                    .join(",");

            /* Try persistent browser storage first */
            const cached =
                await MapApp.getCachedData(
                    cacheKey
                );

            if (
                cached &&
                cached.type === "FeatureCollection" &&
                Array.isArray(cached.features)
            ) {

                MapApp.dataCache[type] =
                    cached;

                console.log(
                    "✓ " +
                    type +
                    " loaded from local cache"
                );

                return cached;
            }

            console.log(
                "↓ Downloading " +
                type +
                " data..."
            );

            const datasets =
                await Promise.all(
                    files.map(async function(name) {

                        const url =
                            "data/" +
                            folder +
                            "/" +
                            name.toLowerCase() +
                            ".json";

                        const response =
                            await fetch(
                                url,
                                {
                                    cache: "default"
                                }
                            );

                        if (!response.ok) {
                            throw new Error(
                                "Could not load " +
                                url
                            );
                        }

                        return await response.json();
                    })
                );

            const features = [];

            for (const data of datasets) {

                if (
                    data &&
                    data.type === "FeatureCollection" &&
                    Array.isArray(data.features)
                ) {
                    features.push(
                        ...data.features
                    );
                }
            }

            const result = {
                type: "FeatureCollection",
                features: features
            };

            /* Keep in memory */
            MapApp.dataCache[type] =
                result;

            /* Save for future page loads */
            await MapApp.saveCachedData(
                cacheKey,
                result
            );

            console.log(
                "✓ " +
                type +
                " downloaded and cached"
            );

            return result;

        })();

    try {
        return await MapApp.dataPromises[type];
    } finally {
        delete MapApp.dataPromises[type];
    }
};


/* =========================================================
   BACKGROUND PRELOADING
   ========================================================= */

MapApp.preloadMapData = async function() {

    /*
     * Country is already loaded before this starts.
     */

    await new Promise(function(resolve) {
        setTimeout(resolve, 100);
    });

    try {

        console.log(
            "↓ Background loading States..."
        );

        await MapApp.loadAll("state");

        console.log(
            "✓ States ready"
        );

    } catch (error) {

        console.error(
            "State preload failed:",
            error
        );
    }

    /*
     * Give the browser a chance to paint before
     * beginning the larger district dataset.
     */

    await new Promise(function(resolve) {

        requestAnimationFrame(function() {
            resolve();
        });

    });

    try {

        console.log(
            "↓ Background loading Districts..."
        );

        await MapApp.loadAll("district");

        console.log(
            "✓ Districts ready"
        );

    } catch (error) {

        console.error(
            "District preload failed:",
            error
        );
    }

    console.log(
        "✓ All map data cached"
    );
};


MapApp.getFeatureName = function(feature, level) {

    const p = feature.properties || {};

    const valid = value => {
        if (value === undefined || value === null) return "";
        const x = String(value).trim();
        if (!x) return "";
        if (["NA", "NULL", "UNKNOWN"].includes(x.toUpperCase())) return "";
        return x;
    };

    /*
     * DISTRICTS
     *
     * India:
     *   NAME_2 = district
     *
     * USA:
     *   NAME_1 = county
     *
     * IMPORTANT:
     * These rules apply ONLY to district level.
     * USA state files also contain description = USA.
     */

    if (level === "district") {

        if (
            valid(p.GID_2).startsWith("IND.") ||
            valid(p.COUNTRY) === "India"
        ) {
            return (
                valid(p.NAME_2_EN) ||
                valid(p.NAME_2) ||
                "Unknown"
            );
        }

        if (
            valid(p.GID_2) === "United States" ||
            valid(p.description) === "USA"
        ) {
            return (
                valid(p.NAME_1_EN) ||
                valid(p.NAME_1) ||
                "Unknown"
            );
        }
    }

    /*
     * Normal country names.
     */

    if (level === "country") {
        return (
            valid(p.name) ||
            valid(p.NAME) ||
            valid(p.description) ||
            valid(p.Name) ||
            valid(p.ADMIN) ||
            "Unknown"
        );
    }

    /*
     * Normal state names.
     */

    if (level === "state") {
        return (
            valid(p.GID_0) ||
            valid(p.NAME_0_EN) ||
            valid(p.NAME_0) ||
            valid(p.NAME_1_EN) ||
            valid(p.NAME_1) ||
            valid(p.name) ||
            valid(p.NAME) ||
            "Unknown"
        );
    }

    /*
     * Other administrative levels.
     */

    return (
        valid(p.NAME_5_EN) ||
        valid(p.NAME_5) ||
        valid(p.NAME_4_EN) ||
        valid(p.NAME_4) ||
        valid(p.NAME_3_EN) ||
        valid(p.NAME_3) ||
        valid(p.NAME_2_EN) ||
        valid(p.NAME_2) ||
        valid(p.NAME_1_EN) ||
        valid(p.NAME_1) ||
        valid(p.NAME_EN) ||
        valid(p.NAME_ENG) ||
        valid(p.NAME_ENGLISH) ||
        valid(p.name_en) ||
        valid(p.NAME) ||
        valid(p.name) ||
        valid(p.Name) ||
        "Unknown"
    );
};


MapApp.bindHoverName = function (feature, layer, level) {

    const name =
        MapApp.getFeatureName(feature, level);

    if (name && name !== "Unknown") {

        layer.bindTooltip(name, {
            sticky: true,
            direction: "top",
            opacity: 0.95
        });

    }

    layer.on("click", function (event) {

        const el = this.getElement();

        if (el) {
            el.blur();
        }

        const baseStyle =
            level === "country"
                ? {
                    color: "#333",
                    weight: 1,
                    fillColor: "#3388ff",
                    fillOpacity: 0.08
                }
                : level === "state"
                    ? {
                        color: "#333",
                        weight: 1,
                        fillColor: "#44aa55",
                        fillOpacity: 0.08
                    }
                    : {
                        color: "#333",
                        weight: 1,
                        fillColor: "#ffaa44",
                        fillOpacity: 0.08
                    };

        if (
            event.originalEvent &&
            event.originalEvent.shiftKey
        ) {

            this.setStyle(baseStyle);
            this._mapSelected = false;

            if (
                MapControls &&
                MapControls.removeSavedColor
            ) {
                MapControls.removeSavedColor(
                    feature,
                    level
                );
            }

        } else {

            const selectedStyle = {
                color: "#111111",
                weight: baseStyle.weight + 1,
                fillColor: baseStyle.fillColor,
                fillOpacity: 0.65
            };

            this.setStyle(selectedStyle);
            this._mapSelected = true;

            if (
                MapControls &&
                MapControls.rememberColor
            ) {
                MapControls.rememberColor(
                    feature,
                    level,
                    selectedStyle
                );
            }

        }

        const info =
            document.getElementById("infoName");

        if (info && name) {
            info.textContent = name;
        }

    });
};

MapApp.showLoading = function () {
    let loader = document.getElementById("map-loading");

    if (!loader) {
        loader = document.createElement("div");
        loader.id = "map-loading";
        loader.innerHTML = '<div id="map-loading-spinner"></div>';
        document.body.appendChild(loader);
    }

    loader.style.display = "flex";
};

MapApp.hideLoading = function () {
    const loader = document.getElementById("map-loading");

    if (loader) {
        loader.style.display = "none";
    }
};

MapApp.updateLevelSelection = function(level) {
    document.querySelectorAll(
        ".map-level-controls button, .mobile-levels button"
    ).forEach(function(button) {
        const text = button.textContent.trim().toLowerCase();
        const match =
            (level === "country" && text === "country") ||
            (level === "state" && text === "states") ||
            (level === "district" && text === "districts");

        button.classList.toggle("active", match);
    });
};

MapApp.showCountry = async function () {

    MapApp.updateLevelSelection("country");

    MapApp.showLoading();

    await new Promise(function(resolve) {
        requestAnimationFrame(function() {
            requestAnimationFrame(resolve);
        });
    });

    const savedView = MapApp.saveView();

    MapApp.removeLayers();

    try {

        const data = await MapApp.loadAll("country");

        MapApp.countryLayer = L.geoJSON(data, {

            style: {
                color: "#333",
                weight: 1,
                fillColor: "#3388ff",
                fillOpacity: 0.08
            },

            onEachFeature: function(feature, layer) {
                MapApp.bindHoverName(feature, layer, "country");
            }

        }).addTo(MapApp.map);

        MapControls.restoreLayerColors(
            MapApp.countryLayer,
            "country"
        );

        MapApp.restoreView(savedView);
        MapApp.hideLoading();

    } catch (error) {
        MapApp.hideLoading();
        console.error("COUNTRY LOAD ERROR:", error);
    }
};

MapApp.showStates = async function () {

    MapApp.updateLevelSelection("state");

    MapApp.showLoading();

    await new Promise(function(resolve) {
        requestAnimationFrame(function() {
            requestAnimationFrame(resolve);
        });
    });

    const savedView = MapApp.saveView();

    MapApp.removeLayers();

    try {

        const data = await MapApp.loadAll("state");

        MapApp.stateLayer = L.geoJSON(data, {

            style: {
                color: "#333",
                weight: 1,
                fillColor: "#44aa55",
                fillOpacity: 0.08
            },

            onEachFeature: function(feature, layer) {
                MapApp.bindHoverName(feature, layer, "state");
            }

        }).addTo(MapApp.map);

        MapControls.restoreLayerColors(
            MapApp.stateLayer,
            "state"
        );

        MapApp.restoreView(savedView);
        MapApp.hideLoading();

    } catch (error) {
        MapApp.hideLoading();
        console.error("STATE LOAD ERROR:", error);
    }
};

MapApp.showDistricts = async function () {

    MapApp.updateLevelSelection("district");

    MapApp.showLoading();

    await new Promise(function(resolve) {
        requestAnimationFrame(function() {
            requestAnimationFrame(resolve);
        });
    });

    const savedView = MapApp.saveView();

    MapApp.removeLayers();

    try {

        const data = await MapApp.loadAll("district");

        MapApp.districtLayer = L.geoJSON(data, {

            style: {
                color: "#333",
                weight: 1,
                fillColor: "#ffaa44",
                fillOpacity: 0.08
            },

            onEachFeature: function(feature, layer) {
                MapApp.bindHoverName(feature, layer, "district");
            }

        }).addTo(MapApp.map);

        MapControls.restoreLayerColors(
            MapApp.districtLayer,
            "district"
        );

        MapApp.restoreView(savedView);
        MapApp.hideLoading();

    } catch (error) {
        MapApp.hideLoading();
        console.error("DISTRICT LOAD ERROR:", error);
    }
};


/*
 * ============================================================
 * BACKGROUND PRELOAD
 * ============================================================
 *
 * Country is shown first.
 * Then States download.
 * Then Districts download.
 *
 * None of these block the initial Country screen.
 */

MapApp.backgroundPreload = async function() {

    /*
     * Give the browser a moment to paint Country first.
     */
    await new Promise(function(resolve) {
        setTimeout(resolve, 150);
    });


    try {

        console.log(
            "↓ Background preload: States"
        );

        await MapApp.loadAll("state");

        console.log(
            "✓ States ready"
        );

    } catch (error) {

        console.error(
            "States background preload failed:",
            error
        );
    }


    /*
     * Yield back to the browser before starting
     * the much larger District dataset.
     */
    await new Promise(function(resolve) {

        if (window.requestAnimationFrame) {
            requestAnimationFrame(function() {
                resolve();
            });
        } else {
            setTimeout(resolve, 0);
        }

    });


    try {

        console.log(
            "↓ Background preload: Districts"
        );

        await MapApp.loadAll(
            "district"
        );

        console.log(
            "✓ Districts ready"
        );

    } catch (error) {

        console.error(
            "District background preload failed:",
            error
        );
    }

    console.log(
        "✓ All background map data ready"
    );
};


async function startMap() {

    MapApp.showLoading();

    try {

        /*
         * ONLY Country blocks startup.
         */
        await MapApp.showCountry();

        /*
         * Country is now visible.
         * Everything else loads in background.
         */
        MapApp.backgroundPreload();

    } catch (error) {

        console.error(error);
    }

    const controls = document.createElement("div");

    controls.className = "map-level-controls";

    const countryButton =
        document.createElement("button");

    countryButton.textContent = "Country";

    const statesButton =
        document.createElement("button");

    statesButton.textContent = "States";

    const districtsButton =
        document.createElement("button");

    districtsButton.textContent = "Districts";
    // Styling handled entirely by css/style.css


    countryButton.onclick = MapApp.showCountry;
    statesButton.onclick = MapApp.showStates;
    districtsButton.onclick = MapApp.showDistricts;

    controls.appendChild(countryButton);
    controls.appendChild(statesButton);
    controls.appendChild(districtsButton);

    document.body.appendChild(controls);

    /* Mobile menu */
    if (!document.getElementById("mobile-menu-button")) {

        const menuButton = document.createElement("button");
        menuButton.id = "mobile-menu-button";
        menuButton.innerHTML = "☰";
        menuButton.setAttribute("aria-label", "Menu");

        const menu = document.createElement("div");
        menu.id = "mobile-menu";

        const title = document.createElement("div");
        title.className = "mobile-menu-title";
        title.textContent = "Map level";

        const levels = document.createElement("div");
        levels.className = "mobile-levels";

        [
            ["Country", MapApp.showCountry, "country"],
            ["States", MapApp.showStates, "state"],
            ["Districts", MapApp.showDistricts, "district"]
        ].forEach(function(item) {
            const button = document.createElement("button");
            button.textContent = item[0];
            button.dataset.level = item[2];
            button.onclick = async function() {
                menu.classList.remove("open");
                await item[1]();
                updateMobileLevel(item[2]);
            };
            levels.appendChild(button);
        });

        const actions = document.createElement("div");
        actions.className = "mobile-actions";

        function action(text, fn) {
            const button = document.createElement("button");
            button.className = "mobile-action";
            button.textContent = text;
            button.onclick = fn;
            actions.appendChild(button);
        }

        action("Reset", function() {
            if (window.MapControls) MapControls.resetColors();
        });

        menu.appendChild(title);
        menu.appendChild(levels);
        menu.appendChild(actions);

        document.body.appendChild(menuButton);
        document.body.appendChild(menu);

        function updateMobileLevel(level) {
            levels.querySelectorAll("button").forEach(function(button) {
                button.classList.toggle(
                    "active",
                    button.dataset.level === level
                );
            });
        }

        menuButton.onclick = function() {
            menu.classList.toggle("open");
        };

        updateMobileLevel("country");
    }
}


/* =========================================================
   GLOBAL MAP SEARCH
   Searches countries, states and districts.
   ========================================================= */

MapApp.searchCache = null;

MapApp.searchCache = null;
MapApp.searchPromise = null;

MapApp.searchCache = null;
MapApp.searchPromise = null;

MapApp.buildSearchIndex = async function() {

    if (MapApp.searchCache) {
        return MapApp.searchCache;
    }

    if (MapApp.searchPromise) {
        return MapApp.searchPromise;
    }

    MapApp.searchPromise =
        (async function() {

            const index = [];

            for (
                const level of
                ["country", "state", "district"]
            ) {

                const data =
                    await MapApp.loadAll(level);

                for (
                    const feature of
                    data.features || []
                ) {

                    const name =
                        MapApp.getFeatureName(
                            feature,
                            level
                        );

                    if (
                        !name ||
                        name === "Unknown"
                    ) {
                        continue;
                    }

                    index.push({
                        name: name,
                        level: level,
                        feature: feature
                    });
                }
            }

            MapApp.searchCache =
                index;

            return index;

        })();

    try {
        return await MapApp.searchPromise;
    } finally {
        MapApp.searchPromise = null;
    }
};


MapApp.searchNormalize = function(value) {

    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ");
};


MapApp.searchAliases = {
    "usa": "united states",
    "us": "united states",
    "uk": "united kingdom",
    "uae": "united arab emirates"
};


MapApp.search = async function(query) {

    const raw = MapApp.searchNormalize(query);

    if (!raw) return [];

    const normalized =
        MapApp.searchAliases[raw] || raw;

    const index =
        await MapApp.buildSearchIndex();

    const results = [];

    for (const item of index) {

        const name =
            MapApp.searchNormalize(item.name);

        const alias =
            MapApp.searchAliases[name] || name;

        let score = 0;

        if (alias === normalized) {
            score = 1000;
        } else if (name === normalized) {
            score = 950;
        } else if (name.startsWith(normalized)) {
            score = 800;
        } else if (name.includes(normalized)) {
            score = 600;
        } else {
            const words =
                normalized.split(" ");

            const matched =
                words.every(word =>
                    name.includes(word)
                );

            if (matched) {
                score = 400;
            }
        }

        if (score > 0) {
            results.push({
                ...item,
                score: score
            });
        }
    }

    results.sort((a, b) => {

        if (b.score !== a.score) {
            return b.score - a.score;
        }

        const levelOrder = {
            country: 0,
            state: 1,
            district: 2
        };

        return (
            levelOrder[a.level] -
            levelOrder[b.level]
        );
    });

    return results.slice(0, 10);
};


MapApp.zoomToSearchResult = async function(result) {

    const levelIndex = {
        country: 0,
        state: 1,
        district: 2
    };

    const index =
        levelIndex[result.level];

    if (index === undefined) return;

    /*
     * Load the complete level so the normal map layer
     * remains intact.
     */

    if (result.level === "country") {
        await MapApp.showCountry();
    } else if (result.level === "state") {
        await MapApp.showStates();
    } else if (result.level === "district") {
        await MapApp.showDistricts();
    }

    let targetLayer = null;

    /*
     * Find the matching feature in the currently
     * displayed Leaflet layer.
     */

    const layer =
        result.level === "country"
            ? MapApp.countryLayer
            : result.level === "state"
                ? MapApp.stateLayer
                : MapApp.districtLayer;

    if (!layer) return;

    layer.eachLayer(function(l) {

        if (
            l.feature &&
            l.feature === result.feature
        ) {
            targetLayer = l;
        }

    });

    /*
     * Object identity may differ after reloading.
     * Therefore compare the resolved English names too.
     */

    if (!targetLayer) {

        layer.eachLayer(function(l) {

            if (!l.feature) return;

            const a =
                MapApp.searchNormalize(
                    MapApp.getFeatureName(
                        l.feature,
                        result.level
                    )
                );

            const b =
                MapApp.searchNormalize(
                    result.name
                );

            if (a === b && !targetLayer) {
                targetLayer = l;
            }

        });
    }

    if (!targetLayer) return;

    const bounds =
        targetLayer.getBounds();

    if (!bounds.isValid()) return;

    MapApp.map.fitBounds(bounds, {
        padding: [80, 80],
        maxZoom:
            result.level === "country"
                ? 6
                : result.level === "state"
                    ? 8
                    : 11,
        animate: true
    });

    /*
     * Highlight the searched feature temporarily.
     */

    targetLayer.setStyle({
        color: "#111111",
        weight:
            (MapLayers.styles[result.level] || {}).weight
                ? MapLayers.styles[result.level].weight + 2
                : 3,
        fillOpacity: 0.65
    });

    if (targetLayer.bringToFront) {
        targetLayer.bringToFront();
    }

    targetLayer.bindTooltip(
        result.name,
        {
            sticky: true,
            direction: "top",
            opacity: 0.95
        }
    ).openTooltip();

    setTimeout(function() {

        if (
            !targetLayer ||
            !targetLayer.setStyle
        ) {
            return;
        }

        /*
         * If this feature already has a saved color,
         * restore that color after the search highlight.
         */
        if (
            MapControls &&
            MapControls.restoreLayerColors
        ) {

            MapControls.restoreLayerColors(
                layer,
                result.level
            );

        } else {

            targetLayer.setStyle(
                MapLayers.styles[
                    result.level
                ]
            );
        }

    }, 1800);
};


MapApp.initSearch = function() {

    const input =
        document.getElementById("search");

    const resultsBox =
        document.getElementById("results");

    if (!input || !resultsBox) {
        console.warn("Search elements not found");
        return;
    }

    let currentResults = [];

    function clearResults() {
        resultsBox.innerHTML = "";
        resultsBox.style.display = "none";
    }

    function showResults(items) {

        resultsBox.innerHTML = "";

        if (!items.length) {
            resultsBox.style.display = "none";
            return;
        }

        items.forEach(function(item) {

            const row =
                document.createElement("div");

            row.className = "search-result";

            row.innerHTML =
                `<span class="search-result-name">${item.name}</span>` +
                `<span class="search-result-level">${item.level}</span>`;

            row.addEventListener("mousedown", function(event) {

                event.preventDefault();

                input.value = item.name;

                clearResults();

                MapApp.zoomToSearchResult(item);

            });

            resultsBox.appendChild(row);
        });

        resultsBox.style.display = "block";
    }

    input.addEventListener("input", async function() {

        const query = input.value.trim();

        if (!query) {
            clearResults();
            return;
        }

        try {

            currentResults =
                await MapApp.search(query);

            showResults(currentResults);

        } catch (error) {

            console.error("Search error:", error);
            clearResults();

        }
    });

    input.addEventListener("keydown", async function(event) {

        if (event.key !== "Enter") return;

        event.preventDefault();

        const query =
            input.value.trim();

        if (!query) return;

        try {

            const results =
                await MapApp.search(query);

            if (results.length) {

                input.value =
                    results[0].name;

                clearResults();

                await MapApp.zoomToSearchResult(
                    results[0]
                );
            }

        } catch (error) {

            console.error("Search error:", error);

        }
    });

    input.addEventListener("blur", function() {

        setTimeout(clearResults, 150);

    });

    console.log("✓ Global map search ready");
};

MapApp.initSearch();

startMap();

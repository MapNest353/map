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

MapApp.loadAll = async function (type) {

    const manifest = await MapData.manifest();

    const files = manifest[type] || [];

    const folders = {
        country: "countries",
        state: "states",
        district: "districts"
    };

    const folder = folders[type];

    if (!folder) {
        throw new Error("Unknown map type: " + type);
    }

    const datasets = await Promise.all(
        files.map(async function (name) {

            const url =
                "data/" + folder + "/" +
                name.toLowerCase() +
                ".json?v=" + Date.now();

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error("Could not load " + url);
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
            features.push(...data.features);
        }
    }

    return {
        type: "FeatureCollection",
        features: features
    };
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

MapApp.showCountry = async function () {

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

    } catch (error) {
        console.error("COUNTRY LOAD ERROR:", error);
    }
};

MapApp.showStates = async function () {

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

    } catch (error) {
        console.error("STATE LOAD ERROR:", error);
    }
};

MapApp.showDistricts = async function () {

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

    } catch (error) {
        console.error("DISTRICT LOAD ERROR:", error);
    }
};

async function startMap() {

    try {
        await MapApp.showCountry();
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
}


/* =========================================================
   GLOBAL MAP SEARCH
   Searches countries, states and districts.
   ========================================================= */

MapApp.searchCache = null;

MapApp.buildSearchIndex = async function() {

    if (MapApp.searchCache) {
        return MapApp.searchCache;
    }

    const manifest = await MapData.manifest();

    const levels = ["country", "state", "district"];

    const index = [];

    for (const level of levels) {

        const files = manifest[level] || [];

        for (const file of files) {

            const folder =
                level === "country"
                    ? "countries"
                    : level === "state"
                        ? "states"
                        : "districts";

            const response = await fetch(
                `data/${folder}/${file}.json?v=${Date.now()}`
            );

            if (!response.ok) continue;

            const data = await response.json();

            for (const feature of data.features || []) {

                const name =
                    MapApp.getFeatureName(
                        feature,
                        level
                    );

                if (!name || name === "Unknown") continue;

                index.push({
                    name: name,
                    level: level,
                    file: file,
                    feature: feature
                });
            }
        }
    }

    MapApp.searchCache = index;

    return index;
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

        if (targetLayer && targetLayer.setStyle) {
            targetLayer.setStyle(
                MapLayers.styles[result.level]
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

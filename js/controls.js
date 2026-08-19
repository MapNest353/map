window.MapControls = {};

MapControls.levels = [
    "country",
    "state",
    "district",
    "adm3",
    "adm4",
    "adm5"
];

MapControls.names = {
    country: "Countries",
    state: "States",
    district: "Districts",
    adm3: "ADM3",
    adm4: "ADM4",
    adm5: "ADM5"
};

MapControls.currentIndex = 0;

MapControls.showLevel = async function(index) {

    const level =
        MapControls.levels[index];

    if (!level) return;

    try {

        if (MapLayers.currentLayer) {
            MapApp.map.removeLayer(
                MapLayers.currentLayer
            );

            MapLayers.currentLayer = null;
        }

        const data =
            await MapData.load(level);

        const layer =
            MapLayers.create(
                data,
                level
            );

        layer.addTo(MapApp.map);

        MapLayers.currentLayer = layer;

        MapControls.currentIndex = index;

        const button =
            document.getElementById(
                "levelButton"
            );

        if (button) {
            button.textContent =
                MapControls.names[level];
        }

    } catch (error) {

        console.error(error);

        throw error;

    }

};

MapControls.nextLevel = function() {

    if (
        MapControls.currentIndex <
        MapControls.levels.length - 1
    ) {

        MapControls.showLevel(
            MapControls.currentIndex + 1
        );

    }

};



/* =========================================================
   PERSISTENT COLORS
   ========================================================= */

MapControls.storageKey = "map_saved_colors_v1";

MapControls.getFeatureKey = function(feature, level) {

    const p = feature.properties || {};

    const name =
        MapApp.getFeatureName(feature, level) ||
        p.GID_5 ||
        p.GID_4 ||
        p.GID_3 ||
        p.GID_2 ||
        p.GID_1 ||
        p.GID_0 ||
        p.NAME ||
        p.name ||
        "unknown";

    return level + "::" + String(name).trim().toLowerCase();
};


MapControls.loadColors = function() {

    try {
        return JSON.parse(
            localStorage.getItem(
                MapControls.storageKey
            ) || "{}"
        );
    } catch (error) {
        console.error("Could not load saved colors:", error);
        return {};
    }
};


MapControls.saveColors = function(colors) {

    try {
        localStorage.setItem(
            MapControls.storageKey,
            JSON.stringify(colors)
        );
    } catch (error) {
        console.error("Could not save colors:", error);
    }
};


MapControls.restoreLayerColors = function(layer, level) {

    const colors =
        MapControls.loadColors();

    layer.eachLayer(function(item) {

        if (!item.feature) return;

        const key =
            MapControls.getFeatureKey(
                item.feature,
                level
            );

        if (!colors[key]) return;

        item.setStyle({
            color: colors[key].color,
            weight: colors[key].weight,
            fillColor: colors[key].fillColor,
            fillOpacity: colors[key].fillOpacity
        });

        item._mapSelected = true;
    });
};


MapControls.rememberColor = function(
    feature,
    level,
    style
) {

    const colors =
        MapControls.loadColors();

    const key =
        MapControls.getFeatureKey(
            feature,
            level
        );

    colors[key] = {
        color: style.color,
        weight: style.weight,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity
    };

    MapControls.saveColors(colors);
};


MapControls.removeSavedColor = function(
    feature,
    level
) {

    const colors =
        MapControls.loadColors();

    const key =
        MapControls.getFeatureKey(
            feature,
            level
        );

    delete colors[key];

    MapControls.saveColors(colors);
};


MapControls.resetColors = function() {

    localStorage.removeItem(
        MapControls.storageKey
    );

    location.reload();
};


/* =========================================================
   MAP IMAGE EXPORT
   ========================================================= */

MapControls.exportMap = async function(format) {

    if (typeof html2canvas === "undefined") {
        alert("Image export library has not loaded yet.");
        return;
    }

    const map =
        document.getElementById("map");

    const hide = [
        document.getElementById("searchContainer"),
        document.querySelector(".map-level-controls"),
        document.getElementById("levelButton"),
        document.getElementById("info"),
        document.querySelector(".map-export-controls")
    ];

    hide.forEach(function(el) {
        if (el) {
            el.dataset.previousDisplay =
                el.style.display;

            el.style.display = "none";
        }
    });

    try {

        const canvas =
            await html2canvas(map, {
                useCORS: true,
                backgroundColor: "#ffffff",
                logging: false,
                scale: 2
            });

        const mime =
            format === "jpg"
                ? "image/jpeg"
                : "image/png";

        const extension =
            format === "jpg"
                ? "jpg"
                : "png";

        const quality =
            format === "jpg"
                ? 0.95
                : undefined;

        const link =
            document.createElement("a");

        link.download =
            "my-map." + extension;

        link.href =
            canvas.toDataURL(
                mime,
                quality
            );

        link.click();

    } catch (error) {

        console.error("Map export failed:", error);

        alert(
            "Could not export the map. " +
            "Please try again."
        );

    } finally {

        hide.forEach(function(el) {

            if (el) {
                el.style.display =
                    el.dataset.previousDisplay || "";
            }

        });
    }
};


/* =========================================================
   EXPORT / RESET BUTTONS
   ========================================================= */

MapControls.createExportControls = function() {

    if (
        document.querySelector(
            ".map-export-controls"
        )
    ) {
        return;
    }

    const box =
        document.createElement("div");

    box.className =
        "map-export-controls";

    const png =
        document.createElement("button");

    png.textContent = "PNG";

    png.onclick = function() {
        MapControls.exportMap("png");
    };

    const jpg =
        document.createElement("button");

    jpg.textContent = "JPG";

    jpg.onclick = function() {
        MapControls.exportMap("jpg");
    };

    const reset =
        document.createElement("button");

    reset.textContent = "Reset";

    reset.onclick = function() {

        if (
            confirm(
                "Reset all saved colors?"
            )
        ) {
            MapControls.resetColors();
        }
    };

    [png, jpg, reset].forEach(function(button) {

        button.style.padding = "7px 11px";
        button.style.border = "1px solid #ccc";
        button.style.borderRadius = "6px";
        button.style.background = "white";
        button.style.cursor = "pointer";

    });

    box.appendChild(png);
    box.appendChild(jpg);
    box.appendChild(reset);

    document.body.appendChild(box);
};


MapControls.handleClick = function(
    event,
    layer,
    level
) {

    if (event.originalEvent.shiftKey) {

        layer.setStyle(
            MapLayers.styles[level]
        );

        layer._mapSelected = false;

        MapControls.removeSavedColor(
            layer.feature,
            level
        );

    } else {

        layer.setStyle({

            color: "#111111",

            weight:
                MapLayers.styles[level].weight + 1,

            fillColor:
                MapLayers.styles[level].fillColor,

            fillOpacity: 0.65

        });

        layer._mapSelected = true;

        MapControls.rememberColor(
            layer.feature,
            level,
            {
                color: "#111111",
                weight:
                    MapLayers.styles[level].weight + 1,
                fillColor:
                    MapLayers.styles[level].fillColor,
                fillOpacity: 0.65
            }
        );

    }

    const name =
        MapLayers.getName(
            layer.feature,
            level
        );

    const info =
        document.getElementById(
            "infoName"
        );

    if (info) {
        info.textContent = name;
    }

};


/* Initialize export controls after all functions exist */
MapControls.createExportControls();

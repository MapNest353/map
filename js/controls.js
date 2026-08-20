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

/* =========================================================
   PROJECT SYSTEM
   ========================================================= */

MapControls.projectsKey = "mapnest_projects_v1";
MapControls.activeProjectKey = "mapnest_active_project";
MapControls.defaultProject = "My Map";

MapControls.getProjects = function() {
    try {
        return JSON.parse(
            localStorage.getItem(MapControls.projectsKey) || "{}"
        );
    } catch (error) {
        return {};
    }
};

MapControls.getActiveProject = function() {
    return localStorage.getItem(
        MapControls.activeProjectKey
    ) || MapControls.defaultProject;
};

MapControls.setActiveProject = function(name) {
    localStorage.setItem(
        MapControls.activeProjectKey,
        name
    );
};

(function initializeProjects() {
    const projects = MapControls.getProjects();
    const oldData = localStorage.getItem("map_saved_colors_v1");

    /* Rename the original assumed default to the neutral default. */
    if (projects["Countries I Visited"] &&
        !projects["My Map"]) {
        projects["My Map"] =
            projects["Countries I Visited"];
        delete projects["Countries I Visited"];
    }

    if (!projects[MapControls.defaultProject]) {
        try {
            projects[MapControls.defaultProject] =
                oldData ? JSON.parse(oldData) : {};
        } catch (error) {
            projects[MapControls.defaultProject] = {};
        }
    }

    localStorage.setItem(
        MapControls.projectsKey,
        JSON.stringify(projects)
    );
})();

MapControls.storageKey =
    "mapnest_project_" +
    encodeURIComponent(
        MapControls.getActiveProject()
    );

/* =========================================================
   PROJECT SELECTOR
   ========================================================= */

MapControls.createProjectSelector = function() {

    if (document.getElementById("mapnest-project-selector"))
        return;

    const box = document.createElement("div");

    box.id = "mapnest-project-selector";
    box.style.cssText =
        "position:fixed;" +
        "top:195px;" +
        "right:20px;" +
        "z-index:99999;" +
        "background:white;" +
        "padding:7px;" +
        "border-radius:6px;" +
        "box-shadow:0 1px 5px rgba(0,0,0,.3);";

    const select = document.createElement("select");

    select.style.cssText =
        "padding:5px;";

    function refresh() {

        const projects =
            MapControls.getProjects();

        const active =
            MapControls.getActiveProject();

        select.innerHTML = "";

        Object.keys(projects).forEach(function(name) {

            const option =
                document.createElement("option");

            option.value = name;
            option.textContent = name;
            option.selected = name === active;

            select.appendChild(option);
        });
    }

    select.onchange = function() {

        MapControls.setActiveProject(
            this.value
        );

        location.reload();
    };

    const add =
        document.createElement("button");

    add.textContent = "+";
    add.title = "New project";
    add.style.marginLeft = "6px";

    add.onclick = function() {

        const name =
            prompt("Project name:");

        if (!name || !name.trim())
            return;

        const clean = name.trim();

        const projects =
            MapControls.getProjects();

        if (projects[clean]) {
            alert("A project with that name already exists.");
            return;
        }

        projects[clean] = {};

        localStorage.setItem(
            MapControls.projectsKey,
            JSON.stringify(projects)
        );

        MapControls.setActiveProject(clean);

        location.reload();
    };

    box.appendChild(select);
    box.appendChild(add);

    document.body.appendChild(box);

    refresh();
};

MapControls.createProjectSelector();

/* =========================================================
   PROJECT-SPECIFIC SAVED COLORS
   ========================================================= */

MapControls.storageKey =
    "mapnest_project_" +
    encodeURIComponent(
        MapControls.getActiveProject()
    );

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


/* =========================================================
   EXPORT / RESET BUTTONS
   ========================================================= */

MapControls.createExportControls = function() {

    if (document.querySelector(".map-export-controls")) {
        return;
    }

    const box = document.createElement("div");
    box.className = "map-export-controls";

    const reset = document.createElement("button");
    reset.textContent = "Reset";

    reset.onclick = function() {
        if (confirm("Reset all saved colors?")) {
            MapControls.resetColors();
        }
    };

    reset.style.padding = "7px 11px";
    reset.style.border = "1px solid #ccc";
    reset.style.borderRadius = "6px";
    reset.style.background = "white";
    reset.style.cursor = "pointer";

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

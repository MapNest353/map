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

        MapNestModal.prompt(
            "New workspace",
            "Choose a name for your new map workspace.",
            ""
        ).then(function(name) {

            if (!name || !name.trim())
                return;

            const clean = name.trim();

            const projects =
                MapControls.getProjects();

            if (projects[clean]) {

                MapNestModal.alert(
                    "Workspace already exists",
                    "A workspace with that name already exists."
                );

                return;
            }

            projects[clean] = {};

            localStorage.setItem(
                MapControls.projectsKey,
                JSON.stringify(projects)
            );

            MapControls.setActiveProject(clean);

            location.reload();
        });
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


/* =========================================================
   INSTANT PROJECT SWITCHING
   ========================================================= */

MapControls.reloadActiveProject = async function() {

    const active =
        MapControls.getActiveProject();

    MapControls.storageKey =
        "mapnest_project_" +
        encodeURIComponent(active);

    /* Clear current visual selections. */
    if (MapLayers.currentLayer) {

        const level =
            MapControls.levels[
                MapControls.currentIndex
            ];

        MapLayers.currentLayer.eachLayer(function(item) {

            if (!item.feature) return;

            item.setStyle(
                MapLayers.styles[level]
            );

            item._mapSelected = false;
        });

        /* Restore the selected regions belonging
           to the newly active workspace. */
        MapControls.restoreLayerColors(
            MapLayers.currentLayer,
            level
        );
    }

    /* Also restore whichever global map layer is active. */
    if (window.MapApp) {

        if (MapApp.countryLayer &&
            MapControls.currentIndex === 0) {

            MapControls.restoreLayerColors(
                MapApp.countryLayer,
                "country"
            );
        }

        if (MapApp.stateLayer &&
            MapControls.currentIndex === 1) {

            MapControls.restoreLayerColors(
                MapApp.stateLayer,
                "state"
            );
        }

        if (MapApp.districtLayer &&
            MapControls.currentIndex === 2) {

            MapControls.restoreLayerColors(
                MapApp.districtLayer,
                "district"
            );
        }
    }
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
        MapNestModal.confirm(
            "Reset markings?",
            "This will remove the saved markings from this workspace.",
            "Reset"
        ).then(function(ok) {

            if (ok)
                MapControls.resetColors();

        });
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

/* =========================================================
   MAPNEST WORKSPACE MANAGER
   Adds management controls without replacing the existing
   workspace selector.
   ========================================================= */
(function () {

    if (window.__MapNestWorkspaceManager) return;
    window.__MapNestWorkspaceManager = true;

    const selector =
        document.getElementById("mapnest-project-selector");

    if (!selector) {
        console.warn("Workspace manager: selector not found");
        return;
    }

    const select = selector.querySelector("select");

    if (!select) {
        console.warn("Workspace manager: select not found");
        return;
    }

    /*
     * Existing project order is controlled by Object.keys().
     * Therefore we preserve custom order by rebuilding the
     * projects object in the desired order.
     */
    function getProjects() {
        return MapControls.getProjects();
    }

    function saveProjects(projects) {
        localStorage.setItem(
            MapControls.projectsKey,
            JSON.stringify(projects)
        );
    }

    function orderedNames() {
        return Object.keys(getProjects());
    }

    function rebuildProjects(order, projects) {

        const rebuilt = {};

        order.forEach(function (name) {
            if (
                Object.prototype.hasOwnProperty.call(
                    projects,
                    name
                )
            ) {
                rebuilt[name] = projects[name];
            }
        });

        saveProjects(rebuilt);
    }

    function projectKey(name) {
        return (
            "mapnest_project_" +
            encodeURIComponent(name)
        );
    }

    /*
     * Add Manage button beside the existing + button.
     */
    const existingButtons =
        selector.querySelectorAll("button");

    let addButton = null;

    existingButtons.forEach(function (button) {
        if (button.textContent.trim() === "+") {
            addButton = button;
        }
    });

    if (!addButton) {
        console.warn("Workspace manager: + button not found");
        return;
    }

    const manage =
        document.createElement("button");

    manage.id =
        "mapnest-workspace-manager-button";

    manage.textContent = "⚙";
    manage.title = "Manage workspaces";

    manage.style.cssText =
        "margin-left:4px;" +
        "width:34px;" +
        "height:34px;" +
        "padding:0;" +
        "border:0;" +
        "border-radius:9px;" +
        "background:rgba(255,255,255,.75);" +
        "cursor:pointer;" +
        "font-size:15px;" +
        "line-height:34px;";

    addButton.parentNode.insertBefore(
        manage,
        addButton.nextSibling
    );

    /*
     * Force the existing selector to refresh after
     * changing the project object.
     */
    function refreshExistingSelector() {

        const projects = getProjects();
        const active =
            MapControls.getActiveProject();

        select.innerHTML = "";

        Object.keys(projects).forEach(function (name) {

            const option =
                document.createElement("option");

            option.value = name;
            option.textContent = name;
            option.selected =
                name === active;

            select.appendChild(option);
        });
    }

    function buttonStyle() {
        return (
            "width:30px;" +
            "height:30px;" +
            "padding:0;" +
            "border:0;" +
            "border-radius:8px;" +
            "background:white;" +
            "cursor:pointer;" +
            "font-size:14px;"
        );
    }

    function openManager() {

        const old =
            document.getElementById(
                "mapnest-workspace-manager"
            );

        if (old) {
            old.remove();
            return;
        }

        const overlay =
            document.createElement("div");

        overlay.id =
            "mapnest-workspace-manager";

        overlay.style.cssText =
            "position:fixed;" +
            "inset:0;" +
            "z-index:100000;" +
            "display:flex;" +
            "align-items:center;" +
            "justify-content:center;" +
            "background:rgba(15,23,42,.28);" +
            "backdrop-filter:blur(5px);" +
            "-webkit-backdrop-filter:blur(5px);";

        const panel =
            document.createElement("div");

        panel.style.cssText =
            "width:min(460px,calc(100vw - 30px));" +
            "max-height:calc(100vh - 50px);" +
            "overflow:auto;" +
            "padding:18px;" +
            "border-radius:18px;" +
            "background:rgba(255,255,255,.97);" +
            "box-shadow:0 20px 60px rgba(0,0,0,.22);" +
            "font-family:Arial,sans-serif;";

        const header =
            document.createElement("div");

        header.style.cssText =
            "display:flex;" +
            "align-items:center;" +
            "justify-content:space-between;" +
            "margin-bottom:5px;";

        const title =
            document.createElement("strong");

        title.textContent =
            "Manage workspaces";

        title.style.cssText =
            "font-size:16px;" +
            "color:#172033;";

        const close =
            document.createElement("button");

        close.textContent = "×";
        close.title = "Close";

        close.style.cssText =
            "border:0;" +
            "background:transparent;" +
            "font-size:24px;" +
            "cursor:pointer;" +
            "color:#667085;";

        close.onclick = function () {
            overlay.remove();
        };

        header.appendChild(title);
        header.appendChild(close);

        const description =
            document.createElement("div");

        description.textContent =
            "Rename, delete, or change their order.";

        description.style.cssText =
            "font-size:12px;" +
            "color:#667085;" +
            "margin-bottom:14px;";

        const list =
            document.createElement("div");

        function render() {

            list.innerHTML = "";

            const projects = getProjects();
            const names = orderedNames();
            const active =
                MapControls.getActiveProject();

            names.forEach(function (name, index) {

                const row =
                    document.createElement("div");

                row.style.cssText =
                    "display:flex;" +
                    "align-items:center;" +
                    "gap:6px;" +
                    "padding:8px;" +
                    "margin-bottom:6px;" +
                    "border-radius:11px;" +
                    "background:" +
                    (
                        name === active
                            ? "rgba(22,119,255,.08)"
                            : "rgba(15,23,42,.035)"
                    ) +
                    ";";

                const number =
                    document.createElement("span");

                number.textContent =
                    String(index + 1);

                number.style.cssText =
                    "width:22px;" +
                    "text-align:center;" +
                    "font-size:11px;" +
                    "color:#98a2b3;" +
                    "font-weight:bold;";

                const label =
                    document.createElement("span");

                label.textContent = name;

                label.style.cssText =
                    "flex:1;" +
                    "min-width:0;" +
                    "overflow:hidden;" +
                    "text-overflow:ellipsis;" +
                    "white-space:nowrap;" +
                    "font-size:13px;" +
                    "font-weight:600;" +
                    "color:#172033;";

                const up =
                    document.createElement("button");

                up.textContent = "↑";
                up.title = "Move up";
                up.style.cssText = buttonStyle();

                const down =
                    document.createElement("button");

                down.textContent = "↓";
                down.title = "Move down";
                down.style.cssText = buttonStyle();

                const rename =
                    document.createElement("button");

                rename.textContent = "✎";
                rename.title = "Rename";
                rename.style.cssText = buttonStyle();

                const remove =
                    document.createElement("button");

                remove.textContent = "🗑";
                remove.title = "Delete";
                remove.style.cssText = buttonStyle();

                /*
                 * UP
                 */
                if (index === 0) {
                    up.disabled = true;
                    up.style.opacity = ".3";
                    up.style.cursor = "default";
                }

                up.onclick = function () {

                    if (index === 0) return;

                    const projects = getProjects();
                    const names = orderedNames();

                    const temp =
                        names[index - 1];

                    names[index - 1] =
                        names[index];

                    names[index] = temp;

                    rebuildProjects(
                        names,
                        projects
                    );

                    refreshExistingSelector();
                    render();
                };

                /*
                 * DOWN
                 */
                if (index === names.length - 1) {
                    down.disabled = true;
                    down.style.opacity = ".3";
                    down.style.cursor = "default";
                }

                down.onclick = function () {

                    const projects = getProjects();
                    const names = orderedNames();

                    if (
                        index >=
                        names.length - 1
                    ) {
                        return;
                    }

                    const temp =
                        names[index + 1];

                    names[index + 1] =
                        names[index];

                    names[index] = temp;

                    rebuildProjects(
                        names,
                        projects
                    );

                    refreshExistingSelector();
                    render();
                };

                /*
                 * RENAME
                 */
                rename.onclick = function () {

                    MapNestModal.prompt(
                        "Rename workspace",
                        "Enter a new name for this workspace.",
                        name
                    ).then(function (newName) {

                        if (
                            newName === null ||
                            newName === undefined
                        ) {
                            return;
                        }

                        const clean =
                            newName.trim();

                        if (
                            !clean ||
                            clean === name
                        ) {
                            return;
                        }

                        const projects =
                            getProjects();

                        if (
                            Object.prototype.hasOwnProperty.call(
                                projects,
                                clean
                            )
                        ) {
                            MapNestModal.alert(
                                "Workspace already exists",
                                "A workspace with that name already exists."
                            );
                            return;
                        }

                        /*
                         * Preserve markings.
                         */
                        const oldKey =
                            projectKey(name);

                        const newKey =
                            projectKey(clean);

                        const saved =
                            localStorage.getItem(
                                oldKey
                            );

                        if (saved !== null) {

                            localStorage.setItem(
                                newKey,
                                saved
                            );

                            localStorage.removeItem(
                                oldKey
                            );
                        }

                        /*
                         * Rename while preserving
                         * its position.
                         */
                        const names =
                            orderedNames();

                        const position =
                            names.indexOf(name);

                        projects[clean] =
                            projects[name];

                        delete projects[name];

                        names[position] =
                            clean;

                        rebuildProjects(
                            names,
                            projects
                        );

                        /*
                         * If this is active, update
                         * the active project and its
                         * storage key.
                         */
                        if (
                            MapControls.getActiveProject()
                            === name
                        ) {

                            MapControls.setActiveProject(
                                clean
                            );

                            MapControls.storageKey =
                                projectKey(clean);
                        }

                        refreshExistingSelector();
                        render();
                    });
                };

                /*
                 * DELETE
                 */
                remove.onclick = function () {

                    const names =
                        orderedNames();

                    if (names.length <= 1) {

                        MapNestModal.alert(
                            "Cannot delete workspace",
                            "You must keep at least one workspace."
                        );

                        return;
                    }

                    MapNestModal.confirm(
                        "Delete workspace?",
                        'Delete "' +
                        name +
                        '"? Its saved markings will also be deleted.',
                        "Delete"
                    ).then(function (ok) {

                        if (!ok) return;

                        const projects =
                            getProjects();

                        localStorage.removeItem(
                            projectKey(name)
                        );

                        delete projects[name];

                        const newNames =
                            names.filter(function (item) {
                                return item !== name;
                            });

                        rebuildProjects(
                            newNames,
                            projects
                        );

                        if (
                            MapControls.getActiveProject()
                            === name
                        ) {

                            MapControls.setActiveProject(
                                newNames[0]
                            );

                            location.reload();
                            return;
                        }

                        refreshExistingSelector();
                        render();
                    });
                };

                row.appendChild(number);
                row.appendChild(label);
                row.appendChild(up);
                row.appendChild(down);
                row.appendChild(rename);
                row.appendChild(remove);

                list.appendChild(row);
            });
        }

        panel.appendChild(header);
        panel.appendChild(description);
        panel.appendChild(list);

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        overlay.addEventListener(
            "mousedown",
            function (event) {
                if (event.target === overlay) {
                    overlay.remove();
                }
            }
        );

        render();
    }

    manage.onclick = openManager;

    console.log(
        "✓ MapNest workspace manager ready"
    );

})();

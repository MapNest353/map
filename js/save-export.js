(function () {

    const PROJECT_KEY = "mapnest_projects";
const STORAGE_KEY = "map_coloring_v2";

    function read() {
        try {
            return JSON.parse(
                localStorage.getItem(STORAGE_KEY) || "{}"
            );
        } catch (e) {
            return {};
        }
    }

    function write(data) {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(data)
        );
    }

    function featureKey(feature, level) {

        const p = feature.properties || {};

        const ids = [
            p.GID_5,
            p.GID_4,
            p.GID_3,
            p.GID_2,
            p.GID_1,
            p.GID_0,
            p.HASC_5,
            p.HASC_4,
            p.HASC_3,
            p.HASC_2,
            p.HASC_1,
            p.CC_2,
            p.CC_1
        ];

        const id = ids.find(function (x) {
            return x !== undefined &&
                   x !== null &&
                   String(x).trim() !== "" &&
                   String(x).toUpperCase() !== "NA";
        });

        if (id) {
            return level + "::ID::" + String(id);
        }

        const name =
            MapApp.getFeatureName(feature, level);

        return level + "::NAME::" +
            String(name || "")
                .trim()
                .toLowerCase();
    }

    function saveClick(layer, level, selected) {

        if (!layer || !layer.feature) return;

        const data = read();
        const key = featureKey(
            layer.feature,
            level
        );

        if (!selected) {

            delete data[key];

        } else {

            data[key] = {
                color: "#111111",
                weight:
                    MapLayers.styles[level].weight + 1,
                fillColor:
                    MapLayers.styles[level].fillColor,
                fillOpacity: 0.65
            };
        }

        write(data);
    }

    function restore(layer, level) {

        if (!layer) return;

        const data = read();

        layer.eachLayer(function (item) {

            if (!item.feature) return;

            const key = featureKey(
                item.feature,
                level
            );

            const saved = data[key];

            if (!saved) return;

            item.setStyle(saved);
            item._mapSelected = true;
        });
    }

    /*
     * Hook the existing click system.
     */
    const oldHandleClick =
        MapControls.handleClick;

    MapControls.handleClick = function (
        event,
        layer,
        level
    ) {

        oldHandleClick.call(
            MapControls,
            event,
            layer,
            level
        );

        saveClick(
            layer,
            level,
            !event.originalEvent.shiftKey
        );
    };


    /*
     * Hook level switching.
     */
    const oldShowLevel =
        MapControls.showLevel;

    MapControls.showLevel = async function (index) {

        await oldShowLevel.call(
            MapControls,
            index
        );

        const level =
            MapControls.levels[index];

        restore(
            MapLayers.currentLayer,
            level
        );
    };


    /*
     * Hook map.js country/state/district switching too.
     */
    function hookMapFunction(name, layerName, level) {

        const original =
            MapApp[name];

        if (typeof original !== "function")
            return;

        MapApp[name] = async function () {

            await original.apply(
                MapApp,
                arguments
            );

            restore(
                MapApp[layerName],
                level
            );
        };
    }


    /*
     * map.js has already run before this file loads,
     * so hook the functions now.
     */
    hookMapFunction(
        "showCountry",
        "countryLayer",
        "country"
    );

    hookMapFunction(
        "showStates",
        "stateLayer",
        "state"
    );

    hookMapFunction(
        "showDistricts",
        "districtLayer",
        "district"
    );


    /*
     * Initial map may already be loaded.
     */
    setTimeout(function () {

        restore(
            MapApp.countryLayer,
            "country"
        );

        restore(
            MapApp.stateLayer,
            "state"
        );

        restore(
            MapApp.districtLayer,
            "district"
        );

        restore(
            MapLayers.currentLayer,
            MapControls.levels[
                MapControls.currentIndex
            ]
        );

    }, 1000);


    /*
     * Reset.
     */
    window.MapSave = {

        reset: function () {

            localStorage.removeItem(
                STORAGE_KEY
            );

            location.reload();
        }

    };


    /*
     * Export buttons.
     */
    async function exportMap(type) {

        if (typeof html2canvas === "undefined") {
            alert("Export library has not loaded.");
            return;
        }

        const map =
            document.getElementById("map");

        const hidden = [
            document.getElementById("searchContainer"),
            document.querySelector(".map-level-controls"),
            document.getElementById("levelButton"),
            document.getElementById("info"),
            document.getElementById("save-export-controls")
        ];

        hidden.forEach(function (el) {
            if (el) el.style.display = "none";
        });

        try {

            const canvas =
                await html2canvas(map, {
                    backgroundColor: "#ffffff",
                    useCORS: true,
                    logging: false,
                    scale: 2
                });

            const link =
                document.createElement("a");

            link.download =
                "my-map." + type;

            link.href =
                canvas.toDataURL(
                    type === "jpg"
                        ? "image/jpeg"
                        : "image/png",
                    type === "jpg"
                        ? 0.95
                        : undefined
                );

            link.click();

        } finally {

            hidden.forEach(function (el) {
                if (el) el.style.display = "";
            });
        }
    }


    /*
     * Buttons.
     */
    if (!document.getElementById(
        "save-export-controls"
    )) {

        const box =
            document.createElement("div");

        box.id =
            "save-export-controls";

        function makeButton(text, action) {

            const b =
                document.createElement("button");

            b.textContent = text;
            b.onclick = action;

            return b;
        }

        box.appendChild(
            makeButton(
                "PNG",
                function () {
                    exportMap("png");
                }
            )
        );

        box.appendChild(
            makeButton(
                "JPG",
                function () {
                    exportMap("jpg");
                }
            )
        );

        box.appendChild(
            makeButton(
                "Reset",
                function () {

                    if (
                        confirm(
                            "Delete all saved colors?"
                        )
                    ) {
                        MapSave.reset();
                    }

                }
            )
        );

        document.body.appendChild(box);
    }

    console.log(
        "✓ Persistent map colors enabled"
    );

})();

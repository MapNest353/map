window.MapLayers = {};

MapLayers.currentLayer = null;

MapLayers.styles = {
    country: {
        color: "#333333",
        weight: 1.2,
        fillColor: "#3388ff",
        fillOpacity: 0.08
    },

    state: {
        color: "#333333",
        weight: 1,
        fillColor: "#44aa55",
        fillOpacity: 0.08
    },

    district: {
        color: "#333333",
        weight: 0.8,
        fillColor: "#dd9955",
        fillOpacity: 0.08
    },

    adm3: {
        color: "#333333",
        weight: 0.7,
        fillColor: "#9966cc",
        fillOpacity: 0.08
    },

    adm4: {
        color: "#333333",
        weight: 0.6,
        fillColor: "#cc6688",
        fillOpacity: 0.08
    },

    adm5: {
        color: "#333333",
        weight: 0.5,
        fillColor: "#6699cc",
        fillOpacity: 0.08
    }
};

MapLayers.getName = function(feature, level) {

    const p = feature.properties || {};
    let candidates = [];

    if (level === "country") {

        candidates = [
            p.description,
            p.NAME_EN,
            p.NAME_ENG,
            p.NAME_ENGLISH,
            p.ADMIN,
            p.name_en,
            p.name,
            p.NAME,
            p.GID_1,
            p.GID_0
        ];

    } else if (level === "state") {

        candidates = [
            p.GID_0,
            p.NAME_0_EN,
            p.NAME_0,
            p.NAME_1_EN,
            p.NAME_1,
            p.name,
            p.NAME
        ];

    } else if (level === "district") {

        candidates = [
            p.GID_2,
            p.GID_1,
            p.GID_0,
            p.NAME_2_EN,
            p.NAME_2,
            p.NAME_1_EN,
            p.NAME_1,
            p.NAME_0_EN,
            p.NAME_0,
            p.name,
            p.NAME
        ];

    } else {

        candidates = [
            p.GID_5,
            p.GID_4,
            p.GID_3,
            p.GID_2,
            p.GID_1,
            p.GID_0,
            p.NAME_5_EN,
            p.NAME_4_EN,
            p.NAME_3_EN,
            p.NAME_2_EN,
            p.NAME_1_EN,
            p.NAME_0_EN,
            p.NAME_EN,
            p.NAME_ENG,
            p.NAME_ENGLISH,
            p.name_en,
            p.NAME,
            p.name,
            p.Name
        ];
    }

    for (const value of candidates) {

        if (value === undefined || value === null)
            continue;

        const name = String(value).trim();

        if (
            name &&
            name.toUpperCase() !== "NA" &&
            name.toUpperCase() !== "NULL" &&
            name.toUpperCase() !== "UNKNOWN"
        ) {
            return name;
        }
    }

    return "";
};

MapLayers.create = function(data, level) {

    return L.geoJSON(data, {

        style: function() {
            return MapLayers.styles[level];
        },

        onEachFeature: function(feature, layer) {

            layer.on("click", function(event) {

                MapControls.handleClick(
                    event,
                    layer,
                    level
                );

            });

        }

    });

};

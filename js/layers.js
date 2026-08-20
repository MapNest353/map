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
    return MapApp.getFeatureName(feature, level) || "Unknown";
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

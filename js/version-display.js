(function () {

    function showVersion() {

        const el =
            document.getElementById("map-version");

        if (!el) return;

        el.textContent =
            "MapNest " +
            (window.MAPNEST_VERSION || "") +
            " · " +
            (window.MAPNEST_UPDATED || "");

    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            showVersion
        );
    } else {
        showVersion();
    }

})();

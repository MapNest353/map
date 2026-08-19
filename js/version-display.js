document.addEventListener("DOMContentLoaded", function () {
    const box = document.getElementById("map-version");
    if (!box) return;

    const version = window.MAPNEST_VERSION || "v1.0.0";
    const updated = window.MAPNEST_UPDATED || "";

    box.textContent = "MapNest " + version + " • Updated " + updated;
});

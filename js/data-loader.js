window.MapData = {

    async load(type, country = "india") {

        const folders = {
            country: "countries",
            state: "states",
            district: "districts",
            adm3: "adm3",
            adm4: "adm4",
            adm5: "adm5"
        };

        const folder = folders[type];

        if (!folder) {
            throw new Error("Unknown data type: " + type);
        }

        const src = `data/${folder}/${country.toLowerCase()}.json`;

        const response =
            await fetch(src, { cache: "default" });

        if (!response.ok) {
            throw new Error("Could not load " + src);
        }

        return await response.json();
    },

    async manifest() {

        const response =
            await fetch("data/manifest.json", { cache: "default" });

        if (!response.ok) {
            throw new Error("Could not load data/manifest.json");
        }

        return await response.json();
    }
};

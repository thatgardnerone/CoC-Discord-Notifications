import axios from "axios";

const coc_token    = process.env["COC_TOKEN"];
const coc_clan_tag = process.env["COC_CLAN_TAG"].replace("#", "%23");
const coc_api_url  = "https://api.clashofclans.com/v1/";

// Set up the default connection to CoC
const client = axios.create({
    baseURL: coc_api_url,
    timeout: 1000,
    headers: {
        "Accept":        "application/json",
        "Authorization": "Bearer " + coc_token,
        "Content-Type":  "application/json",
    },
});

// Intercept and log any errors
client.interceptors.response.use(
    function (response) {
        return response;
    },
    function (error) {
        let res = error.response;
        console.error(`ERROR: Status ${res.status}`);
        return Promise.reject(error);
    },
);

export default {
    client,
};

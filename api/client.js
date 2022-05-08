import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const url   = "https://api.clashofclans.com/v1/";
const token = process.env["COC_TOKEN"];

// Set up the default connection to CoC
export const client = axios.create({
    baseURL: url,
    timeout: 1000,
    headers: {
        "Accept":        "application/json",
        "Authorization": "Bearer " + token,
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

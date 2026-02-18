import axios from "axios";

// In production, this would come from environment variables
const API_URL = "http://localhost:8000/api/v1";

export const client = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

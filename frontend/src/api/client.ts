import axios from "axios";

const BACKEND_API_URL = import.meta.env.VITE_API_URL;

// In production, this would come from environment variables
const API_URL = `${BACKEND_API_URL}/api/v1`;

export const client = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

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

// Request interceptor to add token
client.interceptors.request.use((config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor to handle 401s
client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Check if we're not already on the login page or share page
            const path = window.location.pathname;
            if (path !== "/login" && !path.startsWith("/share/")) {
                localStorage.removeItem("auth_token");
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

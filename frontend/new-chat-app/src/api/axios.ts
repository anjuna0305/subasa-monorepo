import axios from "axios";
import { API_BASE_URL } from "../utils/api";
import { showAlert } from "./alertService";

type ErrorResponse = {
  field: string;
  message: string;
};

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("subasa_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      showAlert("error", "Network error. Please check your connection.");
    } else {
      const errorData: ErrorResponse[] | undefined =
        error.response?.data?.detail;
      if (errorData)
        errorData.forEach((errMsg) => {
          showAlert("error", errMsg.message);
        });
      else showAlert("error", `Request failed (${error.response.status})`);
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;

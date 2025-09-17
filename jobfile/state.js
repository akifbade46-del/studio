// --- Global State ---
let currentUser = null;
let db = null;
let auth = null;
let jobFilesCache = [];
let clientsCache = [];
let chargeDescriptions = [];
let analyticsDataCache = null;
let currentFilteredJobs = [];
let fileIdToReject = null; 
let profitChartInstance = null;

// --- Getters ---
export const getCurrentUser = () => currentUser;
export const getDb = () => db;
export const getAuth = () => auth;
export const getJobFilesCache = () => jobFilesCache;
export const getClientsCache = () => clientsCache;
export const getChargeDescriptions = () => chargeDescriptions;
export const getAnalyticsDataCache = () => analyticsDataCache;
export const getCurrentFilteredJobs = () => currentFilteredJobs;
export const getFileIdToReject = () => fileIdToReject;
export const getProfitChartInstance = () => profitChartInstance;

// --- Setters ---
export const setCurrentUser = (user) => { currentUser = user; };
export const setDb = (database) => { db = database; };
export const setAuth = (authenticator) => { auth = authenticator; };
export const setJobFilesCache = (files) => { jobFilesCache = files; };
export const setClientsCache = (clients) => { clientsCache = clients; };
export const setChargeDescriptions = (descriptions) => { chargeDescriptions = descriptions; };
export const setAnalyticsDataCache = (data) => { analyticsDataCache = data; };
export const setCurrentFilteredJobs = (jobs) => { currentFilteredJobs = jobs; };
export const setFileIdToReject = (id) => { fileIdToReject = id; };
export const setProfitChartInstance = (instance) => { profitChartInstance = instance; };

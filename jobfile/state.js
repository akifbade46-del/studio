// This file holds the global state of the application.

export let currentUser = null;
export let jobFilesCache = [];
export let clientsCache = [];
export let chargeDescriptions = [];
export let analyticsDataCache = null;
export let currentFilteredJobs = [];
export let fileIdToReject = null; 
export let profitChartInstance = null;

export const setCurrentUser = (user) => { currentUser = user; };
export const setJobFilesCache = (files) => { jobFilesCache = files; };
export const setClientsCache = (clients) => { clientsCache = clients; };
export const setChargeDescriptions = (descriptions) => { chargeDescriptions = descriptions; };
export const setAnalyticsDataCache = (data) => { analyticsDataCache = data; };
export const setCurrentFilteredJobs = (jobs) => { currentFilteredJobs = jobs; };
export const setFileIdToReject = (id) => { fileIdToReject = id; };
export const setProfitChartInstance = (instance) => { profitChartInstance = instance; };

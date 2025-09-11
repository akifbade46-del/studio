// This file holds the global state of the application.
// Other modules can import these variables and functions to get or set state.

export let currentUser = null;
export let jobFilesCache = [];
export let allUsersCache = [];
export let deliveriesCache = [];
export let feedbackCache = [];
export let selectedJobFile = null;
export let currentGeolocation = null;
export let activeDeliveryForReceipt = null;
export let activeDeliveryForCompletion = null;

export function setGlobalCurrentUser(user) {
    currentUser = user;
}

export function setJobFilesCache(jobs) {
    jobFilesCache = jobs;
}

export function setAllUsersCache(users) {
    allUsersCache = users;
}

export function setDeliveriesCache(deliveries) {
    deliveriesCache = deliveries;
}

export function setFeedbackCache(feedback) {
    feedbackCache = feedback;
}

export function setSelectedJobFile(job) {
    selectedJobFile = job;
}

export function setCurrentGeolocation(location) {
    currentGeolocation = location;
}

export function setActiveDeliveryForReceipt(delivery) {
    activeDeliveryForReceipt = delivery;
}

export function setActiveDeliveryForCompletion(delivery) {
    activeDeliveryForCompletion = delivery;
}

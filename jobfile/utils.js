// Utility functions can be added here in the future.
// For example, a function to format currency or dates.

export function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
}

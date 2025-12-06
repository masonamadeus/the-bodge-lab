self.addEventListener('install', function(e) {
  self.skipWaiting();
});
self.addEventListener('fetch', function(event) {
  // You can add offline caching here if desired
});
// ---
// Service Worker for PocketPal PWA
//
// What this file does:
// - Enables the app to be installed to the home screen (PWA installability)
// - Allows you to intercept network requests and cache files for offline use
// - Can be extended to handle background sync, push notifications, etc.
//
// What you might want to add in the future:
// - Cache static assets (HTML, JS, CSS, images) for offline support
// - Use 'self.addEventListener("fetch", ...)' to serve cached files when offline
// - Add versioning to caches so you can update assets cleanly
// - Handle 'activate' event to clean up old caches
// - Add logic for background sync or push notifications if needed
//
// For more info, see: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

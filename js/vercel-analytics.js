(function initializeVercelAnalytics() {
  if (!window.location.hostname.endsWith(".vercel.app")) {
    return;
  }

  window.va =
    window.va ||
    function queueAnalyticsEvent() {
      (window.vaq = window.vaq || []).push(arguments);
    };

  const script = document.createElement("script");
  script.defer = true;
  script.src = "/_vercel/insights/script.js";
  document.head.appendChild(script);
})();

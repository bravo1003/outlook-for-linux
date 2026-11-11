• Fix mail search being unusable. The navigation-buttons module anchors on the top-bar search region and falls back to a generic role="search" selector, which Outlook's own search box matches; it injected itself there and a MutationObserver kept re-injecting it on every re-render. It is now treated as Teams-only and does not load against Outlook
• Fix the window chrome showing the Teams brand purple (#302a75) behind Outlook in dark mode; it now uses the Fluent dark neutral Outlook itself uses
• Fix the window title being set to "Teams for Linux"

/* Site configuration. formEndpoint: the URL of the deployed consultationRequest function
   (https://us-east4-<project>.cloudfunctions.net/consultationRequest). Leave empty while prototyping:
   the forms then show the thank-you panel without sending anything. */
window.SITE_CONFIG = {
  formEndpoint: 'https://us-east4-davidsteinberg-site.cloudfunctions.net/consultationRequest',
  /* pageHit function: page-view counter for the dashboard. Empty = no counting. */
  hitEndpoint: 'https://us-east4-davidsteinberg-site.cloudfunctions.net/pageHit'
};

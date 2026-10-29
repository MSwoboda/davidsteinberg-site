/* Site configuration. formEndpoint: the URL of the deployed consultationRequest function
   (https://us-east4-<project>.cloudfunctions.net/consultationRequest). Leave empty while prototyping:
   the forms then show the thank-you panel without sending anything. */
window.SITE_CONFIG = {
  formEndpoint: 'https://us-east4-davidsteinberg-site.cloudfunctions.net/consultationRequest',
  /* pageHit function: page-view counter for the dashboard. Empty = no counting. */
  /* Firebase project id: the site reads the content published from the dashboard (site/published). Empty = baked content only. */
  firebaseProject: 'davidsteinberg-site',
  /* LuxSci SecureForm id (account-form-key from the form URL): the browser posts each request into that HIPAA form database too. Empty = off. */
  secureFormId: '7851-496-Bx0Y',
  hitEndpoint: 'https://us-east4-davidsteinberg-site.cloudfunctions.net/pageHit'
};

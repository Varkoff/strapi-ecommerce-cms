export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body', config: {
      patchKoa: true,
      multipart: true,
      includeUnparsed: true,
    }
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

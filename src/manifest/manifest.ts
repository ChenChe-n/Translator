import type { ManifestV3 } from './types';

const manifest: ManifestV3 = {
  manifest_version: 3,
  name: 'Translator',
  version: '0.1.0',
  description: 'Translator',
  action: {
    default_title: 'Translator',
    default_popup: 'index.html',
  },
  permissions: ['activeTab', 'scripting'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'assets/background.js',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['assets/content.js'],
      run_at: 'document_idle',
    },
  ],
};

export default manifest;

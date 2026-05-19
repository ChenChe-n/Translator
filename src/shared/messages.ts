export const CURRENT_PAGE_PORT_NAME = 'translator-current-page-port';

export type ExtensionMessage =
  | {
      kind: 'popup-connected';
    }
  | {
      kind: 'page-ready';
    };

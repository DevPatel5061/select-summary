import { INTERFACE_VERSION } from '../core.js';

// The worker is the only owner of persisted state and provider requests.
export function createClient(context = () => ({})) {
  return async (type, fields = {}) => {
    let response;
    try {
      response = await chrome.runtime.sendMessage({
        type,
        ...fields,
        ...context()
      });
    } catch {
      throw new Error('The extension disconnected. Reload it and try again.');
    }
    if (!response?.ok) {
      throw Object.assign(
        new Error(
          response?.error?.message ||
            'Could not complete that action. Try again.'
        ),
        {
          code: response?.error?.code
        }
      );
    }
    if (type === 'GET_STATE' && response.interfaceVersion !== INTERFACE_VERSION)
      throw new Error(
        'Reload Select Summary at chrome://extensions, then reopen the welcome guide.'
      );
    return response;
  };
}

/**
 * AEM Content Fragment Proxy
 * Fetches CF data from AEM publish and returns it as JSON.
 * Called from the same origin — avoids CORS entirely.
 *
 * Supports language variations:
 *   - Detects language from URL path (e.g., /es/page → "es")
 *   - Tries language-specific JSON first (e.g., /data/wbdhbomax.es.json)
 *   - Falls back to default JSON (e.g., /data/wbdhbomax.json)
 *
 * Usage in block JS:
 *   import { fetchCFData } from '../../scripts/aem-proxy.js';
 *   const data = await fetchCFData('/content/dam/wbdhbomax');
 */

const AEM_PUBLISH_URL = 'https://publish-p121050-e1183639.adobeaemcloud.com';

/**
 * Detect site language from the current URL path.
 * Matches patterns like /es/, /fr/, /de/, /pt-br/, etc.
 * @returns {string|null} Language code or null for default
 */
function detectLanguage() {
  const match = window.location.pathname.match(/^\/([a-z]{2}(?:-[a-z]{2})?)\//);
  return match ? match[1] : null;
}

/**
 * Parse a JSON response into an array of CF items.
 */
function parseResponse(json) {
  if (Array.isArray(json)) return json;
  if (json.data?.contentByPath?.item) return [json.data.contentByPath.item];
  if (json.data?.contentList?.items) return json.data.contentList.items;
  if (json.items) return json.items;
  if (json[':items']) return Object.values(json[':items']);
  return [json];
}

/**
 * Fetch Content Fragment data via local JSON file or AEM direct fetch.
 * Automatically selects language variation based on site path.
 *
 * File resolution order (e.g., language = "es", path = /content/dam/wbdhbomax):
 *   1. /data/wbdhbomax.es.json  (language-specific)
 *   2. /data/wbdhbomax.json     (default/English fallback)
 *   3. AEM publish .model.json  (direct fetch, requires CORS)
 *
 * @param {string} cfPath - The DAM path (e.g., /content/dam/wbdhbomax)
 * @returns {Promise<Array|null>} Array of fragment item objects or null on failure
 */
// eslint-disable-next-line import/prefer-default-export
export async function fetchCFData(cfPath) {
  const lang = detectLanguage();
  const basePath = `/data${cfPath.replace('/content/dam', '')}`;

  // Strategy 1: Try language-specific local JSON
  if (lang) {
    try {
      const langResp = await fetch(`${basePath}.${lang}.json`);
      if (langResp.ok) {
        return parseResponse(await langResp.json());
      }
    } catch (e) {
      // Language-specific file not available, try default
    }
  }

  // Strategy 2: Try default local JSON
  try {
    const localResp = await fetch(`${basePath}.json`);
    if (localResp.ok) {
      return parseResponse(await localResp.json());
    }
  } catch (e) {
    // Local cache not available, continue to AEM fetch
  }

  // Strategy 3: Direct AEM fetch with variation parameter
  try {
    const variationParam = lang ? `?variation=${lang}` : '';
    const resp = await fetch(`${AEM_PUBLISH_URL}${cfPath}.model.json${variationParam}`);
    if (resp.ok) {
      return parseResponse(await resp.json());
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('AEM proxy: direct fetch failed', e.message);
  }

  return null;
}

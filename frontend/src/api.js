import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ecdat_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      const errorMsg = error.response.data?.error || '';
      if (
        errorMsg.includes('session token') ||
        errorMsg.includes('Authentication required') ||
        errorMsg.includes('Invalid or expired')
      ) {
        console.warn('[API Interceptor] Session token invalid or expired. Removing cached token.');
        localStorage.removeItem('ecdat_token');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ecdat_session_expired', { detail: errorMsg }));
        }
      }
    }
    return Promise.reject(error);
  }
);

export const downloadAuthenticatedFile = async (url, fallbackFileName = 'download.zip') => {
  try {
    const response = await api.get(url, { responseType: 'blob' });
    let fileName = fallbackFileName;
    const disposition = response.headers['content-disposition'];
    if (disposition && disposition.includes('filename=')) {
      const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
      if (match && match[1]) {
        fileName = match[1].replace(/['"]/g, '');
      }
    }
    const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] || 'application/octet-stream' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
    return true;
  } catch (err) {
    console.error('[API Download] Authenticated download failed:', err);
    throw err;
  }
};

export default api;

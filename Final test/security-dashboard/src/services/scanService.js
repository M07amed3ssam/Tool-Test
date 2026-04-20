// Scan API Service

import { getApiBaseUrl } from '../lib/apiBaseUrl';

const API_URL = getApiBaseUrl();

const getAuthToken = () => localStorage.getItem('token');

const authHeaders = () => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

const handleUnauthorized = (response) => {
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.href = '/login';
    throw new Error('Session expired. Please login again.');
  }
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  handleUnauthorized(response);

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch (_) {
      // Keep statusText fallback
    }
    throw new Error(detail || 'Request failed');
  }

  return response.json();
};

export const getScans = async (page = 1, pageSize = 10, filters = {}) => {
  const safePageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 100);
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(safePageSize),
  });

  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.includeAll) {
    params.set('include_all', 'true');
  }

  return requestJson(`${API_URL}/scans?${params.toString()}`, {
    headers: authHeaders(),
  });
};

export const createScan = async (payload) => {
  return requestJson(`${API_URL}/scans`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

export const getScanById = async (scanId) => {
  return requestJson(`${API_URL}/scans/${scanId}`, {
    headers: authHeaders(),
  });
};

export const getScanLogs = async (scanId, page = 1, pageSize = 100) => {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });

  return requestJson(`${API_URL}/scans/${scanId}/logs?${params.toString()}`, {
    headers: authHeaders(),
  });
};

export const getScanFindings = async (scanId, page = 1, pageSize = 25, severity = '') => {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });

  if (severity) {
    params.set('severity', severity);
  }

  return requestJson(`${API_URL}/scans/${scanId}/findings?${params.toString()}`, {
    headers: authHeaders(),
  });
};

export const getScanArtifacts = async (scanId) => {
  return requestJson(`${API_URL}/scans/${scanId}/artifacts`, {
    headers: authHeaders(),
  });
};

export const retryScan = async (scanId) => {
  return requestJson(`${API_URL}/scans/${scanId}/retry`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ authorization_ack: true }),
  });
};

export const cancelScan = async (scanId) => {
  return requestJson(`${API_URL}/scans/${scanId}/cancel`, {
    method: 'POST',
    headers: authHeaders(),
  });
};

export const downloadScanArtifact = async (scanId, artifact, fileName) => {
  const response = await fetch(`${API_URL}/scans/${scanId}/download/${artifact}`, {
    headers: authHeaders(),
  });

  handleUnauthorized(response);

  if (!response.ok) {
    throw new Error(`Failed to download artifact: ${response.statusText}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.download = fileName || `scan-${scanId}-artifact`;
  document.body.appendChild(link);
  link.click();

  window.URL.revokeObjectURL(url);
  document.body.removeChild(link);

  return true;
};

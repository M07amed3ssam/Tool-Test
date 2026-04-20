// Report API Service

import { getApiBaseUrl } from '../lib/apiBaseUrl';

const API_URL = getApiBaseUrl();

// Helper function to get auth token
const getAuthToken = () => localStorage.getItem('token');

// Get reports with pagination
export const getReports = async (page = 1, pageSize = 10) => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_URL}/reports?page=${page}&page_size=${pageSize}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      // Unauthorized - token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
      throw new Error(`Error fetching reports: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching reports:', error);
    throw error;
  }
};

// Get final report data
export const getFinalReport = async (reportId) => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_URL}/reports/${reportId}/final`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      // Unauthorized - token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    }

    if (response.status === 404) {
      throw new Error('Report not found');
    }

    if (!response.ok) {
      throw new Error(`Error fetching report: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching report:', error);
    throw error;
  }
};

// Download full report data
export const downloadFullReport = async (reportId, reportName) => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_URL}/reports/${reportId}/download-full`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      // Unauthorized - token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    }

    if (response.status === 404) {
      throw new Error('Report not found');
    }

    if (!response.ok) {
      throw new Error(`Error downloading report: ${response.statusText}`);
    }

    // Convert response to blob
    const blob = await response.blob();
    
    // Create a download link and trigger download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${reportName || reportId}_Full_data.json`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    return true;
  } catch (error) {
    console.error('Error downloading report:', error);
    throw error;
  }
};
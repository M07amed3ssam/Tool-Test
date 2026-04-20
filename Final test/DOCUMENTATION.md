# Security Dashboard Report System Documentation

## Architecture Overview

The Security Dashboard Report System is a full-stack application that enables users to generate, view, and download security reports. The system consists of the following components:

### Backend (FastAPI)

- **Database**: PostgreSQL database with tables for users, reports, and related entities
- **API Layer**: FastAPI endpoints for report management with JWT authentication
- **File Storage**: File system-based storage for report files with secure access controls

### Frontend (React)

- **UI Components**: React components for displaying reports and providing user interactions
- **State Management**: React hooks and context for managing application state
- **API Integration**: Service modules for communicating with backend endpoints
- **Security**: JWT-based authentication and secure file downloads

## Implementation Details

### Database Schema

The reports table schema includes:

```sql
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    report_name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'completed',
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Backend Endpoints

#### Report Management

- `GET /reports/`: Retrieve paginated list of reports
- `GET /reports/{report_id}`: Get detailed report data
- `POST /reports/`: Create a new report
- `GET /reports/{report_id}/download`: Download full report files

All endpoints are secured with JWT authentication, and file access is restricted to authorized users.

### File Storage Structure

Report files are stored in a structured directory format:

```
reports/
  ├── {user_id}/
  │   ├── {report_name}/
  │   │   ├── report.json
  │   │   ├── vulnerabilities.json
  │   │   └── recommendations.json
```

The backend handles copying files from source directories to this structure during report creation.

### Frontend Components

#### Report Service

The `reportService.js` module provides functions for interacting with the backend API:

- `getReports(page, pageSize)`: Fetch paginated reports
- `getFinalReport(reportId)`: Get detailed report data
- `downloadFullReport(reportId, fileName)`: Download complete report files

#### Secure File Download

The `SecureFileDownload` component handles secure file downloads with:

- Authentication token inclusion
- Loading state management
- Error handling and user feedback via toast notifications
- Blob-based file download functionality

#### Reports Page

The Reports page includes:

- Paginated report list with selection functionality
- Detailed report view with tabs for different data sections:
  - Summary: Overview of scan results
  - Vulnerabilities: Detailed vulnerability findings by severity
  - Recommendations: Security recommendations based on findings
  - Raw Data: JSON viewer for complete report data

### Security Considerations

1. **Authentication**: JWT-based authentication for all API requests
2. **Authorization**: Server-side verification of user access to reports
3. **Secure Downloads**: Authenticated file downloads with proper content disposition
4. **Error Handling**: Comprehensive error handling on both frontend and backend
5. **Input Validation**: Validation of all user inputs before processing

## Usage Flow

1. User logs in with credentials (JWT token generated)
2. User navigates to Reports page
3. System fetches paginated report list
4. User selects a report to view details
5. System loads detailed report data in tabbed interface
6. User can download the full report using the secure download button
7. Download is processed with proper authentication and delivered as a file

## Future Enhancements

1. **Report Generation**: Add functionality to generate new reports from scan results
2. **Filtering and Sorting**: Enhance report list with filtering and sorting options
3. **Export Formats**: Support for exporting reports in different formats (PDF, CSV)
4. **Notifications**: Email notifications for completed reports
5. **Batch Operations**: Support for batch downloading or sharing multiple reports
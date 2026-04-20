# Security Dashboard

A comprehensive security dashboard application for managing security scans, reports, and vulnerability assessments. The project includes both a FastAPI backend and a React frontend.

## Features

- JWT Authentication
- Password encryption using bcrypt
- Data validation using Pydantic
- MySQL database with SQLAlchemy ORM
- Database migrations using Alembic
- Integrated Swagger documentation
- Security scan management
- Comprehensive report system
- Secure file downloads
- Vulnerability tracking and visualization

## System Requirements

- Python 3.8+
- MySQL Server (XAMPP)
- Node.js 14+ (for frontend)

## Installation

### Backend Setup

1. Create a new MySQL database named `recondb`:

```sql
CREATE DATABASE recondb;
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Run Alembic migrations:

```bash
alembic upgrade head
```

4. Start the server:

```bash
uvicorn app.main:app --reload
```

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd security-dashboard
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm start
```

## API Endpoints

### Authentication

#### Register a new user

**Request**

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "user1",
  "email": "user1@example.com",
  "password": "securepassword",
  "full_name": "User One"
}
```

#### Login

**Request**

```http
POST /api/auth/login
Content-Type: application/x-www-form-urlencoded

username=user1@example.com&password=securepassword
```

### Reports

#### Get paginated reports

**Request**

```http
GET /reports/?page=1&page_size=10
Authorization: Bearer {token}
```

#### Get report details

**Request**

```http
GET /reports/{report_id}
Authorization: Bearer {token}
```

#### Download full report

**Request**

```http
GET /reports/{report_id}/download
Authorization: Bearer {token}
```

## Report System

The report system allows users to view and download security reports. For detailed documentation on the report system architecture and implementation, see [DOCUMENTATION.md](./DOCUMENTATION.md).

### Features

- Paginated report listing
- Detailed report view with tabbed interface
- Vulnerability categorization by severity
- Security recommendations based on findings
- Secure file downloads with authentication
- Toast notifications for user feedback

### Import Sample Recon Data Into Dashboard Reports

If you already have recon sample output under the workspace recon-agent folder, run this one-time importer to create a dashboard-visible report for a specific user email:

```bash
python insert_sample_data.py --email admin@example.com --recon-root ../recon-agent
```

Optional flags:

- `--full-data-path /path/to/Full_data.json` to import from a specific file
- `--report-name my-sample-report` to control report name in dashboard
- `--domain example.com` to override or supply the target domain
- `--dry-run` to validate input without writing files or database rows

After import, open the Reports page in the dashboard and press refresh.

```http
POST /auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}
```

**استجابة**

```json
{
  "email": "test@example.com",
  "username": "testuser",
  "id": 1,
  "created_at": "2023-05-01T12:00:00"
}
```

### تسجيل الدخول

**طلب**

```http
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=test@example.com&password=password123
```

**استجابة**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### تسجيل الدخول (JSON)

**طلب**

```http
POST /auth/login/json
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

**استجابة**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### الحصول على معلومات المستخدم الحالي

**طلب**

```http
GET /auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**استجابة**

```json
{
  "email": "test@example.com",
  "username": "testuser",
  "id": 1,
  "created_at": "2023-05-01T12:00:00"
}
```

## مثال استخدام React

```javascript
// مثال لتسجيل الدخول واستخدام JWT في React

async function loginUser(email, password) {
  try {
    const response = await fetch('http://localhost:8000/auth/login/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!response.ok) {
      throw new Error('فشل تسجيل الدخول');
    }

    const data = await response.json();
    
    // تخزين الرمز المميز في localStorage
    localStorage.setItem('token', data.access_token);
    
    return data;
  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error);
    throw error;
  }
}

// مثال لجلب معلومات المستخدم الحالي
async function getCurrentUser() {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('لم يتم تسجيل الدخول');
    }
    
    const response = await fetch('http://localhost:8000/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('فشل جلب معلومات المستخدم');
    }

    const userData = await response.json();
    return userData;
  } catch (error) {
    console.error('خطأ في جلب معلومات المستخدم:', error);
    throw error;
  }
}
```

## الوثائق

يمكنك الوصول إلى وثائق Swagger على:

```
http://localhost:8000/docs
```
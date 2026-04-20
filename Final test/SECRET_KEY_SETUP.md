# SECRET_KEY Setup Guide

## Overview

This document explains how to set up and manage the SECRET_KEY for your FastAPI security dashboard application. The SECRET_KEY is used for JWT token generation and verification, which is critical for the authentication system.

## Requirements

- The SECRET_KEY must be at least 32 characters long
- It should be kept secure and not committed to version control
- It must be available as an environment variable for the application

## Setup Options

### Option 1: Using the Generate Script (Recommended)

We've created a script that generates a secure random key and helps you set it up:

1. Run the generator script:
   ```
   python generate_secret_key.py
   ```

2. The script will:
   - Generate a secure random key
   - Display the key and its length
   - Provide instructions for setting it in different environments
   - Offer to create/update a .env file with the key

3. Choose 'y' when prompted to create a .env file for development

### Option 2: Manual Setup

If you prefer to set up the SECRET_KEY manually:

1. Generate a secure random string (at least 32 characters)
   - You can use Python's `secrets` module:
     ```python
     import secrets
     import base64
     random_bytes = secrets.token_bytes(32)
     token = base64.urlsafe_b64encode(random_bytes).decode('utf-8').rstrip('=')
     print(token)
     ```

2. Set the environment variable:
   - **PowerShell (temporary)**: `$env:SECRET_KEY="your-secret-key"`
   - **Command Prompt (temporary)**: `set SECRET_KEY=your-secret-key`
   - **Windows (permanent)**:
     - Search for 'Environment Variables'
     - Click 'Edit the system environment variables'
     - Click 'Environment Variables' button
     - Under 'User variables', click 'New'
     - Variable name: SECRET_KEY
     - Variable value: your-secret-key
     - Click 'OK' on all dialogs
   - **.env file**:
     - Create a file named `.env` in the project root
     - Add the line: `SECRET_KEY="your-secret-key"`

## How It Works

1. The application loads environment variables from the `.env` file using the `load_env.py` script
2. The SECRET_KEY is validated in `app/auth/utils.py` to ensure it meets security requirements
3. The key is used for JWT token generation and verification in the authentication system

## Troubleshooting

If you encounter the error: `SECRET_KEY must be set via environment and be at least 32 characters long`:

1. Verify the SECRET_KEY is set in your environment or .env file
2. Ensure the key is at least 32 characters long
3. Check that the .env file is in the correct location (project root)
4. Run `python load_env.py` to test if environment variables are loading correctly

## Security Best Practices

- Never commit your SECRET_KEY to version control
- Use different keys for development and production environments
- Rotate keys periodically for enhanced security
- Limit access to the production SECRET_KEY to authorized personnel only
import secrets
import os
import base64

def generate_secret_key(length=32):
    """
    Generate a secure random secret key with the specified length.
    Default length is 32 bytes (256 bits) which is suitable for most applications.
    """
    # Generate random bytes
    random_bytes = secrets.token_bytes(length)
    # Convert to base64 for a printable string
    # Use URL-safe base64 encoding and remove padding
    token = base64.urlsafe_b64encode(random_bytes).decode('utf-8').rstrip('=')
    return token

def main():
    # Generate a new secret key
    secret_key = generate_secret_key()
    
    print("\nGenerated SECRET_KEY:")
    print(secret_key)
    print("\nLength:", len(secret_key), "characters")
    
    # Instructions for setting the environment variable
    print("\n=== How to use this SECRET_KEY ===\n")
    print("1. For temporary use in PowerShell:")
    print(f'   $env:SECRET_KEY="{secret_key}"')
    
    print("\n2. For temporary use in Command Prompt:")
    print(f'   set SECRET_KEY={secret_key}')
    
    print("\n3. To set permanently in Windows:")
    print("   a. Search for 'Environment Variables' in Windows search")
    print("   b. Click 'Edit the system environment variables'")
    print("   c. Click 'Environment Variables' button")
    print("   d. Under 'User variables', click 'New'")
    print("   e. Variable name: SECRET_KEY")
    print(f"   f. Variable value: {secret_key}")
    print("   g. Click 'OK' on all dialogs")
    
    print("\n4. For .env file (recommended for development):")
    print(f'   SECRET_KEY="{secret_key}"')
    
    # Ask if user wants to create/update .env file
    create_env = input("\nDo you want to create/update a .env file with this SECRET_KEY? (y/n): ")
    if create_env.lower() == 'y':
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
        env_exists = os.path.exists(env_path)
        
        if env_exists:
            # Read existing .env file
            with open(env_path, 'r') as f:
                lines = f.readlines()
            
            # Check if SECRET_KEY already exists
            secret_key_exists = False
            for i, line in enumerate(lines):
                if line.startswith('SECRET_KEY='):
                    lines[i] = f'SECRET_KEY="{secret_key}"\n'
                    secret_key_exists = True
                    break
            
            # Add SECRET_KEY if it doesn't exist
            if not secret_key_exists:
                lines.append(f'SECRET_KEY="{secret_key}"\n')
            
            # Write updated content back to .env file
            with open(env_path, 'w') as f:
                f.writelines(lines)
        else:
            # Create new .env file
            with open(env_path, 'w') as f:
                f.write(f'SECRET_KEY="{secret_key}"\n')
        
        print(f"\n.env file {'updated' if env_exists else 'created'} at: {env_path}")

if __name__ == "__main__":
    main()
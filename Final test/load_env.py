import os
import sys
from pathlib import Path

def load_dotenv(env_file='.env'):
    """
    Load environment variables from .env file
    """
    try:
        # Get the directory of the current script
        base_dir = Path(__file__).resolve().parent
        env_path = base_dir / env_file
        
        if not env_path.exists():
            print(f"Warning: {env_path} does not exist.")
            return False
        
        # Read the .env file
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                    
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip().strip('"\'')
                
                # Keep explicitly exported variables (for local overrides like DATABASE_URL)
                os.environ.setdefault(key, value)
                
        return True
    except Exception as e:
        print(f"Error loading .env file: {e}")
        return False

def main():
    # Load environment variables from .env file
    if load_dotenv():
        print("Environment variables loaded successfully from .env file.")
        
        # Check if SECRET_KEY is set
        secret_key = os.environ.get('SECRET_KEY')
        if secret_key:
            print(f"SECRET_KEY is set with length: {len(secret_key)}")
        else:
            print("SECRET_KEY is not set in the .env file.")
    else:
        print("Failed to load environment variables.")

if __name__ == "__main__":
    main()
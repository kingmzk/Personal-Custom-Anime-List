import os
import re

settings_path = 'anime_backend/settings.py'

with open(settings_path, 'r') as f:
    settings = f.read()

# Add apps
apps_to_add = """
    'rest_framework',
    'corsheaders',
    'api',
"""
if "'rest_framework'" not in settings:
    settings = settings.replace("'django.contrib.staticfiles',", f"'django.contrib.staticfiles',\n{apps_to_add}")

# Add middleware
if "'corsheaders.middleware.CorsMiddleware'" not in settings:
    settings = settings.replace(
        "'django.middleware.security.SecurityMiddleware',",
        "'django.middleware.security.SecurityMiddleware',\n    'corsheaders.middleware.CorsMiddleware',"
    )

# Replace database
db_config = r"""DATABASES = {
    'default': {
        'ENGINE': 'mssql',
        'NAME': 'AniemListDb',
        'HOST': r'localhost\SQLEXPRESS',
        'OPTIONS': {
            'driver': 'ODBC Driver 17 for SQL Server',
            'extra_params': 'Trusted_Connection=yes;TrustServerCertificate=yes;'
        },
    }
}"""
# Using string replace instead of regex to avoid bad escape sequence
settings = re.sub(r"DATABASES = \{.*?\n\}", "", settings, flags=re.MULTILINE|re.DOTALL)
if "DATABASES = {" not in settings:
    settings += f"\n\n{db_config}"

# Add CORS settings
if "CORS_ALLOW_ALL_ORIGINS" not in settings:
    settings += "\n\nCORS_ALLOW_ALL_ORIGINS = True\n"

with open(settings_path, 'w') as f:
    f.write(settings)

print("Settings patched successfully.")

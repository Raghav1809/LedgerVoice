import os
from pathlib import Path
from datetime import timedelta
import dotenv

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent.parent
dotenv.load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-voicekhata-default-secret')
DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '*').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party packages
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # Local apps
    'authentication',
    'customers',
    'transactions',
    'voice',
    'inventory',
    'insights',
    'reminders',
    'settings_app',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'voicekhata_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR.parent / 'frontend'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'voicekhata_backend.wsgi.application'

# ─── Database Configuration (PostgreSQL Native with Cloud/Live Support) ────────
DATABASE_URL = os.getenv('DATABASE_URL')
DB_ENGINE = os.getenv('DB_ENGINE', '')
DB_NAME = os.getenv('DB_NAME') or os.getenv('POSTGRES_DB', 'voicekhata_db')
DB_USER = os.getenv('DB_USER') or os.getenv('POSTGRES_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD') or os.getenv('POSTGRES_PASSWORD', 'postgres')
DB_HOST = os.getenv('DB_HOST') or os.getenv('POSTGRES_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT') or os.getenv('POSTGRES_PORT', '5432')
DB_SSLMODE = os.getenv('DB_SSLMODE')

if DATABASE_URL:
    try:
        import dj_database_url
        DATABASES = {
            'default': dj_database_url.parse(
                DATABASE_URL,
                conn_max_age=600,
                ssl_require=(DB_SSLMODE == 'require' or 'sslmode=require' in DATABASE_URL.lower())
            )
        }
    except Exception as e:
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': BASE_DIR / 'db.sqlite3',
            }
        }
elif DB_ENGINE == 'django.db.backends.postgresql' or DB_NAME or os.getenv('POSTGRES_DB'):
    db_options = {}
    if DB_SSLMODE:
        db_options['sslmode'] = DB_SSLMODE
    elif not DEBUG and DB_HOST not in ('localhost', '127.0.0.1'):
        db_options['sslmode'] = 'require'

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': DB_NAME,
            'USER': DB_USER,
            'PASSWORD': DB_PASSWORD,
            'HOST': DB_HOST,
            'PORT': DB_PORT,
            'CONN_MAX_AGE': 600,
            'OPTIONS': db_options,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': 'voicekhata_db',
            'USER': 'postgres',
            'PASSWORD': 'postgres',
            'HOST': 'localhost',
            'PORT': '5432',
            'CONN_MAX_AGE': 600,
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STATICFILES_DIRS = [
    BASE_DIR.parent / 'frontend',
]

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=10),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

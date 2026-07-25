import os
print("ALLOWED_HOSTS raw:", repr(os.environ.get('ALLOWED_HOSTS')))
print("CORS_ALLOWED_ORIGINS raw:", repr(os.environ.get('CORS_ALLOWED_ORIGINS')))
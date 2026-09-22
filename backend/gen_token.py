import hashlib, hmac, os
from dotenv import load_dotenv
load_dotenv()

secret = os.environ.get("SESSION_SECRET", "")
user_id = 2
sig = hmac.new(secret.encode(), f"ext_{user_id}".encode(), hashlib.sha256).hexdigest()[:16]
token = f"drifter_ext_{user_id}_{sig}"
print(f"Your sync token for user {user_id}:")
print(token)

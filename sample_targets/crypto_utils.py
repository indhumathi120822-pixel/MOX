import hashlib
from Crypto.Cipher import AES

def hash_password(password):
    return hashlib.md5(password.encode()).hexdigest()

def encrypt_data(key, data):
    cipher = AES.new(key, AES.MODE_ECB)
    return cipher.encrypt(data)

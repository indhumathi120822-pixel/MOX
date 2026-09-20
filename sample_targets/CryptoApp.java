import java.security.MessageDigest;
import javax.crypto.Cipher;
import java.security.KeyPairGenerator;

public class CryptoApp {
    public static void main(String[] args) throws Exception {
        // MD5 Broken Hash
        MessageDigest md = MessageDigest.getInstance("MD5");
        
        // DES Legacy Cipher
        Cipher cipher = Cipher.getInstance("DES");
        
        // Weak RSA Key Generation (<2048)
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(1024);
    }
}

// Verified edit test

resource "aws_kms_key" "example_kms" {
  description             = "KMS Key for Sensitive DB Encryption"
  customer_master_key_spec = "RSA_2048"
  key_usage               = "ENCRYPT_DECRYPT"
  enable_key_rotation     = true
}

# Changelog

## 0.8.0
* Added ability to enable 2FA. 
* `/enable2fa` (authenticated users) - kicks off enabling 2fa, returning the uri needed to generate a QRcode for most authenticators
* `/confirm2fa` (authenticated users) - confirm authenticator.  send along a json body of `{"totpCode": "######"}` to confirm an activate 2fa
* if 2fa is enabled, on login you will receive a temporary (5 minute) token that can be used to validate a totpCode from the users authenticator.  All other endpoints will block this token
* `/verify2fa` (login token) - complete login for 2FA enabled users.  This will issue the same payload as a login.

## 0.7.5
* Added `expiration` as a second variable to the `authTokenMapper.sign()` method.  This allows for custom expiration time frames ex - 1 time use tokens, signup links, etcs
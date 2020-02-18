# Changelog

## 0.8.0
* Added ability to enable 2FA. 
* `/enable2fa` (authenticated users) - kicks off enabling 2fa, returning the uri needed to generate a QRcode for most authenticators
* `/confirm2fa` (authenticated users) - confirm authenticator.  send along a json body of `{"totpCode": "######"}` to confirm an activate 2fa
* if 2fa is enabled, on login you will receive a temporary (5 minute) token that can be used to validate a totpCode from the users authenticator.  All other endpoints will block this token
* `/verify2fa` (login token) - complete login for 2FA enabled users.  This will issue the same payload as a login.  requires json body of `{"totpCode": "######"}`
* `/remove2fa` (authenticated users) - a user can remove their own 2FA if autenticated and providing the correct totpCode.  requires json body of `{"totpCode": "######"}`
* `/remove2fa` (authenticated users w remove2FA rights) - a user can remove their own 2FA if autenticated and providing the correct totpCode.  requires json body of `{"username": "######"}`

* accepts a 2FA config (for speakeasy) that will consume the values passed in when generating the setup QR code url.  if the `name` field is present, the app will append the users username (email) to said name field.  ex:
```
"speakeasyConfig": {
   "issuer": "Company Name",
   "name: "App Name"
}
```
This is to be placed in the service app's config file(s) for each environment -  src/.config/<ENV>/authententication.json in the top of the object
You can grant any user the ability to remove anyones 2FA by adding the permission key 'remove2FA' to the services roles.json file for said user.  Please grant this permission with caution, it should only be granted to the most elevated users as it allows them to remove 2fa for anyone.

## 0.7.5
* Added `expiration` as a second variable to the `authTokenMapper.sign()` method.  This allows for custom expiration time frames ex - 1 time use tokens, signup links, etcs
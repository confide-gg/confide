# Changelog

## [0.11.1](https://github.com/confide-gg/confide/compare/confide-central-v0.11.0...confide-central-v0.11.1) (2025-12-20)


### Bug Fixes

* remove insecure chunked upload to prevent unencrypted data in temp storage ([03d26c2](https://github.com/confide-gg/confide/commit/03d26c2ad04d076b553ab06222a110d92b536c0e))


### Performance Improvements

* eliminate N+1 queries in group member operations with batch lookups ([791aea9](https://github.com/confide-gg/confide/commit/791aea9cd3be1091c2c6d864f063421b43569970))

## [0.11.0](https://github.com/confide-gg/confide/compare/confide-central-v0.10.0...confide-central-v0.11.0) (2025-12-20)


### Features

* implement end-to-end encrypted file attachments ([4c09b59](https://github.com/confide-gg/confide/commit/4c09b59805fd77cd8d2626f70dfc47347c69ef4b))
* implement GIF picker ([1f3b9b4](https://github.com/confide-gg/confide/commit/1f3b9b4b52b0f2b8976a369ad12fa80dce32a26a))

## [0.10.0](https://github.com/confide-gg/confide/compare/confide-central-v0.9.0...confide-central-v0.10.0) (2025-12-18)


### Features

* implement secure heartbeat with ML-DSA-87 and replay protection ([7610cb4](https://github.com/confide-gg/confide/commit/7610cb42c529c0a6ad3351c402660dcb7a76bc8c))


### Bug Fixes

* don't show activities when offline / invisible ([c02ebaf](https://github.com/confide-gg/confide/commit/c02ebaf5871e63f32e42746c92a93430add90429))
* separate presence channel from user events to prevent friend duplication ([45692af](https://github.com/confide-gg/confide/commit/45692af00c42457ce7f02b7b8e69524feb494672))

## [0.9.0](https://github.com/confide-gg/confide/compare/confide-central-v0.8.0...confide-central-v0.9.0) (2025-12-18)


### Features

* add Spotify activity ([#32](https://github.com/confide-gg/confide/issues/32)) ([f37df12](https://github.com/confide-gg/confide/commit/f37df12fc0cdfec534baa9db0692e1bdb2601c98))

## [0.8.0](https://github.com/confide-gg/confide/compare/confide-central-v0.7.0...confide-central-v0.8.0) (2025-12-17)


### Features

* backend optimizations ([#30](https://github.com/confide-gg/confide/issues/30)) ([4151e49](https://github.com/confide-gg/confide/commit/4151e49daac8181159a1619a341d5c373678bcbe))

## [0.7.0](https://github.com/confide-gg/confide/compare/confide-central-v0.6.0...confide-central-v0.7.0) (2025-12-17)


### Features

* use DSA signatures for heartbeat verification ([7369dd8](https://github.com/confide-gg/confide/commit/7369dd802e7e64d78e75291214ef38bd1ef527fa))


### Bug Fixes

* add security headers and request size limits ([e9742ca](https://github.com/confide-gg/confide/commit/e9742ca3d18a9de5af21b45a982b7b324d429da3))
* invalidate sessions on password reset ([b82ec00](https://github.com/confide-gg/confide/commit/b82ec007d271f8f4136a81af22ffe5c2da514c5a))
* require token secret for media relay ([a12cfc5](https://github.com/confide-gg/confide/commit/a12cfc55c8ce57ee5929ddc64288e63cb52f3c00))
* restrict CORS to specific origins ([8e60e25](https://github.com/confide-gg/confide/commit/8e60e2550b02ded0e9b20484279058c47ff588e8))
* use full hash for rate limiting ([8d24c7c](https://github.com/confide-gg/confide/commit/8d24c7c0fc941b6e699ee917e497809270581b89))

## [0.6.0](https://github.com/confide-gg/confide/compare/confide-central-v0.5.2...confide-central-v0.6.0) (2025-12-17)


### Features

* implement E2EE group chats ([#26](https://github.com/confide-gg/confide/issues/26)) ([0d31fde](https://github.com/confide-gg/confide/commit/0d31fde4978d10ab8958d31db5d47ff67b7fd836))

## [0.5.2](https://github.com/confide-gg/confide/compare/confide-central-v0.5.1...confide-central-v0.5.2) (2025-12-16)


### Bug Fixes

* file upload security ([96815b3](https://github.com/confide-gg/confide/commit/96815b3308f6023629710853f2d49ab0cb05dd6d))
* message key validation ([65da93c](https://github.com/confide-gg/confide/commit/65da93c5ea357cea1b43075eb4adbe4f0e76d9f9))
* pin unpin authorization ([581226f](https://github.com/confide-gg/confide/commit/581226f5faced1c0c8db84d5bf9bdce83cfcbc55))
* rate limit race condition ([168986e](https://github.com/confide-gg/confide/commit/168986ecc074911d0d5dfdf3490ce014d31383e3))
* rate limit token leak ([e64066e](https://github.com/confide-gg/confide/commit/e64066e5a187340a3410a5019287892dd0cea2f1))
* session expiration check ([432e943](https://github.com/confide-gg/confide/commit/432e94360d126ce2d9dd5c82a8276ef37d97bb4c))
* websocket message size limit ([1b8d95e](https://github.com/confide-gg/confide/commit/1b8d95e4347c25287884eee042c3ca4c637383a5))

## [0.5.1](https://github.com/confide-gg/confide/compare/confide-central-v0.5.0...confide-central-v0.5.1) (2025-12-16)


### Bug Fixes

* align federation role and ws behavior ([877ec13](https://github.com/confide-gg/confide/commit/877ec137a7fd219bff47e47b2b131d5561def9fe))

## [0.5.0](https://github.com/confide-gg/confide/compare/confide-central-v0.4.1...confide-central-v0.5.0) (2025-12-15)


### Features

* add snow effects for december ([45a7aed](https://github.com/confide-gg/confide/commit/45a7aeda5e7d68bec22e8de806e34b6ba168e101))
* implement pinned messages ([e86460e](https://github.com/confide-gg/confide/commit/e86460e32fada40e2564a9ef6c451daa987f7cc1))

## [0.4.1](https://github.com/confide-gg/confide/compare/confide-central-v0.4.0...confide-central-v0.4.1) (2025-12-14)


### Bug Fixes

* call events in chat now correctly show who called, declined, or cancelled ([b97a754](https://github.com/confide-gg/confide/commit/b97a754e19b45f92f221e8c7bbf18e18959a9a71))

## [0.4.0](https://github.com/confide-gg/confide/compare/confide-central-v0.3.0...confide-central-v0.4.0) (2025-12-14)


### Features

* add user preferences API endpoint ([78fed02](https://github.com/confide-gg/confide/commit/78fed028e3cf67e699dff92b66cc071cf0cc9cf9))

## [0.3.0](https://github.com/confide-gg/confide/compare/confide-central-v0.2.0...confide-central-v0.3.0) (2025-12-14)


### Features

* show client and central version in settings footer ([8e84482](https://github.com/confide-gg/confide/commit/8e844820b62c1672984d9202b6904308654f03b0))

## [0.2.0](https://github.com/confide-gg/confide/compare/confide-central-v0.1.0...confide-central-v0.2.0) (2025-12-14)


### Features

* send initial presence on user subscription and fix message field names ([79e0fcb](https://github.com/confide-gg/confide/commit/79e0fcb0968e6f4e17f42419db549a353fa3d8b3))

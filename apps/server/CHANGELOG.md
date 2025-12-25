# Changelog

## [0.7.2](https://github.com/confide-gg/confide/compare/confide-server-v0.7.1...confide-server-v0.7.2) (2025-12-25)


### Bug Fixes

* discovery sync and pagination ([65a2523](https://github.com/confide-gg/confide/commit/65a25236fc98a68014b21be66b281c1d6e649326))
* ensure WebSocket cleanup on panic with guard pattern ([3419ca8](https://github.com/confide-gg/confide/commit/3419ca8c9d0b156a7267a75a7efbf7363430a079))
* security hardening and race condition fixes ([a759af3](https://github.com/confide-gg/confide/commit/a759af390dd3280ba78436ee316b50410ce5fa29))


### Performance Improvements

* optimize database queries and async operations ([b435188](https://github.com/confide-gg/confide/commit/b435188a4c0429484beb9eaf6e67f04af89292ee))

## [0.7.1](https://github.com/confide-gg/confide/compare/confide-server-v0.7.0...confide-server-v0.7.1) (2025-12-18)


### Bug Fixes

* add signature verification before message acceptance ([66805b9](https://github.com/confide-gg/confide/commit/66805b9f2193ae98c2bb06cc7ef77bccc8252d8b))
* increase server password minimum to 12 characters with complexity requirements ([adcc17b](https://github.com/confide-gg/confide/commit/adcc17b43131a6df56473f8d4d2c7302d77fe2fe))

## [0.7.0](https://github.com/confide-gg/confide/compare/confide-server-v0.6.0...confide-server-v0.7.0) (2025-12-18)


### Features

* implement secure heartbeat with ML-DSA-87 and replay protection ([7610cb4](https://github.com/confide-gg/confide/commit/7610cb42c529c0a6ad3351c402660dcb7a76bc8c))


### Bug Fixes

* cast SUM() result to BIGINT in permissions query ([3a6059f](https://github.com/confide-gg/confide/commit/3a6059f9ecf350abd7b8e2f24f3e615c44cd25ed))

## [0.6.0](https://github.com/confide-gg/confide/compare/confide-server-v0.5.0...confide-server-v0.6.0) (2025-12-18)


### Features

* add Spotify activity ([#32](https://github.com/confide-gg/confide/issues/32)) ([f37df12](https://github.com/confide-gg/confide/commit/f37df12fc0cdfec534baa9db0692e1bdb2601c98))

## [0.5.0](https://github.com/confide-gg/confide/compare/confide-server-v0.4.0...confide-server-v0.5.0) (2025-12-17)


### Features

* backend optimizations ([#30](https://github.com/confide-gg/confide/issues/30)) ([4151e49](https://github.com/confide-gg/confide/commit/4151e49daac8181159a1619a341d5c373678bcbe))

## [0.4.0](https://github.com/confide-gg/confide/compare/confide-server-v0.3.2...confide-server-v0.4.0) (2025-12-17)


### Features

* use DSA signatures for heartbeat verification ([7369dd8](https://github.com/confide-gg/confide/commit/7369dd802e7e64d78e75291214ef38bd1ef527fa))


### Bug Fixes

* add security headers and request size limits ([e9742ca](https://github.com/confide-gg/confide/commit/e9742ca3d18a9de5af21b45a982b7b324d429da3))
* restrict CORS in federated server ([3c54422](https://github.com/confide-gg/confide/commit/3c54422cc9975afac71b8b2172d51a6b573708fc))

## [0.3.2](https://github.com/confide-gg/confide/compare/confide-server-v0.3.1...confide-server-v0.3.2) (2025-12-16)


### Bug Fixes

* enforce server-side permissions, add rate limiting, and harden websocket/message handling ([135e785](https://github.com/confide-gg/confide/commit/135e78586bb3ddeed2bfbc493c6285ca4dba1e89))

## [0.3.1](https://github.com/confide-gg/confide/compare/confide-server-v0.3.0...confide-server-v0.3.1) (2025-12-16)


### Bug Fixes

* error handling unwrap ([2e6221b](https://github.com/confide-gg/confide/commit/2e6221b6933981eb55b993a32353558929c3e79f))
* error message sanitization ([a78cdcb](https://github.com/confide-gg/confide/commit/a78cdcb69e8557aa27810ec05046ca3bde4b6da7))
* websocket authorization bypass ([c4f64bd](https://github.com/confide-gg/confide/commit/c4f64bd1c47d2c80509b026b824caa8b21fc0fcf))

## [0.3.0](https://github.com/confide-gg/confide/compare/confide-server-v0.2.0...confide-server-v0.3.0) (2025-12-16)


### Features

* add member role management ([1c8aa0e](https://github.com/confide-gg/confide/commit/1c8aa0e15dc80c0d4581fd65946ee7c6cf5a12d2))
* allow changing hierarchy of channels & categories ([f2e2d5e](https://github.com/confide-gg/confide/commit/f2e2d5e234fc94608418b444bc2ef5df2721e4a2))

## [0.2.0](https://github.com/confide-gg/confide/compare/confide-server-v0.1.1...confide-server-v0.2.0) (2025-12-16)


### Features

* broadcast role events and support role reordering ([052ec0a](https://github.com/confide-gg/confide/commit/052ec0ab54277530abd46d1b3e928e2ce21b3dec))
* extend server setup and settings ([9a4f026](https://github.com/confide-gg/confide/commit/9a4f0269c89d18faf859e3a819cac9db8890ae9b))

## [0.1.1](https://github.com/confide-gg/confide/compare/confide-server-v0.1.0...confide-server-v0.1.1) (2025-12-14)


### Bug Fixes

* resolve initial presence sync and duplicate key crash ([eaa870c](https://github.com/confide-gg/confide/commit/eaa870c1b8bbd20ce1944c9771e7c1642c349e63))
